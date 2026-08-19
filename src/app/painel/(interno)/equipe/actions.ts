'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { PERMISSIONS } from '@/lib/permissions'
import { getStaff } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; ok?: string }

/** UPDATE barrado pela RLS afeta zero linhas sem levantar erro. Ver actions de configuracoes. */
const BLOQUEADO = 'O banco recusou a alteracao: voce nao tem essa permissao.'

async function exigir(code: string): Promise<{ error?: string }> {
  const staff = await getStaff()
  if (!staff) return { error: 'Sessao expirada. Entre novamente.' }
  if (!staff.permissions.has(code)) return { error: 'Voce nao tem permissao para esta acao.' }
  return {}
}

export async function criarFuncionario(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await exigir(PERMISSIONS.equipeCadastrar)
  if (guard.error) return guard

  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').replace(/\D/g, '')
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const presetId = String(formData.get('preset_id') ?? '')

  if (!name || !email || password.length < 8) {
    return { error: 'Preencha nome, e-mail e uma senha de pelo menos 8 caracteres.' }
  }
  if (!presetId) return { error: 'Escolha um perfil base.' }

  const supabase = await createClient()

  // Quem nao pode criar administrador nao escolhe o preset de administrador.
  const staff = await getStaff()
  const { data: preset } = await supabase
    .from('permission_presets')
    .select('id, slug')
    .eq('id', presetId)
    .maybeSingle()

  if (!preset) return { error: 'Perfil base invalido.' }
  if (preset.slug === 'administrador' && !staff?.permissions.has(PERMISSIONS.equipeCadastrarAdmin)) {
    return { error: 'Voce nao pode cadastrar um administrador.' }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor.' }
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError || !created.user) {
    return { error: authError?.message ?? 'Nao foi possivel criar a conta de acesso.' }
  }

  // Insercao pelo cliente do usuario logado: a RLS confere equipe.cadastrar.
  const { error: profileError } = await supabase.from('profiles').insert({
    id: created.user.id,
    name,
    phone: phone || null,
    preset_id: presetId,
    is_active: true,
    created_by: staff?.profile.id ?? null,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: profileError.message }
  }

  revalidatePath('/painel/equipe')
  redirect(`/painel/equipe/${created.user.id}`)
}

export async function salvarDadosFuncionario(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await exigir(PERMISSIONS.equipeEditar)
  if (guard.error) return guard

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').replace(/\D/g, '')
  if (!id || !name) return { error: 'Informe o nome.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ name, phone: phone || null })
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: BLOQUEADO }

  revalidatePath('/painel/equipe')
  return { ok: 'Dados salvos.' }
}

export async function alterarAtivacao(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await exigir(PERMISSIONS.equipeDesativar)
  if (guard.error) return guard

  const id = String(formData.get('id') ?? '')
  const ativar = String(formData.get('ativar') ?? '') === '1'

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: ativar })
    .eq('id', id)
    .select('id')

  // Trava do banco: nunca deixar o sistema sem administrador ativo.
  if (error) {
    return {
      error: error.message.includes('sem nenhum administrador')
        ? 'Nao da para desativar: o sistema ficaria sem administrador ativo.'
        : error.message,
    }
  }
  if (!data?.length) return { error: BLOQUEADO }

  revalidatePath('/painel/equipe')
  return { ok: ativar ? 'Funcionario reativado.' : 'Funcionario desativado.' }
}

export async function salvarPermissoes(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await exigir(PERMISSIONS.equipeAlterarPermissoes)
  if (guard.error) return guard

  const id = String(formData.get('id') ?? '')
  const presetId = String(formData.get('preset_id') ?? '')
  const codes = formData.getAll('codes').map(String)

  if (!id || !presetId) return { error: 'Escolha o perfil base.' }

  const supabase = await createClient()
  // Toda a regra (anti-escalada e trava do ultimo admin) esta dentro da RPC.
  const { error } = await supabase.rpc('set_user_permissions', {
    p_user_id: id,
    p_preset_id: presetId,
    p_codes: codes,
  })

  if (error) return { error: error.message }

  revalidatePath('/painel/equipe')
  revalidatePath(`/painel/equipe/${id}`)
  return { ok: 'Permissoes atualizadas.' }
}
