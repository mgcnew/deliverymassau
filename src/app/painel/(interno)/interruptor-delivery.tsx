'use client'

import { useOptimistic, useState, useTransition } from 'react'

import { Card } from '@/components/ui/card'
import { Interruptor } from '@/components/ui/interruptor'
import { alternarDelivery } from './configuracoes/actions'

/**
 * O card inteiro e client porque o texto ("Aberto"/"Fechado") tem que virar
 * junto com o interruptor. Se so o botao fosse client, o rotulo ficaria
 * mentindo ate a revalidacao chegar.
 *
 * useOptimistic vira na hora e volta sozinho se o banco recusar -- a RLS e
 * quem manda, o clique aqui e so um pedido.
 */
export function InterruptorDelivery({
  ativo,
  podeAlterar,
}: {
  ativo: boolean
  podeAlterar: boolean
}) {
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [otimista, setOtimista] = useOptimistic(ativo)

  function alternar(proximo: boolean) {
    startTransition(async () => {
      setOtimista(proximo)
      setErro(null)
      const r = await alternarDelivery(proximo)
      if (r.erro) setErro(r.erro)
    })
  }

  return (
    <Card className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-muted">Delivery</p>
        <p className="text-lg font-bold">
          {otimista ? 'Aberto para pedidos' : 'Fechado temporariamente'}
        </p>
        <p className="text-sm text-muted">
          {otimista
            ? 'A loja esta recebendo pedidos novos.'
            : 'A loja continua no ar avisando o cliente. Pedidos em andamento seguem normalmente.'}
        </p>
        {erro ? (
          <p role="status" aria-live="polite" className="mt-1 text-sm font-semibold text-rose-700 dark:text-rose-300">
            {erro}
          </p>
        ) : null}
      </div>

      {podeAlterar ? (
        <Interruptor
          ligado={otimista}
          desabilitado={transicao}
          aoAlternar={alternar}
          rotulo={otimista ? 'Fechar o delivery' : 'Abrir o delivery'}
        />
      ) : (
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
            otimista
              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200'
              : 'bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-200'
          }`}
        >
          {otimista ? 'ON' : 'OFF'}
        </span>
      )}
    </Card>
  )
}
