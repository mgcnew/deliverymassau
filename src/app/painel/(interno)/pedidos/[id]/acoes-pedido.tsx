'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/card'
import { Textarea } from '@/components/ui/field'
import type { OrderStatus } from '@/lib/types'
import { cancelarPedido, concluirSeparacao, iniciarSeparacao } from '../actions'

export function AcoesPedido({
  orderId,
  status,
  podeSeparar,
  podeCancelar,
  podeImprimir,
}: {
  orderId: string
  status: OrderStatus
  podeSeparar: boolean
  podeCancelar: boolean
  podeImprimir: boolean
}) {
  const router = useRouter()
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const finalizado = status === 'entregue' || status === 'cancelado'

  function rodar(fn: () => Promise<{ erro?: string }>, depois?: () => void) {
    setErro(null)
    startTransition(async () => {
      const r = await fn()
      if (r.erro) {
        setErro(r.erro)
        router.refresh()
        return
      }
      depois ? depois() : router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {podeSeparar && status === 'recebido' ? (
          <Button
            type="button"
            size="lg"
            disabled={transicao}
            onClick={() =>
              rodar(
                () => iniciarSeparacao(orderId),
                () => router.push(`/painel/pedidos/${orderId}/separacao`),
              )
            }
          >
            Iniciar separacao
          </Button>
        ) : null}

        {podeSeparar && status === 'separando' ? (
          <>
            <Link
              href={`/painel/pedidos/${orderId}/separacao`}
              className="flex h-14 items-center justify-center rounded-xl bg-brand px-6 font-bold text-brand-foreground"
            >
              Abrir separacao
            </Link>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              disabled={transicao}
              onClick={() => rodar(() => concluirSeparacao(orderId))}
            >
              Concluir separacao
            </Button>
          </>
        ) : null}

        {podeImprimir ? (
          <Link
            href={`/painel/pedidos/${orderId}/imprimir`}
            className="flex h-14 items-center justify-center rounded-xl border border-line bg-surface px-6 font-bold"
          >
            Imprimir
          </Link>
        ) : null}

        {podeCancelar && !finalizado ? (
          <Button
            type="button"
            size="lg"
            variant="danger"
            onClick={() => setCancelando((v) => !v)}
          >
            Cancelar pedido
          </Button>
        ) : null}
      </div>

      {cancelando ? (
        <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="font-semibold text-rose-900">Por que o pedido esta sendo cancelado?</p>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: cliente desistiu, endereco inexistente..."
          />
          <Button
            type="button"
            variant="danger"
            disabled={transicao || !motivo.trim()}
            onClick={() => rodar(() => cancelarPedido(orderId, motivo))}
          >
            Confirmar cancelamento
          </Button>
        </div>
      ) : null}

      {erro ? <Alert tone="error">{erro}</Alert> : null}
    </div>
  )
}
