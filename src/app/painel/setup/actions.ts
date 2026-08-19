'use server'

import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type SetupState = { error?: string }

/** So funciona enquanto nao existe NENHUM funcionario. Depois disso, tela de Equipe. */
export async function criarPrimeiroAdmin(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!name || !email || password.length < 8) {
    return { error: 'Preencha nome, e-mail e uma senha de pelo menos 8 caracteres.' }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      error:
        'SUPABASE_SERVICE_ROLE_KEY nao configurada no .env.local. Ela e necessaria para criar contas de funcionario.',
    }
  }

  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
  if ((count ?? 0) > 0) return { error: 'A equipe ja foi criada. Use a tela de Equipe.' }

  const { data: preset } = await admin
    .from('permission_presets')
    .select('id')
    .eq('slug', 'administrador')
    .single()

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !created.user) {
    return { error: authError?.message ?? 'Nao foi possivel criar a conta.' }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    name,
    phone: phone.replace(/\D/g, '') || null,
    preset_id: preset?.id ?? null,
    is_active: true,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: profileError.message }
  }

  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email, password })

  redirect('/painel')
}
