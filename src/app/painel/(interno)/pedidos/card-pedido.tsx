'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { moeda } from '@/lib/format'
import { ORDER_STATUS } from '@/lib/orders/status'
import { iniciarSeparacao } from './actions'
import { PAGAMENTO_CURTO, tempoRelativo, type PedidoOperacional } from './tipos'

export function CardPedido({
  pedido,
  podeSeparar,
}: {
  pedido: PedidoOperacional
  podeSeparar: boolean
}) {
  const router = useRouter()
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const novo = pedido.status === 'recebido'
  const status = ORDER_STATUS[pedido.status]

  return (
    <article
      className={`space-y-2 rounded-2xl border bg-surface p-3 ${
        novo ? 'border-brand shadow-[0_0_0_3px_rgba(214,31,43,0.12)]' : 'border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/painel/pedidos/${pedido.id}`} className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-black leading-tight">
            #{pedido.order_number}
            {novo ? (
              <span className="size-2.5 animate-pulse rounded-full bg-brand" aria-label="novo" />
            ) : null}
          </p>
          <p className="truncate text-sm font-semibold">{pedido.customer_name}</p>
          <p className="truncate text-sm text-muted">{pedido.address_district ?? 'sem bairro'}</p>
        </Link>

        <div className="shrink-0 text-right">
          <p className="font-black">{moeda(Number(pedido.total))}</p>
          <p className="text-xs text-muted">{tempoRelativo(pedido.created_at)}</p>
        </div>
      </div>

      {/* Status centralizado sozinho: alinha embaixo do titulo centralizado
          da coluna no quadro do desktop, sem depender de quantas outras
          etiquetas o pedido tem. */}
      <div className="flex justify-center">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${status.tone}`}>
          {status.short}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-bold">
        <span className="rounded-full bg-black/5 px-2 py-0.5">
          {pedido.itens} {pedido.itens === 1 ? 'item' : 'itens'}
        </span>
        <span className="rounded-full bg-black/5 px-2 py-0.5">
          {PAGAMENTO_CURTO[pedido.payment_method]}
        </span>
        {pedido.needs_change ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
            troco {moeda(Number(pedido.change_amount ?? 0))}
          </span>
        ) : null}
      </div>

      {podeSeparar && pedido.status === 'recebido' ? (
        <button
          type="button"
          disabled={transicao}
          onClick={() =>
            startTransition(async () => {
              const r = await iniciarSeparacao(pedido.id)
              if (r.erro) {
                setErro(r.erro)
                router.refresh()
                return
              }
              router.push(`/painel/pedidos/${pedido.id}/separacao`)
            })
          }
          className="h-11 w-full rounded-xl bg-brand font-bold text-brand-foreground"
        >
          {transicao ? 'Abrindo...' : 'Separar'}
        </button>
      ) : null}

      {pedido.status === 'separando' ? (
        <Link
          href={`/painel/pedidos/${pedido.id}/separacao`}
          className="flex h-11 w-full items-center justify-center rounded-xl border border-line font-bold"
        >
          Continuar separacao
        </Link>
      ) : null}

      {erro ? <p className="text-sm font-semibold text-rose-700">{erro}</p> : null}
    </article>
  )
}
