'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, PackageX, RotateCcw } from 'lucide-react'

import { moeda, quantidade as formatarQuantidade } from '@/lib/format'
import type { OrderItem } from '@/lib/types'
import { marcarItem, registrarPeso } from './actions'

export function ItemSeparacao({
  orderId,
  item,
  toleranciaPct,
  podeAjustarPeso,
  podeMarcarFalta,
}: {
  orderId: string
  item: OrderItem
  toleranciaPct: number
  podeAjustarPeso: boolean
  podeMarcarFalta: boolean
}) {
  const router = useRouter()
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [gramas, setGramas] = useState(
    item.weighed_quantity !== null
      ? String(Math.round(Number(item.weighed_quantity) * 1000))
      : String(Math.round(Number(item.requested_quantity) * 1000)),
  )
  const [confirmarDivergencia, setConfirmarDivergencia] = useState(false)

  const pedidoGramas = Math.round(Number(item.requested_quantity) * 1000)
  const digitado = Number(gramas)
  const valorPrevisto = Math.round((digitado / 1000) * Number(item.unit_price) * 100) / 100
  const divergencia = pedidoGramas > 0 ? Math.abs(digitado - pedidoGramas) / pedidoGramas : 0
  const foraDaTolerancia = divergencia > toleranciaPct / 100

  const separado = item.item_status === 'separado'
  const emFalta = item.item_status === 'indisponivel'

  function rodar(fn: () => Promise<{ erro?: string }>) {
    setErro(null)
    startTransition(async () => {
      const r = await fn()
      if (r.erro) setErro(r.erro)
      router.refresh()
    })
  }

  function confirmarPeso() {
    if (foraDaTolerancia && !confirmarDivergencia) {
      setConfirmarDivergencia(true)
      return
    }
    setConfirmarDivergencia(false)
    rodar(() => registrarPeso(orderId, item.id, digitado))
  }

  return (
    <li
      className={`space-y-3 rounded-2xl border p-4 ${
        emFalta
          ? 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
          : separado
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
            : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-lg font-bold ${emFalta ? 'line-through' : ''}`}>{item.product_name}</p>
          <p className="text-sm text-muted">
            {item.sold_by_weight
              ? `Pedido: ${formatarQuantidade(Number(item.requested_quantity), true, item.unit_type)} a ${moeda(
                  Number(item.unit_price),
                )}/kg`
              : `${formatarQuantidade(Number(item.requested_quantity), false, item.unit_type)} a ${moeda(
                  Number(item.unit_price),
                )}`}
          </p>
          {item.note ? (
            <p className="mt-1 rounded-lg bg-amber-100 px-2 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
              {item.note}
            </p>
          ) : null}
        </div>
        <p className="shrink-0 text-lg font-black">{moeda(Number(item.final_total))}</p>
      </div>

      {item.sold_by_weight && !emFalta ? (
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Peso da balanca (gramas)</label>
          <div className="flex gap-2">
            <input
              value={gramas}
              onChange={(e) => {
                setGramas(e.target.value.replace(/\D/g, ''))
                setConfirmarDivergencia(false)
              }}
              inputMode="numeric"
              disabled={!podeAjustarPeso}
              className="h-16 w-40 rounded-xl border-2 border-line bg-surface px-3 text-center text-2xl font-black"
            />
            <div className="flex flex-1 flex-col justify-center">
              <span className="text-sm text-muted">Fica</span>
              <span className="text-xl font-black">{moeda(valorPrevisto)}</span>
            </div>
          </div>

          {confirmarDivergencia ? (
            <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
              {digitado} g e {Math.round(divergencia * 100)}% diferente do que o cliente pediu (
              {pedidoGramas} g). Confira a balanca e toque de novo para confirmar.
            </p>
          ) : null}

          {podeAjustarPeso ? (
            <button
              type="button"
              disabled={transicao || digitado <= 0}
              onClick={confirmarPeso}
              className={`h-14 w-full rounded-xl font-bold text-white ${
                confirmarDivergencia ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
            >
              {transicao
                ? 'Salvando...'
                : confirmarDivergencia
                  ? 'Confirmar mesmo assim'
                  : separado
                    ? 'Atualizar peso'
                    : 'Confirmar peso'}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!item.sold_by_weight && !emFalta ? (
          <button
            type="button"
            disabled={transicao}
            onClick={() => rodar(() => marcarItem(orderId, item.id, separado ? 'pendente' : 'separado'))}
            className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-xl font-bold ${
              separado ? 'border border-line bg-surface' : 'bg-emerald-600 text-white'
            }`}
          >
            {separado ? <RotateCcw size={18} /> : <Check size={18} />}
            {separado ? 'Desmarcar' : 'Separei'}
          </button>
        ) : null}

        {podeMarcarFalta ? (
          <button
            type="button"
            disabled={transicao}
            onClick={() => rodar(() => marcarItem(orderId, item.id, emFalta ? 'pendente' : 'indisponivel'))}
            className={`flex h-14 items-center justify-center gap-2 rounded-xl px-4 font-bold ${
              emFalta ? 'border border-line bg-surface' : 'bg-rose-600 text-white'
            }`}
          >
            {emFalta ? <RotateCcw size={18} /> : <PackageX size={18} />}
            {emFalta ? 'Voltar ao pedido' : 'Acabou'}
          </button>
        ) : null}
      </div>

      {erro ? <p className="text-sm font-semibold text-rose-700">{erro}</p> : null}
    </li>
  )
}
