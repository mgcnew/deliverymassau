'use server'

import { revalidatePath } from 'next/cache'

import { PERMISSIONS } from '@/lib/permissions'
import { getStaff } from '@/lib/auth'
import { variantesDoCodigo } from '@/lib/produtos/codigo-barras'
import { createClient } from '@/lib/supabase/server'
import { BUCKET_PRODUTOS } from '@/lib/supabase/storage'

export type ProdutoLote = {
  id: string
  name: string
  price: number
  original_price: number | null
  category_id: string
  is_active: boolean
  barcode: string | null
}

/** Campos que a edicao em lote mexe - os mesmos nomes do banco. */
export type CamposLote = {
  name: string
  price: number
  original_price: number | null
  category_id: string
  is_active: boolean
}

export type ItemLote = {
  id: string
  /** O valor que a pessoa VIU de cada campo mudado: o banco confere antes de gravar. */
  esperado: Partial<CamposLote>
  mudar: Partial<CamposLote>
  excluir?: boolean
}

export type ResultadoLote = {
  erro?: string
  ok?: boolean
  atualizados?: number
  excluidos?: Array<{ id: string; nome: string }>
  desativados?: Array<{ id: string; nome: string; vendas: number }>
  conflitos?: Array<{ id: string; nome?: string; campo: string; atual: unknown }>
  invalidos?: Array<{ id: string; nome: string; erro: string }>
}

const LIMITE_BUSCA = 60

/**
 * Busca da edicao em lote: nome ou codigo de barras (com e sem o zero da
 * frente, como na lista), e categoria. Traz ativos e inativos - reativar
 * tambem e trabalho de lote.
 */
export async function buscarProdutosLote(
  termo: string,
  categoria: string,
): Promise<{ produtos: ProdutoLote[]; total: number; erro?: string }> {
  const staff = await getStaff()
  if (!staff?.permissions.has(PERMISSIONS.produtosVer)) {
    return { produtos: [], total: 0, erro: 'Voce nao tem permissao para ver produtos.' }
  }

  const supabase = await createClient()
  let query = supabase
    .from('products')
    .select('id, name, price, original_price, category_id, is_active, barcode', { count: 'exact' })
    .order('name')
    .limit(LIMITE_BUSCA)

  const busca = termo.trim()
  if (busca) {
    const codigos = variantesDoCodigo(busca)
    query = codigos.length
      ? query.or(`name.ilike.%${busca}%,barcode.in.(${codigos.join(',')})`)
      : query.ilike('name', `%${busca}%`)
  }
  if (categoria) query = query.eq('category_id', categoria)

  const { data, count, error } = await query
  if (error) return { produtos: [], total: 0, erro: 'Nao foi possivel buscar. Tente de novo.' }

  return {
    produtos: (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      original_price: p.original_price === null ? null : Number(p.original_price),
      category_id: p.category_id,
      is_active: p.is_active,
      barcode: p.barcode,
    })),
    total: count ?? 0,
  }
}

/**
 * Grava o lote inteiro de uma vez (aplicar_lote_produtos, migration 0040):
 * tudo ou nada, com conferencia de conflito e validacao no banco.
 */
export async function salvarLote(itens: ItemLote[]): Promise<ResultadoLote> {
  const staff = await getStaff()
  if (!staff) return { erro: 'Sessao expirada. Entre novamente.' }
  if (!itens.length) return { erro: 'Nenhuma alteracao para salvar.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('aplicar_lote_produtos', { p_itens: itens })

  if (error) {
    if (error.message.includes('SEM_PERMISSAO')) {
      const qual =
        error.details === 'produtos.excluir'
          ? 'excluir produtos'
          : error.details === 'produtos.desativar'
            ? 'inativar produtos'
            : 'editar produtos'
      return { erro: `Voce nao tem permissao para ${qual}. Nada foi salvo.` }
    }
    if (error.message.includes('LOTE_GRANDE')) return { erro: 'Maximo de 500 produtos por vez.' }
    return { erro: `Nada foi salvo: ${error.message}` }
  }

  const r = data as Omit<ResultadoLote, 'excluidos'> & {
    excluidos?: Array<{ id: string; nome: string; imagem: string | null }>
  }

  if (r.ok) {
    // Imagem de produto apagado: o banco nao alcanca o Storage, entao sai daqui
    // - e so depois de o lote ter entrado.
    const imagens = (r.excluidos ?? []).map((e) => e.imagem).filter((i): i is string => !!i)
    if (imagens.length) await supabase.storage.from(BUCKET_PRODUTOS).remove(imagens)

    revalidatePath('/painel/produtos')
    revalidatePath('/loja')
  }

  return {
    ok: r.ok,
    atualizados: r.atualizados,
    excluidos: r.excluidos?.map(({ id, nome }) => ({ id, nome })),
    desativados: r.desativados,
    conflitos: r.conflitos,
    invalidos: r.invalidos,
  }
}
