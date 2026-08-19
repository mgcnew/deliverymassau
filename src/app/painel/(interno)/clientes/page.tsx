import Link from 'next/link'

import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardTitle, Empty } from '@/components/ui/card'
import { dataHora, moeda, telefone } from '@/lib/format'

export const metadata = { title: 'Clientes | Mercado Massa 24h' }

export default async function ClientesPage({ searchParams }: PageProps<'/painel/clientes'>) {
  await requirePermission(PERMISSIONS.clientesVer)
  const params = await searchParams
  const busca = typeof params.q === 'string' ? params.q.trim() : ''

  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('id, name, phone, orders_count, total_spent, first_order_at, last_order_at')
    .order('last_order_at', { ascending: false, nullsFirst: false })
    .limit(100)

  // Telefone e a referencia principal: busca por digitos cai direto nele.
  if (busca) {
    const digitos = busca.replace(/\D/g, '')
    query = digitos.length >= 3 ? query.ilike('phone', `%${digitos}%`) : query.ilike('name', `%${busca}%`)
  }

  const { data: clientes } = await query

  return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-black">Clientes</h1>

      <form className="flex gap-2 lg:max-w-xl" action="/painel/clientes">
        <input
          name="q"
          defaultValue={busca}
          placeholder="Buscar por nome ou telefone"
          className="h-12 flex-1 rounded-xl border border-line bg-surface px-3 text-base"
        />
        <button className="h-12 rounded-xl border border-line bg-surface px-4 font-semibold">
          Buscar
        </button>
      </form>

      <Card>
        <CardTitle>
          {clientes?.length ?? 0} {clientes?.length === 1 ? 'cliente' : 'clientes'}
        </CardTitle>

        {!clientes?.length ? (
          <Empty>
            {busca
              ? 'Ninguem encontrado com esse nome ou telefone.'
              : 'Os clientes aparecem aqui automaticamente conforme fazem pedidos.'}
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {clientes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/painel/clientes/${c.id}`}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-sm text-muted">
                      {telefone(c.phone)} - ultimo pedido {dataHora(c.last_order_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold">{moeda(Number(c.total_spent))}</p>
                    <p className="text-sm text-muted">
                      {c.orders_count} {c.orders_count === 1 ? 'entregue' : 'entregues'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-sm text-muted">
        O cadastro nasce do proprio pedido: o telefone e a chave, entao o mesmo cliente nao vira
        dois registros. Contagem e total consideram pedidos entregues.
      </p>
    </div>
  )
}
