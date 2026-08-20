'use client'

import { useOptimistic, useState, useTransition } from 'react'

import { alternarDisponibilidade } from './actions'

/** Um toque so. O estado muda na hora e volta atras se o banco recusar. */
export function BotaoDisponibilidade({
  id,
  disponivel,
  podeAlterar,
}: {
  id: string
  disponivel: boolean
  podeAlterar: boolean
}) {
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [otimista, setOtimista] = useOptimistic(disponivel)

  if (!podeAlterar) {
    return (
      <span
        className={`rounded-full px-3 py-1 text-sm font-bold ${
          disponivel ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200' : 'bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-200'
        }`}
      >
        {disponivel ? 'Disponivel' : 'Acabou'}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={transicao}
        aria-pressed={otimista}
        onClick={() =>
          startTransition(async () => {
            setOtimista(!otimista)
            setErro(null)
            const r = await alternarDisponibilidade(id, !disponivel)
            if (r.error) setErro(r.error)
          })
        }
        className={`h-11 min-w-28 rounded-xl px-4 font-bold transition ${
          otimista
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'bg-rose-600 text-white hover:bg-rose-700'
        }`}
      >
        {otimista ? 'Disponivel' : 'Acabou'}
      </button>
      {erro ? <span className="text-xs font-semibold text-rose-700">{erro}</span> : null}
    </div>
  )
}
