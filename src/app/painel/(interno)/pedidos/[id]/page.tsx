import { LinkVoltar } from '@/components/ui/link-voltar'
import { notFound } from 'next/navigation'

import { PERMISSIONS } from '@/lib/permissions'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardTitle } from '@/components/ui/card'
import { moeda, quantidade as formatarQuantidade } from '@/lib/format'
import { ORDER_STATUS } from '@/lib/orders/status'
import type { OrderStatus, PaymentMethod, UnitType } from '@/lib/types'
import { PAGAMENTO_CURTO } from '../tipos'
import { AcoesPedido } from './acoes-pedido'

export const metadata = { title: 'Pedido | Mercado Massa 24h' }

export default async function PedidoDetalhePage({ params }: PageProps<'/painel/pedidos/[id]'>) {
  const { id } = await params
  // Nao exige pedidos.ver: quem enxerga o pedido e a RLS. Assim o entregador
  // abre os itens da entrega que assumiu sem precisar da permissao do balcao.
  const staff = await requireStaff()
  const supabase = await createClient()

  const [{ data: pedido }, { data: itens }, { data: historico }] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).maybeSingle(),
    supabase.from('order_items').select('*').eq('order_id', id).order('created_at'),
    supabase
      .from('order_status_history')
      .select('from_status, to_status, created_at, note, changed_by, profiles(name)')
      .eq('order_id', id)
      .order('created_at'),
  ])

  if (!pedido) notFound()

  const status = ORDER_STATUS[pedido.status as OrderStatus]
  const whatsapp = `https://wa.me/55${pedido.customer_phone}`

  return (
    <div className="w-full space-y-4">
      <div>
        <LinkVoltar href="/painel/pedidos">Pedidos</LinkVoltar>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black">#{pedido.order_number}</h1>
          <span className={`rounded-full border px-3 py-1 text-sm font-bold ${status.tone}`}>
            {status.label}
          </span>
        </div>
        <p className="text-muted">{new Date(pedido.created_at).toLocaleString('pt-BR')}</p>
      </div>

      <Card>
        <AcoesPedido
          orderId={pedido.id}
          status={pedido.status as OrderStatus}
          podeSeparar={staff.permissions.has(PERMISSIONS.pedidosSeparar)}
          podeCancelar={staff.permissions.has(PERMISSIONS.pedidosCancelar)}
          podeImprimir={staff.permissions.has(PERMISSIONS.pedidosImprimir)}
        />
      </Card>

      <Card>
        <CardTitle>Cliente</CardTitle>
        <p className="text-lg font-bold">{pedido.customer_name}</p>
        <a href={whatsapp} className="font-semibold text-brand underline" target="_blank" rel="noreferrer">
          {pedido.customer_phone}
        </a>
        <p className="pt-2">
          {pedido.address_street}, {pedido.address_number}
          {pedido.address_complement ? ` - ${pedido.address_complement}` : ''}
        </p>
        <p className="font-semibold">{pedido.address_district}</p>
        {pedido.address_reference ? (
          <p className="text-muted">Ref: {pedido.address_reference}</p>
        ) : null}
        {pedido.customer_note ? (
          <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2 font-semibold text-amber-900">
            {pedido.customer_note}
          </p>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Itens</CardTitle>
        <ul className="divide-y divide-line">
          {(itens ?? []).map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-3">
              <div className="min-w-0">
                <p
                  className={`font-semibold ${
                    item.item_status === 'indisponivel' ? 'text-muted line-through' : ''
                  }`}
                >
                  {item.product_name}
                </p>
                <p className="text-sm text-muted">
                  {item.sold_by_weight
                    ? `pedido ${formatarQuantidade(Number(item.requested_quantity), true, item.unit_type as UnitType)}${
                        item.weighed_quantity !== null
                          ? ` - pesado ${formatarQuantidade(Number(item.weighed_quantity), true, item.unit_type as UnitType)}`
                          : ' - sem pesagem'
                      }`
                    : formatarQuantidade(Number(item.requested_quantity), false, item.unit_type as UnitType)}
                  {' a '}
                  {moeda(Number(item.unit_price))}
                </p>
                {item.note ? <p className="text-sm font-semibold">Obs: {item.note}</p> : null}
                {item.item_status === 'indisponivel' ? (
                  <p className="text-sm font-bold text-rose-700">EM FALTA - retirado do pedido</p>
                ) : null}
              </div>
              <p className="shrink-0 font-bold">{moeda(Number(item.final_total))}</p>
            </li>
          ))}
        </ul>

        <dl className="space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Produtos</dt>
            <dd>{moeda(Number(pedido.items_subtotal_final))}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Taxa de entrega ({pedido.zone_name ?? '-'})</dt>
            <dd>{moeda(Number(pedido.delivery_fee))}</dd>
          </div>
          <div className="flex justify-between text-lg font-black">
            <dt>Total</dt>
            <dd>{moeda(Number(pedido.total))}</dd>
          </div>
          <div className="flex justify-between pt-2">
            <dt>Pagamento</dt>
            <dd className="font-bold">{PAGAMENTO_CURTO[pedido.payment_method as PaymentMethod]}</dd>
          </div>
          {pedido.needs_change ? (
            <div className="flex justify-between">
              <dt>Troco para {moeda(Number(pedido.change_for))}</dt>
              <dd className="font-bold">levar {moeda(Number(pedido.change_amount ?? 0))}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card>
        <CardTitle>Historico</CardTitle>
        <ol className="space-y-2">
          {(historico ?? []).map((h, i) => {
            const autor = h.profiles as unknown as { name: string } | null
            return (
              <li key={i} className="flex justify-between gap-3 text-sm">
                <span>
                  <span className="font-semibold">{ORDER_STATUS[h.to_status as OrderStatus].label}</span>
                  {autor?.name ? <span className="text-muted"> por {autor.name}</span> : null}
                  {h.note ? <span className="block text-muted">{h.note}</span> : null}
                </span>
                <span className="shrink-0 text-muted">
                  {new Date(h.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}
