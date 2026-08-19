'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Alert } from '@/components/ui/card'
import { moeda } from '@/lib/format'
import { concluirSeparacao } from '../../actions'

export function BarraConcluir({
  orderId,
  pendentes,
  total,
  estimado,
}: {
  orderId: string
  pendentes: number
  total: number
  estimado: number
}) {
  const router = useRouter()
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const diferenca = Math.round((total - estimado) * 100) / 100

  return (
    <div className="sticky bottom-0 z-20 -mx-4 space-y-2 border-t border-line bg-surface/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur md:mx-0">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Total do pedido</p>
          <p className="text-2xl font-black">{moeda(total)}</p>
          {diferenca !== 0 ? (
            <p className={`text-sm font-bold ${diferenca > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {diferenca > 0 ? '+' : ''}
              {moeda(diferenca)} em relacao ao estimado
            </p>
          ) : null}
        </div>

        <button
          type="button"
          disabled={transicao || pendentes > 0}
          onClick={() =>
            startTransition(async () => {
              const r = await concluirSeparacao(orderId)
              if (r.erro) {
                setErro(r.erro)
                router.refresh()
                return
              }
              router.push('/painel/pedidos')
            })
          }
          className="h-16 flex-1 rounded-xl bg-brand text-lg font-black text-brand-foreground disabled:opacity-50"
        >
          {transicao
            ? 'Concluindo...'
            : pendentes > 0
              ? `Faltam ${pendentes} ${pendentes === 1 ? 'item' : 'itens'}`
              : 'Concluir separacao'}
        </button>
      </div>

      {erro ? <Alert tone="error">{erro}</Alert> : null}
    </div>
  )
}
