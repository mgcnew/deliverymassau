'use server'

import { revalidatePath } from 'next/cache'

import { PERMISSIONS } from '@/lib/permissions'
import { getStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { BUCKET_PRODUTOS } from '@/lib/supabase/storage'
import { paraNumero } from '@/lib/format'

export type ConfigState = { erro?: string; ok?: string }

/**
 * UPDATE barrado pela RLS nao levanta erro: ele simplesmente afeta zero linhas.
 * Sem conferir o retorno, a tela diria "salvo" sem ter salvo nada. Por isso todo
 * update aqui usa .select() e checa se alguma linha voltou.
 */
const BLOQUEADO = 'O banco recusou a alteracao: voce nao tem essa permissao.'

async function exigir(code: string): Promise<ConfigState> {
  const staff = await getStaff()
  if (!staff) return { erro: 'Sessao expirada. Entre novamente.' }
  if (!staff.permissions.has(code)) return { erro: 'Voce nao tem permissao para esta alteracao.' }
  return {}
}

function depois(): void {
  revalidatePath('/painel/configuracoes')
  revalidatePath('/painel')
  revalidatePath('/loja')
}

export async function salvarMercado(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configMercado)
  if (guard.erro) return guard

  const supabase = await createClient()

  const dados: Record<string, string | null> = {
    market_name: String(formData.get('market_name') ?? '').trim() || 'Mercado Massa 24h',
    market_phone: String(formData.get('market_phone') ?? '').replace(/\D/g, '') || null,
    market_address: String(formData.get('market_address') ?? '').trim() || null,
    market_city: String(formData.get('market_city') ?? '').trim() || null,
    timezone: String(formData.get('timezone') ?? '').trim() || 'America/Sao_Paulo',
  }

  const arquivo = formData.get('logo')
  if (arquivo instanceof File && arquivo.size > 0) {
    if (!arquivo.type.startsWith('image/')) return { erro: 'A logo precisa ser uma imagem.' }
    if (arquivo.size > 3 * 1024 * 1024) return { erro: 'A logo precisa ter no maximo 3 MB.' }

    const caminho = `mercado/logo-${Date.now()}.${arquivo.name.split('.').pop()?.toLowerCase() ?? 'png'}`
    const { error } = await supabase.storage
      .from(BUCKET_PRODUTOS)
      .upload(caminho, arquivo, { contentType: arquivo.type })

    if (error) return { erro: `Falha ao enviar a logo: ${error.message}` }
    dados.market_logo_path = caminho
  }

  const { data, error } = await supabase.from('settings').update(dados).eq('id', 1).select('id')
  if (error) return { erro: error.message }
  if (!data?.length) return { erro: BLOQUEADO }

  depois()
  return { ok: 'Dados do mercado salvos.' }
}

export async function salvarDelivery(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const staff = await getStaff()
  if (!staff) return { erro: 'Sessao expirada. Entre novamente.' }

  const supabase = await createClient()
  const dados: Record<string, unknown> = {}

  // Aberto/fechado nao passa mais por aqui: e o horario + os botoes
  // "Abrir agora"/"Fechar agora" (definirManual). Daqui sai so a mensagem.
  if (formData.has('delivery_closed_message')) {
    if (!staff.permissions.has(PERMISSIONS.configDeliveryStatus)) {
      return { erro: 'Voce nao pode alterar o aviso de delivery fechado.' }
    }
    dados.delivery_closed_message =
      String(formData.get('delivery_closed_message') ?? '').trim() ||
      'Delivery temporariamente indisponivel.'
  }

  if (formData.has('min_order_value')) {
    if (!staff.permissions.has(PERMISSIONS.configPedidoMinimo)) {
      return { erro: 'Voce nao pode alterar o pedido minimo.' }
    }
    const minimo = paraNumero(formData.get('min_order_value'))
    if (!Number.isFinite(minimo) || minimo < 0) return { erro: 'Pedido minimo invalido.' }
    dados.min_order_value = minimo

    const tolerancia = Number(formData.get('weight_tolerance_pct') ?? 30)
    if (Number.isFinite(tolerancia) && tolerancia > 0) dados.weight_tolerance_pct = tolerancia
  }

  const { data, error } = await supabase.from('settings').update(dados).eq('id', 1).select('id')
  if (error) return { erro: error.message }
  if (!data?.length) return { erro: BLOQUEADO }

  depois()
  return { ok: 'Configuracoes de entrega salvas.' }
}

/**
 * "Abrir agora" / "Fechar agora": excecao por cima do horario, que vale ate
 * a proxima troca dele e depois volta sozinha ao automatico (migration 0038).
 *
 * Primeiro volta ao horario e pergunta ao banco como fica: se o horario ja
 * deixa no estado pedido, nao ha excecao a gravar. Senao, grava o manual com
 * prazo na proxima troca (nulo quando o horario e 24h e nao troca nunca).
 */
export async function definirManual(estado: 'aberto' | 'fechado'): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configDeliveryStatus)
  if (guard.erro) return guard

  const supabase = await createClient()

  const limpar = await supabase
    .from('settings')
    .update({ delivery_override: null, delivery_override_until: null, delivery_enabled: true })
    .eq('id', 1)
    .select('id')
  if (limpar.error) return { erro: limpar.error.message }
  if (!limpar.data?.length) return { erro: BLOQUEADO }

  const { data: regra, error: erroRegra } = await supabase.rpc('delivery_estado')
  if (erroRegra || !regra) return { erro: 'Nao foi possivel consultar o horario. Tente de novo.' }

  const pelaRegra = regra as { aberto: boolean; troca_horario: string | null }
  if (pelaRegra.aberto !== (estado === 'aberto')) {
    const { error } = await supabase
      .from('settings')
      .update({ delivery_override: estado, delivery_override_until: pelaRegra.troca_horario })
      .eq('id', 1)
    if (error) return { erro: error.message }
  }

  depois()
  return { ok: estado === 'aberto' ? 'Delivery aberto.' : 'Delivery fechado.' }
}

/** Desfaz o abrir/fechar manual antes do prazo: volta a valer so o horario. */
export async function voltarAoHorario(): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configDeliveryStatus)
  if (guard.erro) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settings')
    // delivery_enabled volta a true junto: a chave antiga desligada tambem
    // conta como fechado manual (ver 0038).
    .update({ delivery_override: null, delivery_override_until: null, delivery_enabled: true })
    .eq('id', 1)
    .select('id')

  if (error) return { erro: error.message }
  if (!data?.length) return { erro: BLOQUEADO }

  depois()
  return { ok: 'Seguindo o horario.' }
}

export type DiaHorarioEntrada = {
  weekday: number
  mode: 'horario' | '24h' | 'fechado'
  opens_at: string
  closes_at: string
}

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/

/** Horario da semana inteira, salvo de uma vez (os 7 dias ja existem no banco). */
export async function salvarHorarios(dias: DiaHorarioEntrada[]): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configDeliveryStatus)
  if (guard.erro) return guard

  if (dias.length !== 7 || new Set(dias.map((d) => d.weekday)).size !== 7) {
    return { erro: 'Informe o horario dos 7 dias da semana.' }
  }
  for (const d of dias) {
    if (d.mode !== 'horario') continue
    if (!HORA_VALIDA.test(d.opens_at) || !HORA_VALIDA.test(d.closes_at)) {
      return { erro: 'Confira os horarios: use o formato 08:00.' }
    }
    if (d.opens_at === d.closes_at) {
      return { erro: 'Abertura e fechamento iguais: para o dia inteiro, escolha "24 horas".' }
    }
  }

  const supabase = await createClient()
  // Um update por dia: a RLS so libera UPDATE (as linhas ja existem), e um
  // upsert pediria permissao de INSERT.
  const resultados = await Promise.all(
    dias.map((d) =>
      supabase
        .from('delivery_hours')
        .update({
          mode: d.mode,
          opens_at: d.mode === 'horario' ? d.opens_at : null,
          closes_at: d.mode === 'horario' ? d.closes_at : null,
        })
        .eq('weekday', d.weekday)
        .select('weekday'),
    ),
  )

  const falha = resultados.find((r) => r.error)
  if (falha?.error) return { erro: falha.error.message }
  if (resultados.some((r) => !r.data?.length)) return { erro: BLOQUEADO }

  depois()
  return { ok: 'Horario salvo.' }
}

export async function salvarPix(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configPix)
  if (guard.erro) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settings')
    .update({
      pix_key: String(formData.get('pix_key') ?? '').trim() || null,
      pix_receiver_name: String(formData.get('pix_receiver_name') ?? '').trim() || null,
    })
    .eq('id', 1)
    .select('id')

  if (error) return { erro: error.message }
  if (!data?.length) return { erro: BLOQUEADO }

  depois()
  return { ok: 'Dados do PIX salvos.' }
}

export async function alternarPagamento(code: string, ativo: boolean): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configPagamentos)
  if (guard.erro) return guard

  const supabase = await createClient()

  // Voucher sem bandeira: o cliente teria que escolher o vale numa lista
  // vazia (a loja nem mostraria a opcao - ver migration 0037).
  if (ativo && code === 'voucher') {
    const { data: voucher } = await supabase
      .from('payment_methods')
      .select('brands')
      .eq('code', 'voucher')
      .maybeSingle()
    if (!voucher?.brands?.length) return { erro: 'Adicione pelo menos uma bandeira antes de ativar o voucher.' }
  }

  // Nunca deixar o cliente sem nenhuma forma de pagar.
  if (!ativo) {
    const { count } = await supabase
      .from('payment_methods')
      .select('code', { count: 'exact', head: true })
      .eq('is_active', true)
    if ((count ?? 0) <= 1) return { erro: 'Deixe pelo menos uma forma de pagamento ativa.' }
  }

  const { data, error } = await supabase
    .from('payment_methods')
    .update({ is_active: ativo })
    .eq('code', code)
    .select('code')

  if (error) return { erro: error.message }
  if (!data?.length) return { erro: BLOQUEADO }

  depois()
  return {}
}

/** So faz sentido listar bandeira onde ha maquininha: cartoes e voucher. */
const COM_BANDEIRAS = ['debito', 'credito', 'voucher']

/**
 * Lista de bandeiras aceitas de uma forma de pagamento, salva inteira a cada
 * mudanca (a tela adiciona e remove uma por vez).
 */
export async function salvarBandeiras(code: string, bandeiras: string[]): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configPagamentos)
  if (guard.erro) return guard
  if (!COM_BANDEIRAS.includes(code)) return { erro: 'Esta forma de pagamento nao usa bandeiras.' }

  // Sem repetir "Elo" e "elo", sem vazio, nome curto: a bandeira vai parar no
  // pedido, na via impressa e no card do entregador.
  const vistas = new Set<string>()
  const limpas: string[] = []
  for (const bruta of bandeiras) {
    const nome = bruta.replace(/\s+/g, ' ').trim().slice(0, 40)
    const chave = nome.toLocaleLowerCase('pt-BR')
    if (!nome || vistas.has(chave)) continue
    vistas.add(chave)
    limpas.push(nome)
  }
  if (limpas.length > 30) return { erro: 'Limite de 30 bandeiras por forma de pagamento.' }

  const supabase = await createClient()

  if (code === 'voucher' && limpas.length === 0) {
    const { data: voucher } = await supabase
      .from('payment_methods')
      .select('is_active')
      .eq('code', 'voucher')
      .maybeSingle()
    if (voucher?.is_active) {
      return { erro: 'O voucher esta ativo: desative antes de remover a ultima bandeira.' }
    }
  }

  const { data, error } = await supabase
    .from('payment_methods')
    .update({ brands: limpas })
    .eq('code', code)
    .select('code')

  if (error) return { erro: error.message }
  if (!data?.length) return { erro: BLOQUEADO }

  depois()
  return {}
}

export async function salvarZona(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configTaxaEntrega)
  if (guard.erro) return guard

  const id = String(formData.get('id') ?? '')
  const nome = String(formData.get('name') ?? '').trim()
  const taxa = paraNumero(formData.get('fee'))

  if (!nome) return { erro: 'Informe o nome da regiao.' }
  if (!Number.isFinite(taxa) || taxa < 0) return { erro: 'Informe uma taxa valida.' }

  const supabase = await createClient()

  if (id) {
    const { data, error } = await supabase
      .from('delivery_zones')
      .update({ name: nome, fee: taxa })
      .eq('id', id)
      .select('id')
    if (error) return { erro: error.message }
    if (!data?.length) return { erro: BLOQUEADO }
  } else {
    const { error } = await supabase.from('delivery_zones').insert({ name: nome, fee: taxa })
    if (error) return { erro: error.message }
  }

  depois()
  return { ok: 'Regiao salva.' }
}

export async function alternarZona(id: string, ativa: boolean): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configTaxaEntrega)
  if (guard.erro) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('delivery_zones')
    .update({ is_active: ativa })
    .eq('id', id)
    .select('id')
  if (error) return { erro: error.message }
  if (!data?.length) return { erro: BLOQUEADO }

  depois()
  return {}
}

export async function adicionarBairro(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configTaxaEntrega)
  if (guard.erro) return guard

  const zoneId = String(formData.get('zone_id') ?? '')
  const nome = String(formData.get('name') ?? '').trim()
  if (!zoneId || !nome) return { erro: 'Informe o bairro.' }

  const supabase = await createClient()
  const { error } = await supabase.from('zone_neighborhoods').insert({ zone_id: zoneId, name: nome })

  if (error) {
    return {
      erro:
        error.code === '23505'
          ? 'Esse bairro ja esta cadastrado em alguma regiao.'
          : error.message,
    }
  }

  depois()
  return { ok: `${nome} adicionado.` }
}

export async function removerBairro(id: string): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configTaxaEntrega)
  if (guard.erro) return guard

  const supabase = await createClient()
  const { error } = await supabase.from('zone_neighborhoods').delete().eq('id', id)
  if (error) return { erro: error.message }

  depois()
  return {}
}
