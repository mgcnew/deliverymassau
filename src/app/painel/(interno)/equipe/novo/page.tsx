import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { NovoFuncionarioForm } from './novo-form'

export const metadata = { title: 'Novo funcionario | Mercado Massa 24h' }

export default async function NovoFuncionarioPage() {
  const staff = await requirePermission(PERMISSIONS.equipeCadastrar)
  const supabase = await createClient()

  const { data } = await supabase
    .from('permission_presets')
    .select('id, name, description, slug')
    .eq('is_active', true)
    .order('sort_order')

  // Sem equipe.cadastrar_admin, o preset de administrador nem aparece.
  const presets = (data ?? []).filter(
    (p) => p.slug !== 'administrador' || staff.permissions.has(PERMISSIONS.equipeCadastrarAdmin),
  )

  return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-black">Novo funcionario</h1>
      <Card>
        <NovoFuncionarioForm presets={presets} />
      </Card>
    </div>
  )
}
