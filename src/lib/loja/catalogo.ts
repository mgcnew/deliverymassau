import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import type { UnitType } from '@/lib/types'

export type ConfiguracaoPublica = {
  market_name: string
  market_phone: string | null
  market_logo_path: string | null
  market_address: string | null
  delivery_enabled: boolean
  delivery_closed_message: string
  min_order_value: number
  pix_key: string | null
  pix_receiver_name: string | null
  payment_methods: Array<{ code: string; label: string }>
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
  is_available: boolean
  category_id: string
  weight_step: number | null
  min_weight: number | null
}

export type CategoriaVitrine = { id: string; name: string; slug: string }

const CAMPOS_PRODUTO =
  'id, name, slug, short_description, image_path, unit_type, sold_by_weight, price, is_available, category_id, weight_step, min_weight'

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

/** A RLS ja limita o anon a produtos ativos; indisponivel aparece marcado como "Acabou". */
export const getProdutos = cache(
  async (opcoes?: { categoriaId?: string; busca?: string; limite?: number }): Promise<ProdutoVitrine[]> => {
    const supabase = await createClient()
    let query = supabase
      .from('products')
      .select(CAMPOS_PRODUTO)
      .order('is_available', { ascending: false })
      .order('sort_order')
      .order('name')

    if (opcoes?.categoriaId) query = query.eq('category_id', opcoes.categoriaId)
    if (opcoes?.busca) query = query.ilike('name', `%${opcoes.busca}%`)
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
