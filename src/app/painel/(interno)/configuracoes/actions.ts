'use server'

import { revalidatePath } from 'next/cache'

import { PERMISSIONS } from '@/lib/permissions'
import { getStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { BUCKET_PRODUTOS } from '@/lib/supabase/storage'
import { paraNumero } from '@/lib/format'

export type ConfigState = { erro?: string; ok?: string }

async function exigir(code: string): Promise<ConfigState> {
  const staff = await getStaff()
  if (!staff) return { erro: 'Sessao expirada. Entre novamente.' }
  if (!staff.permissions.has(code)) return { erro: 'Voce nao tem permissao para esta alteracao.' }
  return {}
}

function depois(): void {
  revalidatePath('/painel/configuracoes')
  revalidatePath('/painel')
  revalidatePath('/')
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

  const { error } = await supabase.from('settings').update(dados).eq('id', 1)
  if (error) return { erro: error.message }

  depois()
  return { ok: 'Dados do mercado salvos.' }
}

export async function salvarDelivery(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const staff = await getStaff()
  if (!staff) return { erro: 'Sessao expirada. Entre novamente.' }

  const supabase = await createClient()
  const dados: Record<string, unknown> = {}

  if (formData.has('delivery_enabled')) {
    if (!staff.permissions.has(PERMISSIONS.configDeliveryStatus)) {
      return { erro: 'Voce nao pode abrir ou fechar o delivery.' }
    }
    dados.delivery_enabled = formData.get('delivery_enabled') === 'on'
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

  const { error } = await supabase.from('settings').update(dados).eq('id', 1)
  if (error) return { erro: error.message }

  depois()
  return { ok: 'Configuracoes de entrega salvas.' }
}

export async function salvarPix(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configPix)
  if (guard.erro) return guard

  const supabase = await createClient()
  const { error } = await supabase
    .from('settings')
    .update({
      pix_key: String(formData.get('pix_key') ?? '').trim() || null,
      pix_receiver_name: String(formData.get('pix_receiver_name') ?? '').trim() || null,
    })
    .eq('id', 1)

  if (error) return { erro: error.message }

  depois()
  return { ok: 'Dados do PIX salvos.' }
}

export async function alternarPagamento(code: string, ativo: boolean): Promise<ConfigState> {
  const guard = await exigir(PERMISSIONS.configPagamentos)
  if (guard.erro) return guard

  const supabase = await createClient()

  // Nunca deixar o cliente sem nenhuma forma de pagar.
  if (!ativo) {
    const { count } = await supabase
      .from('payment_methods')
      .select('code', { count: 'exact', head: true })
      .eq('is_active', true)
    if ((count ?? 0) <= 1) return { erro: 'Deixe pelo menos uma forma de pagamento ativa.' }
  }

  const { error } = await supabase
    .from('payment_methods')
    .update({ is_active: ativo })
    .eq('code', code)

  if (error) return { erro: error.message }

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
    const { error } = await supabase
      .from('delivery_zones')
      .update({ name: nome, fee: taxa })
      .eq('id', id)
    if (error) return { erro: error.message }
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
  const { error } = await supabase.from('delivery_zones').update({ is_active: ativa }).eq('id', id)
  if (error) return { erro: error.message }

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
