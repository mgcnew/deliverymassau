import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PainelPedidos } from './painel-pedidos'
import type { PedidoOperacional } from './tipos'

export const metadata = { title: 'Pedidos | Mercado Massa 24h' }

const CAMPOS =
  'id, order_number, status, created_at, customer_name, customer_phone, address_district, total, payment_method, needs_change, change_amount, delivery_person_id, order_items(count)'

type LinhaPedido = Omit<PedidoOperacional, 'itens'> & { order_items: Array<{ count: number }> }

export default async function PedidosPage() {
  const staff = await requirePermission(PERMISSIONS.pedidosVer)
  const supabase = await createClient()

  const [{ data: abertos }, { data: fechados }] = await Promise.all([
    supabase
      .from('orders')
      .select(CAMPOS)
      .in('status', ['recebido', 'separando', 'aguardando_entregador', 'saiu_para_entrega'])
      .order('created_at'),
    supabase
      .from('orders')
      .select(CAMPOS)
      .in('status', ['entregue', 'cancelado'])
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const mapear = (linhas: LinhaPedido[] | null): PedidoOperacional[] =>
    (linhas ?? []).map(({ order_items, ...resto }) => ({
      ...resto,
      itens: order_items?.[0]?.count ?? 0,
    }))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Pedidos</h1>
      <PainelPedidos
        pedidos={mapear(abertos as LinhaPedido[] | null)}
        finalizados={mapear(fechados as LinhaPedido[] | null)}
        podeSeparar={staff.permissions.has(PERMISSIONS.pedidosSeparar)}
        podeImprimir={staff.permissions.has(PERMISSIONS.pedidosImprimir)}
      />
    </div>
  )
}
