import { notFound } from 'next/navigation'
import { LinkVoltar } from '@/components/ui/link-voltar'

import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardTitle } from '@/components/ui/card'
import { DadosForm } from './dados-form'
import { PermissoesForm, type PresetInfo } from './permissoes-form'

export const metadata = { title: 'Funcionario | Mercado Massa 24h' }

export default async function FuncionarioPage({ params }: PageProps<'/painel/equipe/[id]'>) {
  const { id } = await params
  const staff = await requirePermission(PERMISSIONS.equipeVer)
  const supabase = await createClient()

  const { data: perfil } = await supabase
    .from('profiles')
    .select('id, name, phone, is_active, preset_id, last_seen_at')
    .eq('id', id)
    .maybeSingle()

  if (!perfil) notFound()

  const [{ data: permissions }, { data: presets }, { data: presetCodes }, { data: overrides }] =
    await Promise.all([
      supabase.from('permissions').select('code, module, label, description').order('sort_order'),
      supabase
        .from('permission_presets')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('preset_permissions').select('preset_id, permission_code'),
      supabase.from('user_permissions').select('permission_code, granted').eq('user_id', id),
    ])

  const presetsInfo: PresetInfo[] = (presets ?? []).map((p) => ({
    ...p,
    codes: (presetCodes ?? [])
      .filter((pc) => pc.preset_id === p.id)
      .map((pc) => pc.permission_code),
  }))

  // Efetivas = preset UNIAO concedidas MENOS revogadas (mesma regra do banco).
  const doPreset = new Set(presetsInfo.find((p) => p.id === perfil.preset_id)?.codes ?? [])
  for (const o of overrides ?? []) {
    if (o.granted) doPreset.add(o.permission_code)
    else doPreset.delete(o.permission_code)
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <LinkVoltar href="/painel/equipe">Equipe</LinkVoltar>
        <h1 className="text-2xl font-black">{perfil.name}</h1>
        <p className="text-muted">
          {perfil.is_active ? 'Ativo' : 'Inativo'}
          {perfil.last_seen_at
            ? ` - ultimo acesso em ${new Date(perfil.last_seen_at).toLocaleString('pt-BR')}`
            : ' - nunca acessou'}
        </p>
      </div>

      <Card>
        <CardTitle>Dados</CardTitle>
        <DadosForm
          id={perfil.id}
          name={perfil.name}
          phone={perfil.phone}
          ativo={perfil.is_active}
          podeEditar={staff.permissions.has(PERMISSIONS.equipeEditar)}
          podeAtivar={staff.permissions.has(PERMISSIONS.equipeDesativar)}
        />
      </Card>

      <Card>
        <CardTitle>Permissoes</CardTitle>
        <PermissoesForm
          userId={perfil.id}
          presets={presetsInfo}
          permissions={permissions ?? []}
          presetIdAtual={perfil.preset_id}
          efetivas={[...doPreset]}
          doAtor={[...staff.permissions]}
          somenteLeitura={!staff.permissions.has(PERMISSIONS.equipeAlterarPermissoes)}
        />
      </Card>
    </div>
  )
}
