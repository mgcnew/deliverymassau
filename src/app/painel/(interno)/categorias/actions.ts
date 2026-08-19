'use server'

import { revalidatePath } from 'next/cache'

import { PERMISSIONS } from '@/lib/permissions'
import { getStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/format'

export type FormState = { error?: string; ok?: string }

/** UPDATE barrado pela RLS afeta zero linhas sem levantar erro. Ver actions de configuracoes. */
const BLOQUEADO = 'O banco recusou a alteracao: voce nao tem essa permissao.'

async function exigirGerenciar(): Promise<FormState> {
  const staff = await getStaff()
  if (!staff) return { error: 'Sessao expirada. Entre novamente.' }
  if (!staff.permissions.has(PERMISSIONS.categoriasGerenciar)) {
    return { error: 'Voce nao tem permissao para gerenciar categorias.' }
  }
  return {}
}

export async function criarCategoria(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await exigirGerenciar()
  if (guard.error) return guard

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Informe o nome da categoria.' }

  const supabase = await createClient()

  const { data: ultima } = await supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('categories').insert({
    name,
    slug: slugify(name),
    sort_order: (ultima?.sort_order ?? 0) + 1,
  })

  if (error) {
    return {
      error: error.code === '23505' ? 'Ja existe uma categoria com esse nome.' : error.message,
    }
  }

  revalidatePath('/painel/categorias')
  return { ok: `Categoria "${name}" criada.` }
}

export async function renomearCategoria(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await exigirGerenciar()
  if (guard.error) return guard

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!id || !name) return { error: 'Informe o nome.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .update({ name })
    .eq('id', id)
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: BLOQUEADO }

  revalidatePath('/painel/categorias')
  revalidatePath('/painel/produtos')
  return { ok: 'Categoria renomeada.' }
}

export async function alternarCategoriaAtiva(id: string, ativa: boolean): Promise<FormState> {
  const guard = await exigirGerenciar()
  if (guard.error) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .update({ is_active: ativa })
    .eq('id', id)
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: BLOQUEADO }

  revalidatePath('/painel/categorias')
  revalidatePath('/painel/produtos')
  return {}
}

/** Sobe ou desce a categoria trocando a ordem com a vizinha. */
export async function moverCategoria(id: string, direcao: 'cima' | 'baixo'): Promise<FormState> {
  const guard = await exigirGerenciar()
  if (guard.error) return guard

  const supabase = await createClient()
  const { data: lista } = await supabase
    .from('categories')
    .select('id, sort_order')
    .order('sort_order')
    .order('name')

  if (!lista) return { error: 'Nao foi possivel ler as categorias.' }

  const i = lista.findIndex((c) => c.id === id)
  const j = direcao === 'cima' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return {}

  await Promise.all([
    supabase.from('categories').update({ sort_order: lista[j].sort_order }).eq('id', lista[i].id),
    supabase.from('categories').update({ sort_order: lista[i].sort_order }).eq('id', lista[j].id),
  ])

  revalidatePath('/painel/categorias')
  return {}
}
