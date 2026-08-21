import Link from 'next/link'

import { LinkVoltar } from '@/components/ui/link-voltar'
import { notFound } from 'next/navigation'

import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { getMercado } from '@/lib/painel/mercado'
import { createClient } from '@/lib/supabase/server'
import { Card, CardTitle, Empty } from '@/components/ui/card'
import { dataHora, moeda, telefone } from '@/lib/format'
import { ORDER_STATUS } from '@/lib/orders/status'
import { linkWhatsapp } from '@/lib/orders/navegacao'
import type { OrderStatus } from '@/lib/types'
import { CompartilharLoja } from '../../compartilhar-loja'
import { AcoesCliente } from './acoes-cliente'
import { BotaoNotaWhatsapp } from './botao-nota-whatsapp'

export const metadata = { title: 'Cliente | Mercado Massa 24h' }

export default async function ClientePage({ params }: PageProps<'/painel/clientes/[id]'>) {
  const { id } = await params
  const staff = await requirePermission(PERMISSIONS.clientesVer)
  const supabase = await createClient()

  const [{ data: cliente }, { data: enderecos }, config] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('customer_addresses')
      .select('street, number, district, complement, reference, cep, created_at')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(3),
    // Ja veio do layout neste mesmo request: o cache() devolve sem ir ao banco.
    getMercado(),
  ])

  if (!cliente) notFound()

  const nomeMercado = config?.market_name ?? 'Mercado Massa 24h'
  const enderecoMercado =
    [config?.market_address, config?.market_city].filter(Boolean).join(', ') || null

  // Historico de pedidos so para quem tambem pode ver pedidos.
  const podeVerPedidos = staff.permissions.has(PERMISSIONS.pedidosVer)
  const podeImprimir = staff.permissions.has(PERMISSIONS.pedidosImprimir)
  const { data: pedidos } = podeVerPedidos
    ? await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at, public_token')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: null }

  const ultimo = enderecos?.[0]

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <LinkVoltar href="/painel/clientes">Clientes</LinkVoltar>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black">{cliente.name}</h1>
            {cliente.is_blocked ? (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-900 dark:bg-rose-900/50 dark:text-rose-200">
                Bloqueado
              </span>
            ) : null}
          </div>
          <a
            href={linkWhatsapp(cliente.phone)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand underline"
          >
            {telefone(cliente.phone)}
          </a>
        </div>

        <CompartilharLoja
          nomeMercado={nomeMercado}
          endereco={enderecoMercado}
          telefoneCliente={cliente.phone}
          nomeCliente={cliente.name}
          rotulo="Convidar cliente"
        />
      </div>

      {staff.permissions.has(PERMISSIONS.clientesBloquear) ? (
        <AcoesCliente
          id={cliente.id}
          bloqueado={cliente.is_blocked}
          motivo={cliente.blocked_reason}
          bloqueadoEm={cliente.blocked_at}
        />
      ) : null}

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
                  <li key={p.id} className="flex items-center gap-1">
                    <Link
                      href={`/painel/pedidos/${p.id}`}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3"
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
                    {podeImprimir ? (
                      <BotaoNotaWhatsapp
                        telefone={cliente.phone}
                        nomeCliente={cliente.name}
                        nomeMercado={nomeMercado}
                        numeroPedido={p.order_number}
                        token={p.public_token}
                      />
                    ) : null}
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
