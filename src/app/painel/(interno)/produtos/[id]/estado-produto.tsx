'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { alternarAtivo, alternarDisponibilidade } from '../actions'

export function EstadoProduto({
  id,
  ativo,
  disponivel,
  podeDesativar,
  podeAlterarDisponibilidade,
}: {
  id: string
  ativo: boolean
  disponivel: boolean
  podeDesativar: boolean
  podeAlterarDisponibilidade: boolean
}) {
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Disponivel para venda</p>
          <p className="text-sm text-muted">Some do carrinho na hora quando o estoque acaba.</p>
        </div>
        <Button
          type="button"
          variant={disponivel ? 'secondary' : 'primary'}
          disabled={!podeAlterarDisponibilidade || transicao}
          onClick={() =>
            startTransition(async () => {
              const r = await alternarDisponibilidade(id, !disponivel)
              setErro(r.error ?? null)
            })
          }
        >
          {disponivel ? 'Marcar que acabou' : 'Marcar como disponivel'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div>
          <p className="font-semibold">Ativo no catalogo</p>
          <p className="text-sm text-muted">Inativo nem aparece no portal do cliente.</p>
        </div>
        <Button
          type="button"
          variant={ativo ? 'danger' : 'secondary'}
          disabled={!podeDesativar || transicao}
          onClick={() =>
            startTransition(async () => {
              const r = await alternarAtivo(id, !ativo)
              setErro(r.error ?? null)
            })
          }
        >
          {ativo ? 'Desativar produto' : 'Reativar produto'}
        </Button>
      </div>

      {erro ? <p className="text-sm font-semibold text-rose-700">{erro}</p> : null}
    </div>
  )
}
