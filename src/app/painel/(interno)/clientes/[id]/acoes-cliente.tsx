'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Alert, Card, CardTitle } from '@/components/ui/card'
import { Field, Textarea } from '@/components/ui/field'
import { dataHora } from '@/lib/format'
import { bloquearCliente, desbloquearCliente } from '../actions'

export function AcoesCliente({
  id,
  bloqueado,
  motivo,
  bloqueadoEm,
}: {
  id: string
  bloqueado: boolean
  motivo: string | null
  bloqueadoEm: string | null
}) {
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [abrindo, setAbrindo] = useState(false)
  const [motivoDigitado, setMotivoDigitado] = useState('')

  function bloquear() {
    startTransition(async () => {
      const r = await bloquearCliente(id, motivoDigitado.trim())
      if (r.erro) {
        setErro(r.erro)
        return
      }
      setErro(null)
      setAbrindo(false)
      setMotivoDigitado('')
    })
  }

  function desbloquear() {
    startTransition(async () => {
      const r = await desbloquearCliente(id)
      setErro(r.erro ?? null)
    })
  }

  if (bloqueado) {
    return (
      <Card>
        <CardTitle>Acesso</CardTitle>
        <Alert tone="error">
          <span className="block font-bold">Cliente bloqueado</span>
          {motivo ? <span className="block">Motivo: {motivo}</span> : null}
          {bloqueadoEm ? (
            <span className="block text-xs opacity-80">Desde {dataHora(bloqueadoEm)}</span>
          ) : null}
        </Alert>
        <Button
          type="button"
          variant="secondary"
          disabled={transicao}
          onClick={desbloquear}
          className="mt-3"
        >
          {transicao ? 'Desbloqueando...' : 'Desbloquear cliente'}
        </Button>
        {erro ? (
          <p role="status" aria-live="polite" className="mt-2 text-sm font-semibold text-rose-700">
            {erro}
          </p>
        ) : null}
      </Card>
    )
  }

  return (
    <Card>
      <CardTitle>Acesso</CardTitle>
      {!abrindo ? (
        <Button type="button" variant="danger" onClick={() => setAbrindo(true)}>
          Bloquear cliente
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            O cliente para de conseguir fazer novos pedidos ate voce desbloquear. Pedidos ja feitos
            nao sao afetados.
          </p>
          <Field label="Motivo (opcional, so a equipe ve)">
            <Textarea
              value={motivoDigitado}
              onChange={(e) => setMotivoDigitado(e.target.value)}
              maxLength={200}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={transicao}
              onClick={() => setAbrindo(false)}
            >
              Cancelar
            </Button>
            <Button type="button" variant="danger" disabled={transicao} onClick={bloquear}>
              {transicao ? 'Bloqueando...' : 'Confirmar bloqueio'}
            </Button>
          </div>
        </div>
      )}
      {erro ? (
        <p role="status" aria-live="polite" className="mt-2 text-sm font-semibold text-rose-700">
          {erro}
        </p>
      ) : null}
    </Card>
  )
}
