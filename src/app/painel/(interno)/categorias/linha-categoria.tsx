'use client'

import { useActionState, useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

import { Button, buttonClass } from '@/components/ui/button'
import { ConfirmarAcao } from '@/components/ui/confirmar-acao'
import { Input } from '@/components/ui/field'
import {
  alternarCategoriaAtiva,
  excluirCategoria,
  moverCategoria,
  renomearCategoria,
  type FormState,
} from './actions'

export function LinhaCategoria({
  id,
  nome,
  ativa,
  produtos,
  primeira,
  ultima,
  podeGerenciar,
}: {
  id: string
  nome: string
  ativa: boolean
  produtos: number
  primeira: boolean
  ultima: boolean
  podeGerenciar: boolean
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(renomearCategoria, {})
  const [nomeAtual, setNomeAtual] = useState(nome)
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const alterado = nomeAtual.trim() !== nome

  function rodar(fn: () => Promise<FormState>) {
    setErro(null)
    startTransition(async () => {
      const r = await fn()
      if (r.error) setErro(r.error)
    })
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-3">
      <form action={action} className="flex min-w-0 flex-1 items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <Input
          name="name"
          value={nomeAtual}
          onChange={(e) => setNomeAtual(e.target.value)}
          disabled={!podeGerenciar}
          className={`flex-1 ${ativa ? '' : 'line-through opacity-60'}`}
        />
        {alterado ? (
          <Button type="submit" variant="secondary" disabled={pending}>
            Salvar
          </Button>
        ) : null}
      </form>

      <span className="text-sm text-muted">{produtos} prod.</span>

      {podeGerenciar ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Subir"
            disabled={primeira || transicao}
            onClick={() => rodar(() => moverCategoria(id, 'cima'))}
            className="flex size-10 items-center justify-center rounded-lg hover:bg-foreground/5 disabled:opacity-30"
          >
            <ChevronUp size={18} />
          </button>
          <button
            type="button"
            aria-label="Descer"
            disabled={ultima || transicao}
            onClick={() => rodar(() => moverCategoria(id, 'baixo'))}
            className="flex size-10 items-center justify-center rounded-lg hover:bg-foreground/5 disabled:opacity-30"
          >
            <ChevronDown size={18} />
          </button>
          <Button
            type="button"
            variant={ativa ? 'secondary' : 'primary'}
            disabled={transicao}
            onClick={() => rodar(() => alternarCategoriaAtiva(id, !ativa))}
          >
            {ativa ? 'Desativar' : 'Ativar'}
          </Button>

          {/* Excluir so aparece na categoria sem produto. Com produto, o
              caminho e desativar (sai da loja, o cadastro fica) ou mover os
              produtos - e o banco recusa de qualquer forma. */}
          {produtos === 0 ? (
            <ConfirmarAcao
              titulo={`Excluir "${nome}"`}
              descricao="A categoria nao tem nenhum produto, entao nada do catalogo se perde. Nao da para desfazer."
              rotuloConfirmar="Excluir"
              className={buttonClass('ghost', 'md', 'text-muted')}
              aria-label={`Excluir categoria ${nome}`}
              onConfirmar={async () => {
                const r = await excluirCategoria(id)
                // ConfirmarAcao fala "erro"; as acoes daqui falam "error".
                if (r.error) return { erro: r.error }
              }}
            >
              <Trash2 size={18} aria-hidden />
            </ConfirmarAcao>
          ) : null}
        </div>
      ) : null}

      {state.error || erro ? (
        <p role="status" aria-live="polite" className="w-full text-sm font-semibold text-rose-700">
          {state.error ?? erro}
        </p>
      ) : null}
    </li>
  )
}
