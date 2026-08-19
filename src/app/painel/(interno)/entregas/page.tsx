import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { EntregasCliente } from './entregas-cliente'
import { CAMPOS_ENTREGA, type EntregaCard } from './tipos'

export const metadata = { title: 'Entregas | Mercado Massa 24h' }

export default async function EntregasPage() {
  const staff = await requirePermission(PERMISSIONS.entregasVer)
  const supabase = await createClient()

  const [{ data: disponiveis }, { data: minhas }, { data: config }] = await Promise.all([
    supabase
      .from('orders')
      .select(CAMPOS_ENTREGA)
      .eq('status', 'aguardando_entregador')
      .is('delivery_person_id', null)
      .order('created_at'),
    supabase
      .from('orders')
      .select(CAMPOS_ENTREGA)
      .eq('delivery_person_id', staff.profile.id)
      .in('status', ['aguardando_entregador', 'saiu_para_entrega'])
      .order('created_at'),
    supabase.from('settings').select('market_city').eq('id', 1).maybeSingle(),
  ])

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <h1 className="text-2xl font-black">Entregas</h1>

      <EntregasCliente
        disponiveis={(disponiveis ?? []) as EntregaCard[]}
        minhas={(minhas ?? []) as EntregaCard[]}
        cidade={config?.market_city ?? null}
        permissoes={{
          assumir: staff.permissions.has(PERMISSIONS.entregasAssumir),
          iniciar: staff.permissions.has(PERMISSIONS.entregasIniciar),
          finalizar: staff.permissions.has(PERMISSIONS.entregasFinalizar),
        }}
      />
    </div>
  )
}
