import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { PermissionCode } from '@/lib/permissions'
import type { Profile } from '@/lib/types'

export type Staff = {
  userId: string
  profile: Profile
  permissions: Set<string>
}

/** cache() = uma unica ida ao banco por request, mesmo com varios componentes perguntando. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient()

  // getClaims() e nao getUser(): as chaves do projeto sao ES256, entao o JWT
  // e validado localmente (assinatura conferida de verdade, nao e o
  // getSession() que so le o cookie). getUser() batia no Supabase Auth em
  // toda pagina do painel -- somado ao proxy, eram DUAS idas de rede de
  // ~60-100ms cada por navegacao, so para descobrir quem e o usuario.
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) return null

  // Perfil e permissoes nao dependem um do outro (my_permissions usa
  // auth.uid() direto via RLS) - rodar em paralelo poupa uma ida de rede
  // em toda pagina autenticada do painel.
  const [{ data: profile }, { data: codes }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.rpc('my_permissions'),
  ])

  if (!profile || !profile.is_active) return null

  return {
    userId,
    profile: profile as Profile,
    permissions: new Set<string>((codes as string[] | null) ?? []),
  }
})

export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff()
  if (!staff) redirect('/painel/login')
  return staff
}

/** Guarda de pagina. A RLS/RPC continua sendo a barreira real. */
export async function requirePermission(code: PermissionCode): Promise<Staff> {
  const staff = await requireStaff()
  if (!staff.permissions.has(code)) redirect(`/painel/sem-acesso?p=${encodeURIComponent(code)}`)
  return staff
}

export function can(staff: Staff | null, code: PermissionCode): boolean {
  return staff?.permissions.has(code) ?? false
}

/** "Ultimo acesso" da tela de Equipe, sem escrever no banco a cada clique. */
export async function touchLastSeen(staff: Staff): Promise<void> {
  const last = staff.profile.last_seen_at ? new Date(staff.profile.last_seen_at).getTime() : 0
  if (Date.now() - last < 5 * 60 * 1000) return

  const supabase = await createClient()
  await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', staff.profile.id)
}
