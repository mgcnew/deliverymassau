import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Alert, Card } from '@/components/ui/card'
import { moeda, quantidade as formatarQuantidade } from '@/lib/format'
import { ORDER_STATUS, ORDER_STATUS_FLOW } from '@/lib/orders/status'
import { createClient } from '@/lib/supabase/server'
import type { OrderStatus, PaymentMethod, UnitType } from '@/lib/types'
import { GuardarPedido } from './guardar-pedido'

export const metadata = { title: 'Meu pedido | Mercado Massa 24h' }

type ItemPedido = {
  product_name: string
  unit_type: UnitType
  sold_by_weight: boolean
  unit_price: number
  requested_quantity: number
  weighed_quantity: number | null
  estimated_total: number
  final_total: number
  item_status: 'pendente' | 'separado' | 'indisponivel'
  note: string | null
}

type PedidoPublico = {
  order_number: number
  status: OrderStatus
  created_at: string
  customer_name: string
  address: {
    street: string
    number: string
    district: string
    complement: string | null
    reference: string | null
  }
  items_subtotal_estimated: number
  items_subtotal_final: number
  delivery_fee: number
  total: number
  payment_method: PaymentMethod
  needs_change: boolean
  change_for: number | null
  change_amount: number | null
  customer_note: string | null
  cancel_reason: string | null
  items: ItemPedido[]
}

const PAGAMENTO: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  debito: 'Cartao de debito',
  credito: 'Cartao de credito',
}

export default async function PedidoPage({ params, searchParams }: PageProps<'/pedido/[token]'>) {
  const { token } = await params
  const query = await searchParams

  const supabase = await createClient()
  const { data } = await supabase.rpc('get_order_by_token', { p_token: token })
  const pedido = data as PedidoPublico | null

  if (!pedido) notFound()

  const cancelado = pedido.status === 'cancelado'
  const etapaAtual = ORDER_STATUS_FLOW.indexOf(pedido.status)
  const temPeso = pedido.items.some((i) => i.sold_by_weight)
  const jaPesado = pedido.items.some((i) => i.weighed_quantity !== null)

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <GuardarPedido token={token} numero={pedido.order_number} />

      {query.novo ? (
        <Alert tone="success">
          Pedido recebido! Guarde este link: ele acompanha seu pedido ate a entrega.
        </Alert>
      ) : null}

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Seu pedido</p>
        <h1 className="text-3xl font-black">#{pedido.order_number}</h1>
        <p className="text-muted">
          Feito em {new Date(pedido.created_at).toLocaleString('pt-BR')}
        </p>
      </div>

      <Card className="space-y-3">
        {cancelado ? (
          <Alert tone="error">
            Pedido cancelado{pedido.cancel_reason ? `: ${pedido.cancel_reason}` : '.'}
          </Alert>
        ) : (
          <ol className="space-y-2">
            {ORDER_STATUS_FLOW.map((status, i) => {
              const feito = i <= etapaAtual
              return (
                <li key={status} className="flex items-center gap-3">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      feito ? 'bg-brand text-brand-foreground' : 'bg-black/10 text-muted'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={feito ? 'font-bold' : 'text-muted'}>
                    {ORDER_STATUS[status].label}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Itens</h2>
        <ul className="divide-y divide-line">
          {pedido.items.map((item, i) => (
            <li key={i} className="space-y-0.5 py-3">
              <div className="flex justify-between gap-3">
                <p
                  className={`font-semibold ${
                    item.item_status === 'indisponivel' ? 'text-muted line-through' : ''
                  }`}
                >
                  {item.product_name}
                </p>
                <p className="shrink-0 font-bold">
                  {item.item_status === 'indisponivel' ? '-' : moeda(Number(item.final_total))}
                </p>
              </div>

              {item.sold_by_weight ? (
                <p className="text-sm text-muted">
                  Pedido: {formatarQuantidade(Number(item.requested_quantity), true, item.unit_type)}
                  {item.weighed_quantity !== null
                    ? ` - separado: ${formatarQuantidade(
                        Number(item.weighed_quantity),
                        true,
                        item.unit_type,
                      )}`
                    : ' - aguardando pesagem'}{' '}
                  a {moeda(Number(item.unit_price))}/kg
                </p>
              ) : (
                <p className="text-sm text-muted">
                  {formatarQuantidade(Number(item.requested_quantity), false, item.unit_type)} ×{' '}
                  {moeda(Number(item.unit_price))}
                </p>
              )}

              {item.note ? <p className="text-sm text-muted">Obs: {item.note}</p> : null}
              {item.item_status === 'indisponivel' ? (
                <p className="text-sm font-semibold text-rose-700">Acabou - retirado do pedido</p>
              ) : null}
            </li>
          ))}
        </ul>

        <dl className="space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Produtos</dt>
            <dd>{moeda(Number(pedido.items_subtotal_final))}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Taxa de entrega</dt>
            <dd>{moeda(Number(pedido.delivery_fee))}</dd>
          </div>
          <div className="flex justify-between text-lg font-black">
            <dt>Total</dt>
            <dd>{moeda(Number(pedido.total))}</dd>
          </div>
        </dl>

        {temPeso ? (
          <p className="text-sm text-muted">
            {jaPesado
              ? 'Valor final ja calculado com o peso real da balanca.'
              : 'Valor estimado. Itens por peso sao recalculados na separacao.'}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-1">
        <h2 className="text-lg font-bold">Entrega e pagamento</h2>
        <p className="text-sm">
          {pedido.address.street}, {pedido.address.number}
          {pedido.address.complement ? ` - ${pedido.address.complement}` : ''} -{' '}
          {pedido.address.district}
        </p>
        {pedido.address.reference ? (
          <p className="text-sm text-muted">Ref: {pedido.address.reference}</p>
        ) : null}
        <p className="pt-2 text-sm">
          Pagamento na entrega: <strong>{PAGAMENTO[pedido.payment_method]}</strong>
        </p>
        {pedido.needs_change && pedido.change_for ? (
          <p className="text-sm">
            Troco para {moeda(Number(pedido.change_for))} - levar{' '}
            {moeda(Number(pedido.change_amount ?? 0))}
          </p>
        ) : null}
        {pedido.customer_note ? (
          <p className="pt-2 text-sm text-muted">Observacao: {pedido.customer_note}</p>
        ) : null}
      </Card>

      <div className="flex gap-2">
        <Link
          href="/"
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-line bg-surface font-semibold"
        >
          Voltar a loja
        </Link>
        <Link
          href="/meus-pedidos"
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-line bg-surface font-semibold"
        >
          Meus pedidos
        </Link>
      </div>
    </main>
  )
}
