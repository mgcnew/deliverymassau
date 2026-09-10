'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'

import { Alert } from '@/components/ui/card'
import { salvarBandeiras } from './actions'

/**
 * Bandeiras aceitas de uma forma de pagamento (cartoes e voucher).
 *
 * O cliente ve a lista no checkout; no voucher ele escolhe a dele, que vai
 * no pedido para o entregador. Cada toque salva na hora - como os bairros na
 * aba ao lado -, com a lista mudando antes da resposta e voltando sozinha se
 * o banco recusar.
 */

// Sugestoes de um toque: as mais comuns no Brasil. Qualquer outra entra
// pelo campo de texto.
export const SUGESTOES: Record<string, string[]> = {
  debito: ['Visa', 'Mastercard', 'Elo', 'Cabal'],
  credito: ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'American Express', 'Cabal'],
  voucher: [
    'Alelo',
    'Pluxee (Sodexo)',
    'Ticket',
    'VR',
    'Ben',
    'Caju',
    'Flash',
    'VeroCard',
    'iFood Beneficio',
    'Up Brasil',
  ],
}

export function EditorBandeiras({ code, bandeiras }: { code: string; bandeiras: string[] }) {
  const [pendente, startTransition] = useTransition()
  const [lista, setLista] = useOptimistic(bandeiras)
  const [nova, setNova] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const tem = (nome: string) =>
    lista.some((b) => b.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'))
  const sugestoes = (SUGESTOES[code] ?? []).filter((s) => !tem(s))

  function salvar(proxima: string[]) {
    setErro(null)
    startTransition(async () => {
      setLista(proxima)
      const r = await salvarBandeiras(code, proxima)
      if (r.erro) setErro(r.erro)
    })
  }

  function adicionar(nome: string) {
    const limpo = nome.trim()
    if (!limpo || tem(limpo)) return
    salvar([...lista, limpo])
  }

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <p className="text-sm font-semibold">Bandeiras aceitas</p>

      {lista.length ? (
        <ul className="flex flex-wrap gap-2">
          {lista.map((b) => (
            <li
              key={b}
              className="flex h-9 items-center gap-1 rounded-full bg-brand/10 pl-3 pr-1 text-sm font-bold"
            >
              {b}
              <button
                type="button"
                disabled={pendente}
                onClick={() => salvar(lista.filter((x) => x !== b))}
                aria-label={`Remover ${b}`}
                className="flex size-7 items-center justify-center rounded-full hover:bg-foreground/10"
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          {code === 'voucher'
            ? 'Nenhuma bandeira ainda. Adicione as que voces aceitam para poder ativar o voucher.'
            : 'Nenhuma bandeira informada. O cliente ve so o nome da forma de pagamento.'}
        </p>
      )}

      {sugestoes.length ? (
        <div className="flex flex-wrap gap-2">
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pendente}
              onClick={() => adicionar(s)}
              className="flex h-9 items-center gap-1 rounded-full border border-dashed border-line px-3 text-sm font-semibold text-muted hover:border-brand hover:text-foreground"
            >
              <Plus size={14} aria-hidden />
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          adicionar(nova)
          setNova('')
        }}
      >
        <input
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          maxLength={40}
          placeholder="Outra bandeira"
          aria-label={`Outra bandeira aceita`}
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm"
        />
        <button
          type="submit"
          disabled={pendente || !nova.trim()}
          className="h-10 shrink-0 rounded-xl border border-line bg-surface px-3 text-sm font-semibold disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>

      {erro ? <Alert tone="error">{erro}</Alert> : null}
    </div>
  )
}
