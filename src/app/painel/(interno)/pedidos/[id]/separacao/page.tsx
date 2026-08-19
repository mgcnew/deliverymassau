import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Alert, Card } from '@/components/ui/card'
import type { OrderItem } from '@/lib/types'
import { BarraConcluir } from './concluir'
import { ItemSeparacao } from './item-separacao'

export const metadata = { title: 'Separacao | Mercado Massa 24h' }

export default async function SeparacaoPage({
  params,
}: PageProps<'/painel/pedidos/[id]/separacao'>) {
  const { id } = await params
  const staff = await requirePermission(PERMISSIONS.pedidosSeparar)
  const supabase = await createClient()

  const [{ data: pedido }, { data: itens }, { data: config }] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).maybeSingle(),
    supabase.from('order_items').select('*').eq('order_id', id).order('created_at'),
    supabase.from('settings').select('weight_tolerance_pct').eq('id', 1).maybeSingle(),
  ])

  if (!pedido) notFound()
  // Pedido ja separado ou cancelado: volta para a tela do pedido em vez de deixar editar.
  if (pedido.status !== 'separando') redirect(`/painel/pedidos/${id}`)

  const lista = (itens ?? []) as OrderItem[]
  const pendentes = lista.filter((i) => i.item_status === 'pendente').length

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div>
        <Link href={`/painel/pedidos/${id}`} className="text-sm font-semibold text-muted">
          &lsaquo; Pedido #{pedido.order_number}
        </Link>
        <h1 className="text-2xl font-black">Separacao do #{pedido.order_number}</h1>
        <p className="text-muted">
          {pedido.customer_name} - {pedido.address_district}
        </p>
      </div>

      {pedido.customer_note ? (
        <Alert>Observacao do cliente: {pedido.customer_note}</Alert>
      ) : null}

      <ul className="space-y-3">
        {lista.map((item) => (
          <ItemSeparacao
            key={item.id}
            orderId={id}
            item={item}
            toleranciaPct={Number(config?.weight_tolerance_pct ?? 30)}
            podeAjustarPeso={staff.permissions.has(PERMISSIONS.pedidosAjustarPeso)}
            podeMarcarFalta={staff.permissions.has(PERMISSIONS.pedidosMarcarIndisponivel)}
          />
        ))}
      </ul>

      <Card className="text-sm text-muted">
        Peso e digitado em gramas: 1087 vira 1,087 kg. O valor do item e do pedido sao recalculados
        pelo banco a cada confirmacao.
      </Card>

      <BarraConcluir
        orderId={id}
        pendentes={pendentes}
        total={Number(pedido.total)}
        estimado={Number(pedido.items_subtotal_estimated) + Number(pedido.delivery_fee)}
      />
    </div>
  )
}
