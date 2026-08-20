'use server'

import { revalidatePath } from 'next/cache'

import { PERMISSIONS } from '@/lib/permissions'
import { getStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type ClienteState = { erro?: string }

/** UPDATE barrado pela RLS afeta zero linhas sem levantar erro. */
const BLOQUEADO = 'O banco recusou a alteracao: voce nao tem essa permissao.'

async function exigir(code: string): Promise<ClienteState> {
  const staff = await getStaff()
  if (!staff) return { erro: 'Sessao expirada. Entre novamente.' }
  if (!staff.permissions.has(code)) return { erro: 'Voce nao tem permissao para esta acao.' }
  return {}
}

export async function bloquearCliente(id: string, motivo: string): Promise<ClienteState> {
  const guard = await exigir(PERMISSIONS.clientesBloquear)
  if (guard.erro) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .update({ is_blocked: true, blocked_at: new Date().toISOString(), blocked_reason: motivo || null })
    .eq('id', id)
    .select('id')
  if (error) return { erro: error.message }
  if (!data?.length) return { erro: BLOQUEADO }

  revalidatePath('/painel/clientes')
  revalidatePath(`/painel/clientes/${id}`)
  return {}
}

export async function desbloquearCliente(id: string): Promise<ClienteState> {
  const guard = await exigir(PERMISSIONS.clientesBloquear)
  if (guard.erro) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .update({ is_blocked: false, blocked_at: null, blocked_reason: null })
    .eq('id', id)
    .select('id')
  if (error) return { erro: error.message }
  if (!data?.length) return { erro: BLOQUEADO }

  revalidatePath('/painel/clientes')
  revalidatePath(`/painel/clientes/${id}`)
  return {}
}
