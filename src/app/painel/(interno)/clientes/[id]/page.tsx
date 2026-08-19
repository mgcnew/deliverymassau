import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardTitle, Empty } from '@/components/ui/card'
import { dataHora, moeda, telefone } from '@/lib/format'
import { ORDER_STATUS } from '@/lib/orders/status'
import { linkWhatsapp } from '@/lib/orders/navegacao'
import type { OrderStatus } from '@/lib/types'

export const metadata = { title: 'Cliente | Mercado Massa 24h' }

export default async function ClientePage({ params }: PageProps<'/painel/clientes/[id]'>) {
  const { id } = await params
  const staff = await requirePermission(PERMISSIONS.clientesVer)
  const supabase = await createClient()

  const [{ data: cliente }, { data: enderecos }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('customer_addresses')
      .select('street, number, district, complement, reference, cep, created_at')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  if (!cliente) notFound()

  // Historico de pedidos so para quem tambem pode ver pedidos.
  const podeVerPedidos = staff.permissions.has(PERMISSIONS.pedidosVer)
  const { data: pedidos } = podeVerPedidos
    ? await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: null }

  const ultimo = enderecos?.[0]

  return (
    <div className="w-full space-y-4">
      <div>
        <Link href="/painel/clientes" className="text-sm font-semibold text-muted">
          &lsaquo; Clientes
        </Link>
        <h1 className="text-2xl font-black">{cliente.name}</h1>
        <a
          href={linkWhatsapp(cliente.phone)}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand underline"
        >
          {telefone(cliente.phone)}
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm font-semibold text-muted">Pedidos entregues</p>
          <p className="text-3xl font-black">{cliente.orders_count}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-muted">Total comprado</p>
          <p className="text-3xl font-black">{moeda(Number(cliente.total_spent))}</p>
        </Card>
      </div>

      <Card>
        <CardTitle>Historico</CardTitle>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Primeira compra</dt>
            <dd className="font-semibold">{dataHora(cliente.first_order_at)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Ultima compra</dt>
            <dd className="font-semibold">{dataHora(cliente.last_order_at)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Ticket medio</dt>
            <dd className="font-semibold">
              {cliente.orders_count > 0
                ? moeda(Number(cliente.total_spent) / cliente.orders_count)
                : '-'}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardTitle>Ultimo endereco</CardTitle>
        {!ultimo ? (
          <Empty>Nenhum endereco registrado.</Empty>
        ) : (
          <>
            <p className="font-semibold">
              {ultimo.street}, {ultimo.number}
              {ultimo.complement ? ` - ${ultimo.complement}` : ''}
            </p>
            <p>{ultimo.district}</p>
            {ultimo.reference ? <p className="text-muted">Ref: {ultimo.reference}</p> : null}
            {ultimo.cep ? <p className="text-muted">CEP {ultimo.cep}</p> : null}

            {enderecos && enderecos.length > 1 ? (
              <p className="mt-3 text-sm text-muted">
                Ja pediu de {enderecos.length} enderecos diferentes.
              </p>
            ) : null}
          </>
        )}
      </Card>

      {podeVerPedidos ? (
        <Card>
          <CardTitle>Pedidos</CardTitle>
          {!pedidos?.length ? (
            <Empty>Nenhum pedido ainda.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {pedidos.map((p) => {
                const status = ORDER_STATUS[p.status as OrderStatus]
                return (
                  <li key={p.id}>
                    <Link
                      href={`/painel/pedidos/${p.id}`}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-bold">#{p.order_number}</p>
                        <p className="text-sm text-muted">{dataHora(p.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${status.tone}`}>
                          {status.short}
                        </span>
                        <span className="font-bold">{moeda(Number(p.total))}</span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  )
}
