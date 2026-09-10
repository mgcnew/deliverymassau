import Link from 'next/link'

import { Card } from '@/components/ui/card'
import { ORDER_STATUS } from '@/lib/orders/status'
import type { OrderStatus } from '@/lib/types'

/**
 * "O que eu faco primeiro?" - a resposta que a pagina inicial nao dava.
 *
 * Lista os pedidos em andamento pelo tempo parado na etapa ATUAL (nao desde
 * que o pedido foi feito): um pedido de 40 min que acabou de ficar pronto nao
 * e urgente; um que esta ha 20 min esperando entregador e.
 *
 * Quem passou do tempo aceitavel da etapa vem primeiro, e em vermelho.
 */

export type PedidoEmAndamento = {
  id: string
  order_number: number
  status: OrderStatus
  customer_name: string
  address_district: string | null
  /** Ha quantos minutos o pedido esta na etapa em que esta agora. */
  minutos_na_etapa: number
}

// Minutos que cada etapa pode levar antes de o pedido virar "atrasado".
// Referencia inicial, para ajustar com a pratica do mercado.
const TEMPO_ACEITAVEL: Partial<Record<OrderStatus, number>> = {
  recebido: 5,
  separando: 20,
  aguardando_entregador: 15,
  saiu_para_entrega: 45,
}

const MOSTRAR = 5

function tempoParado(minutos: number) {
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `${minutos} min`
  if (minutos < 24 * 60) {
    return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`
  }
  const dias = Math.floor(minutos / (24 * 60))
  return dias === 1 ? '1 dia' : `${dias} dias`
}

export function PrecisaDeAtencao({ pedidos }: { pedidos: PedidoEmAndamento[] }) {
  const linhas = pedidos
    .map((p) => {
      const minutos = p.minutos_na_etapa
      const limite = TEMPO_ACEITAVEL[p.status] ?? Infinity
      return { ...p, minutos, atrasado: minutos > limite, folga: minutos - limite }
    })
    // Mais atrasado em relacao ao tempo da propria etapa vem primeiro.
    .sort((a, b) => b.folga - a.folga)

  const atrasados = linhas.filter((l) => l.atrasado).length

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-black">Precisa de atencao</h2>
        {atrasados > 0 ? (
          <span className="text-sm font-bold text-[var(--tone-error-fg)]">
            {atrasados} {atrasados === 1 ? 'atrasado' : 'atrasados'}
          </span>
        ) : null}
      </div>

      {linhas.length === 0 ? (
        <Card className="text-muted">Nenhum pedido em andamento agora.</Card>
      ) : (
        // Nao e <Card>: o p-4 dele venceria um p-0 aqui, e a lista precisa
        // ir de borda a borda para cada linha ser uma area de toque inteira.
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {linhas.slice(0, MOSTRAR).map((l) => (
              <li key={l.id}>
                <Link
                  href={`/painel/pedidos/${l.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-foreground/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black">#{l.order_number}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-bold ${ORDER_STATUS[l.status].tone}`}
                      >
                        {ORDER_STATUS[l.status].label}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted">
                      {l.customer_name}
                      {l.address_district ? ` - ${l.address_district}` : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`text-lg font-black tabular-nums ${
                        l.atrasado ? 'text-[var(--tone-error-fg)]' : ''
                      }`}
                    >
                      {tempoParado(l.minutos)}
                    </p>
                    <p className="text-xs text-muted">{l.atrasado ? 'atrasado' : 'nesta etapa'}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {linhas.length > MOSTRAR ? (
            <Link
              href="/painel/pedidos"
              className="block border-t border-line px-4 py-3 text-center text-sm font-bold text-brand"
            >
              Ver todos os {linhas.length} pedidos em andamento
            </Link>
          ) : null}
        </div>
      )}
    </section>
  )
}
