'use server'

import { revalidatePath } from 'next/cache'

import { PERMISSIONS } from '@/lib/permissions'
import { getStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { ProdutoCatalogo } from './catalogo-local'

export type Resultado = { erro?: string; ok?: boolean }

async function exigir(code: string): Promise<string | null> {
  const staff = await getStaff()
  if (!staff) return 'Sessao expirada. Entre novamente.'
  if (!staff.permissions.has(code)) return 'Voce nao tem permissao para esta acao.'
  return null
}

/** Erros que a funcao do banco levanta, ditos do jeito que a pessoa entende. */
function traduzir(mensagem: string): string {
  const bruto = mensagem.trim()
  if (bruto === 'CONFERENCIA_FECHADA') {
    return 'Esta conferencia ja foi encerrada. As leituras novas nao foram gravadas.'
  }
  if (bruto === 'CONFERENCIA_NAO_ENCONTRADA') return 'Conferencia nao encontrada.'
  if (bruto === 'SEM_PERMISSAO') return 'Voce nao tem permissao para fazer conferencia.'
  return 'Nao foi possivel gravar as leituras. Elas continuam guardadas no aparelho.'
}

/**
 * O catalogo com codigo de barras, para a tela resolver a bipada offline.
 * Meio mega de JSON que desce uma vez por conferencia - ver catalogo-local.ts.
 */
export async function baixarCatalogo(): Promise<{ produtos?: ProdutoCatalogo[]; erro?: string }> {
  const erro = await exigir(PERMISSIONS.produtosVer)
  if (erro) return { erro }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('catalogo_conferencia')
  if (error) return { erro: 'Nao foi possivel baixar o catalogo. Tente de novo.' }

  return { produtos: (data ?? []) as ProdutoCatalogo[] }
}

export async function criarConferencia(nome: string): Promise<{ id?: string; erro?: string }> {
  const erro = await exigir(PERMISSIONS.conferenciaRealizar)
  if (erro) return { erro }

  const staff = await getStaff()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stock_takes')
    .insert({ name: nome.trim() || 'Conferencia', started_by: staff?.userId ?? null })
    .select('id')
    .single()

  if (error) {
    // O indice parcial stock_takes_uma_aberta e quem garante isso: duas
    // sessoes abertas dariam duas listas parciais da loja.
    if (error.code === '23505') {
      return { erro: 'Ja existe uma conferencia aberta. Continue nela ou encerre antes de abrir outra.' }
    }
    return { erro: 'Nao foi possivel abrir a conferencia.' }
  }

  revalidatePath('/painel/produtos/conferencia')
  return { id: data.id }
}

export type LeituraParaEnviar = {
  produto: string | null
  codigo: string
  quantidade: number | null
  em: string
}

/**
 * Sobe um lote da fila. Chamado sempre que ha pendencia e rede - o aparelho e
 * quem manda, o servidor so recebe.
 */
export async function enviarLeituras(
  conferenciaId: string,
  leituras: LeituraParaEnviar[],
): Promise<Resultado> {
  const erro = await exigir(PERMISSIONS.conferenciaRealizar)
  if (erro) return { erro }
  if (!leituras.length) return { ok: true }

  const supabase = await createClient()
  const { error } = await supabase.rpc('registrar_leituras', {
    p_conferencia: conferenciaId,
    p_leituras: leituras,
  })

  if (error) return { erro: traduzir(error.message) }
  return { ok: true }
}

/**
 * O que o servidor ja tem desta conferencia.
 *
 * Serve para retomar de outro aparelho (ou depois de limpar o navegador): a
 * tela junta isto com o que estiver guardado aqui. Sem isso, trocar de celular
 * no meio da conferencia faria a lista parecer vazia e a pessoa recomecaria.
 */
export async function carregarLeituras(
  conferenciaId: string,
): Promise<{ leituras?: LeituraParaEnviar[]; erro?: string }> {
  const erro = await exigir(PERMISSIONS.produtosVer)
  if (erro) return { erro }

  const supabase = await createClient()
  const [{ data: itens, error: erroItens }, { data: desconhecidos }] = await Promise.all([
    supabase
      .from('stock_take_items')
      .select('product_id, quantity, scanned_at, products(barcode)')
      .eq('stock_take_id', conferenciaId),
    supabase
      .from('stock_take_unknown')
      .select('barcode, last_scanned_at')
      .eq('stock_take_id', conferenciaId),
  ])

  if (erroItens) return { erro: 'Nao foi possivel carregar a conferencia.' }

  type ItemComProduto = {
    product_id: string
    quantity: number | null
    scanned_at: string
    products: { barcode: string | null } | null
  }

  return {
    leituras: [
      ...((itens ?? []) as unknown as ItemComProduto[]).map((i) => ({
        produto: i.product_id,
        codigo: i.products?.barcode ?? '',
        quantidade: i.quantity === null ? null : Number(i.quantity),
        em: i.scanned_at,
      })),
      ...(desconhecidos ?? []).map((d) => ({
        produto: null,
        codigo: d.barcode,
        quantidade: null,
        em: d.last_scanned_at,
      })),
    ],
  }
}

/** Tirou da lista: bipou sem querer, ou o item nao era da loja. */
export async function apagarLeitura(
  conferenciaId: string,
  produtoId: string | null,
  codigo: string,
): Promise<Resultado> {
  const erro = await exigir(PERMISSIONS.conferenciaRealizar)
  if (erro) return { erro }

  const supabase = await createClient()
  const { error } = produtoId
    ? await supabase
        .from('stock_take_items')
        .delete()
        .eq('stock_take_id', conferenciaId)
        .eq('product_id', produtoId)
    : await supabase
        .from('stock_take_unknown')
        .delete()
        .eq('stock_take_id', conferenciaId)
        .eq('barcode', codigo)

  if (error) return { erro: 'Nao foi possivel tirar da lista.' }
  return { ok: true }
}

/**
 * Encerra sem mexer na vitrine. Nao apaga as leituras: a conferencia fica no
 * historico, e e dela que a viragem vai sair.
 */
export async function cancelarConferencia(conferenciaId: string): Promise<Resultado> {
  const erro = await exigir(PERMISSIONS.conferenciaRealizar)
  if (erro) return { erro }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stock_takes')
    .update({ status: 'cancelada' })
    .eq('id', conferenciaId)
    .eq('status', 'aberta')
    .select('id')

  if (error) return { erro: 'Nao foi possivel encerrar a conferencia.' }
  if (!data?.length) return { erro: 'O banco recusou: voce nao tem essa permissao.' }

  revalidatePath('/painel/produtos/conferencia')
  return { ok: true }
}

// --- Viragem -----------------------------------------------------------------

export type Previa = {
  /** Conferidos que ficam na vitrine. */
  fica: number
  /** Conferidos com quantidade 0: seguem no catalogo, esgotados. */
  acabou: number
  /** Nao conferidos que saem do catalogo. */
  sai: number
  /** Nao conferidos preservados por nao terem codigo de barras para bipar. */
  mantidos_sem_codigo: number
  /** Conferidos que estavam inativos e voltam. */
  voltam: number
  /** Estavam marcados como esgotados e, por terem sido bipados, voltam a vender. */
  voltam_a_vender: number
  /** Produtos que mudam de estado. */
  mudam: number
  /** Quantos produtos a loja passa a ter. */
  vitrine_depois: number
  /** Codigos bipados sem cadastro, esperando virar produto. */
  para_cadastrar: number
}

/**
 * Revalida a loja inteira.
 *
 * A viragem mexe em milhares de produtos de uma vez, entao nao basta a home:
 * cada pagina de categoria e cada pagina de produto mudou. O padrao com
 * [slug] + 'page' alcanca todas as instancias da rota.
 */
function revalidarLoja() {
  revalidatePath('/loja')
  revalidatePath('/busca')
  revalidatePath('/c/[slug]', 'page')
  revalidatePath('/p/[slug]', 'page')
  revalidatePath('/painel/produtos')
  revalidatePath('/painel/produtos/conferencia')
}

function traduzirViragem(mensagem: string): string {
  const bruto = mensagem.trim()
  if (bruto === 'CONFERENCIA_VAZIA') {
    return 'Nenhum produto foi bipado nesta conferencia. Aplicar agora tiraria a loja inteira do ar.'
  }
  if (bruto === 'CONFERENCIA_NAO_ABERTA') return 'Esta conferencia ja foi aplicada ou encerrada.'
  if (bruto === 'CONFERENCIA_NAO_APLICADA') return 'Esta conferencia ainda nao foi aplicada.'
  if (bruto === 'JA_HA_CONFERENCIA_ABERTA') {
    return 'Ha outra conferencia aberta. Encerre a outra antes de desfazer esta.'
  }
  if (bruto === 'CONFERENCIA_NAO_ENCONTRADA') return 'Conferencia nao encontrada.'
  if (bruto === 'SEM_PERMISSAO') return 'Voce nao tem permissao para aplicar conferencia.'
  return 'Nao foi possivel concluir. A vitrine continua como estava.'
}

/** O que a viragem faria, sem gravar nada. */
export async function verPrevia(
  conferenciaId: string,
  manterSemCodigo: boolean,
): Promise<{ previa?: Previa; erro?: string }> {
  const erro = await exigir(PERMISSIONS.conferenciaAplicar)
  if (erro) return { erro }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('previa_conferencia', {
    p_conferencia: conferenciaId,
    p_manter_sem_codigo: manterSemCodigo,
  })

  if (error) return { erro: traduzirViragem(error.message) }
  return { previa: data as Previa }
}

/** A viragem: a lista conferida passa a ser o catalogo da loja. */
export async function aplicarConferencia(
  conferenciaId: string,
  manterSemCodigo: boolean,
): Promise<{ alterados?: number; erro?: string }> {
  const erro = await exigir(PERMISSIONS.conferenciaAplicar)
  if (erro) return { erro }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('aplicar_conferencia', {
    p_conferencia: conferenciaId,
    p_manter_sem_codigo: manterSemCodigo,
  })

  if (error) return { erro: traduzirViragem(error.message) }

  revalidarLoja()
  return { alterados: (data as { alterados: number }).alterados }
}

/** Devolve a vitrine ao estado anterior e reabre a conferencia. */
export async function desfazerViragem(
  conferenciaId: string,
): Promise<{ voltaram?: number; erro?: string }> {
  const erro = await exigir(PERMISSIONS.conferenciaAplicar)
  if (erro) return { erro }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('desfazer_conferencia', {
    p_conferencia: conferenciaId,
  })

  if (error) return { erro: traduzirViragem(error.message) }

  revalidarLoja()
  return { voltaram: (data as { voltaram: number }).voltaram }
}
