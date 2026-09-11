'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Bike, Clock, Printer } from 'lucide-react'

import { moeda } from '@/lib/format'
import { ORDER_STATUS } from '@/lib/orders/status'
import { iniciarSeparacao } from './actions'
import {
  COR_URGENCIA,
  minutosDesde,
  rotuloPagamento,
  tempoRelativo,
  urgencia,
  type PedidoOperacional,
} from './tipos'

/**
 * Um pedido na fila. A coluna (ou a etapa escolhida no celular) ja diz o
 * status, entao o cartao nao repete: fala so o que muda de um pedido para
 * outro - quem, quanto, ha quanto tempo e o que fazer agora.
 */
export function CardPedido({
  pedido,
  agora,
  podeSeparar,
  podeImprimir,
}: {
  pedido: PedidoOperacional
  agora: number
  podeSeparar: boolean
  podeImprimir: boolean
}) {
  const router = useRouter()
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const novo = pedido.status === 'recebido'
  const finalizado = pedido.status === 'entregue' || pedido.status === 'cancelado'
  const minutos = minutosDesde(pedido.created_at, agora)
  const nivel = finalizado ? 'ok' : urgencia(pedido.status, minutos)

  return (
    <article
      className={`space-y-2.5 rounded-2xl border bg-surface p-3 ${
        novo ? 'border-brand shadow-[0_0_0_3px_rgba(214,31,43,0.12)]' : 'border-line'
      }`}
    >
      <Link href={`/painel/pedidos/${pedido.id}`} className="block min-w-0 rounded-lg">
        <div className="flex items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 text-lg font-black leading-tight">
            #{pedido.order_number}
            {novo ? (
              <>
                <span aria-hidden className="size-2.5 rounded-full bg-brand motion-safe:animate-pulse" />
                <span className="sr-only">novo</span>
              </>
            ) : null}
          </p>
          <p className="shrink-0 font-black tabular-nums">{moeda(Number(pedido.total))}</p>
        </div>

        <p className="truncate text-sm font-semibold">{pedido.customer_name}</p>

        {/* Idade na linha do bairro: o nome do cliente fica com a largura
            toda, que nas colunas estreitas do computador faz diferenca. O
            relogio muda de cor quando a etapa passa do tempo, e o icone
            aparece junto para nao depender so da cor. */}
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-sm text-muted">{pedido.address_district ?? 'sem bairro'}</p>
          <p className={`flex shrink-0 items-center gap-1 text-xs tabular-nums ${COR_URGENCIA[nivel]}`}>
            {nivel !== 'ok' ? <Clock size={13} aria-hidden /> : null}
            {tempoRelativo(minutos)}
            {nivel === 'atraso' ? <span className="sr-only">, atrasado</span> : null}
          </p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
        {finalizado ? (
          <span className={`rounded-full border px-2 py-0.5 ${ORDER_STATUS[pedido.status].tone}`}>
            {ORDER_STATUS[pedido.status].short}
          </span>
        ) : null}
        <span className="rounded-full bg-foreground/5 px-2 py-0.5">
          {pedido.itens} {pedido.itens === 1 ? 'item' : 'itens'}
        </span>
        <span className="rounded-full bg-foreground/5 px-2 py-0.5">
          {rotuloPagamento(pedido.payment_method, pedido.payment_brand)}
        </span>
        {pedido.needs_change ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
            troco {moeda(Number(pedido.change_amount ?? 0))}
          </span>
        ) : null}
      </div>

      {/* Uma acao por etapa: o que a pessoa no balcao faz com este pedido agora. */}
      {novo && (podeSeparar || podeImprimir) ? (
        <div className="flex gap-2">
          {podeSeparar ? (
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
              className="h-11 min-w-0 flex-1 rounded-xl bg-brand font-bold text-brand-foreground disabled:opacity-70"
            >
              {transicao ? 'Abrindo...' : 'Separar'}
            </button>
          ) : null}

          {podeImprimir ? (
            <Link
              href={`/painel/pedidos/${pedido.id}/imprimir?auto=1`}
              aria-label={`Imprimir via do pedido #${pedido.order_number}`}
              title="Imprimir via termica"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface hover:bg-foreground/5"
            >
              <Printer size={20} aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}

      {pedido.status === 'separando' ? (
        <Link
          href={`/painel/pedidos/${pedido.id}/separacao`}
          className="flex h-11 w-full items-center justify-center rounded-xl border border-line font-bold hover:bg-foreground/5"
        >
          Continuar separacao
        </Link>
      ) : null}

      {pedido.status === 'aguardando_entregador' || pedido.status === 'saiu_para_entrega' ? (
        <p className="flex items-center gap-2 rounded-xl bg-foreground/5 px-2.5 py-2 text-sm font-semibold leading-tight">
          <Bike size={16} aria-hidden className="shrink-0" />
          <span className="min-w-0 break-words">
            {pedido.entregador
              ? pedido.status === 'saiu_para_entrega'
                ? `Com ${pedido.entregador}`
                : `${pedido.entregador} vai levar`
              : 'Aguardando entregador'}
          </span>
        </p>
      ) : null}

      {erro ? (
        <p role="status" aria-live="polite" className="text-sm font-semibold text-[var(--tone-error-fg)]">
          {erro}
        </p>
      ) : null}
    </article>
  )
}
