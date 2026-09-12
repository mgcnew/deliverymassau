import 'server-only'

import { cache } from 'react'

import type { DiaHorario, EstadoDelivery } from '@/lib/horario'

import { createClient } from '@/lib/supabase/server'
import type { UnitType } from '@/lib/types'

export type ConfiguracaoPublica = {
  market_name: string
  market_phone: string | null
  market_logo_path: string | null
  market_address: string | null
  /** Calculado pelo banco (horario + abrir/fechar manual), nao mais uma chave. */
  delivery_enabled: boolean
  delivery: EstadoDelivery
  delivery_hours: DiaHorario[]
  /** Como a taxa e calculada: pelo bairro (lista) ou pela distancia (faixas de km). */
  delivery_fee_mode?: 'bairro' | 'distancia'
  delivery_bands?: Array<{ up_to_km: number; fee: number }>
  delivery_closed_message: string
  min_order_value: number
  pix_key: string | null
  pix_receiver_name: string | null
  /** brands: bandeiras aceitas (cartoes e voucher). No voucher o cliente escolhe uma. */
  payment_methods: Array<{ code: string; label: string; brands: string[] }>
}

export type ProdutoVitrine = {
  id: string
  name: string
  slug: string
  short_description: string | null
  image_path: string | null
  unit_type: UnitType
  sold_by_weight: boolean
  price: number
  original_price: number | null
  is_available: boolean
  category_id: string
  weight_step: number | null
  min_weight: number | null
}

export type CategoriaVitrine = { id: string; name: string; slug: string }

const CAMPOS_PRODUTO =
  'id, name, slug, short_description, image_path, unit_type, sold_by_weight, price, original_price, is_available, category_id, weight_step, min_weight'

/** Em oferta = tem preco antigo cadastrado e ele e maior que o preco atual. */
export function emPromocao(produto: Pick<ProdutoVitrine, 'price' | 'original_price'>): boolean {
  return produto.original_price != null && Number(produto.original_price) > Number(produto.price)
}

/** Uma leitura por request, mesmo com header e pagina perguntando ao mesmo tempo. */
export const getConfiguracaoPublica = cache(async (): Promise<ConfiguracaoPublica | null> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_public_settings')
  return (data as ConfiguracaoPublica) ?? null
})

export const getCategorias = cache(async (): Promise<CategoriaVitrine[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
})

/**
 * Os mais pedidos no bairro (ranking dos ultimos 90 dias, migration 0043),
 * so os que da para comprar agora. Loja nova ou sem vendas: lista vazia.
 */
export const getMaisPedidos = cache(async (limite = 12): Promise<ProdutoVitrine[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_popularity')
    .select(`posicao, products!inner(${CAMPOS_PRODUTO})`)
    .eq('products.is_active', true)
    .eq('products.is_available', true)
    .order('posicao')
    .limit(limite)
  return (data ?? []).map((linha) => linha.products as unknown as ProdutoVitrine)
})

/** Foto de capa e total de cada categoria, para a grade da home. */
export const getCapasCategorias = cache(
  async (): Promise<Map<string, { imagem: string | null; total: number }>> => {
    const supabase = await createClient()
    const { data } = await supabase.rpc('get_capas_categorias')
    const linhas = (data ?? []) as Array<{ category_id: string; image_path: string | null; total: number }>
    return new Map(linhas.map((l) => [l.category_id, { imagem: l.image_path, total: Number(l.total) }]))
  },
)

/** Uma pagina de produtos, com o total para a tela saber quantas paginas existem. */
export const getProdutosPaginados = cache(
  async (opcoes: {
    categoriaId?: string
    busca?: string
    pagina: number
    porPagina: number
  }): Promise<{ itens: ProdutoVitrine[]; total: number }> => {
    const supabase = await createClient()

    // Categoria e busca saem da MESMA funcao do banco (0051). Antes a
    // categoria vinha de uma funcao e a busca de um select direto, e so a
    // primeira sabia ordenar por mais pedidos - a busca, que e onde a
    // intencao e mais alta, ficava alfabetica. Juntas, nao ha como uma
    // ordenacao valer num lugar e nao no outro.
    const { data } = await supabase.rpc('get_vitrine_pagina', {
      p_categoria: opcoes.categoriaId ?? null,
      p_busca: opcoes.busca ?? null,
      p_limite: opcoes.porPagina,
      p_offset: (opcoes.pagina - 1) * opcoes.porPagina,
    })

    const pagina = (data ?? { itens: [], total: 0 }) as { itens: ProdutoVitrine[]; total: number }
    return { itens: pagina.itens ?? [], total: Number(pagina.total ?? 0) }
  },
)

/**
 * Lista simples, sem paginacao - hoje so o "Voce tambem pode gostar" da pagina
 * do produto. Usa a mesma ordem da vitrine: nao faria sentido sugerir na ponta
 * do alfabeto quando ha um campeao de vendas na mesma categoria.
 */
export const getProdutos = cache(
  async (opcoes?: { categoriaId?: string; busca?: string; limite?: number }): Promise<ProdutoVitrine[]> => {
    const supabase = await createClient()
    const { data } = await supabase.rpc('get_vitrine_pagina', {
      p_categoria: opcoes?.categoriaId ?? null,
      p_busca: opcoes?.busca ?? null,
      p_limite: opcoes?.limite ?? 48,
      p_offset: 0,
    })
    return ((data as { itens?: ProdutoVitrine[] } | null)?.itens ?? []) as ProdutoVitrine[]
  },
)

/** original_price preenchido ja garante > price (check constraint do banco). */
export const getProdutosEmPromocao = cache(
  async (opcoes?: { excluirId?: string; limite?: number }): Promise<ProdutoVitrine[]> => {
    const supabase = await createClient()
    let query = supabase
      .from('products')
      .select(CAMPOS_PRODUTO)
      .not('original_price', 'is', null)
      .eq('is_available', true)
      .order('sort_order')

    if (opcoes?.excluirId) query = query.neq('id', opcoes.excluirId)
    if (opcoes?.limite) query = query.limit(opcoes.limite)

    const { data } = await query
    return (data ?? []) as ProdutoVitrine[]
  },
)

export const getProdutoPorSlug = cache(async (slug: string): Promise<ProdutoVitrine | null> => {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select(CAMPOS_PRODUTO).eq('slug', slug).maybeSingle()
  return (data as ProdutoVitrine) ?? null
})

export const getCategoriaPorSlug = cache(async (slug: string): Promise<CategoriaVitrine | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return data ?? null
})

export const getBairrosAtendidos = cache(async (): Promise<Array<{ bairro: string; taxa: number }>> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('zone_neighborhoods')
    .select('name, delivery_zones!inner(fee, is_active)')
    .order('name')

  return (data ?? [])
    .filter((linha) => {
      const zona = linha.delivery_zones as unknown as { fee: number; is_active: boolean }
      return zona?.is_active
    })
    .map((linha) => ({
      bairro: linha.name,
      taxa: Number((linha.delivery_zones as unknown as { fee: number }).fee),
    }))
})
