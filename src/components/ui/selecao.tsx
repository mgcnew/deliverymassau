'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * Campo de escolha com a lista desenhada pelo app, no lugar do <select>.
 *
 * O <select> nativo abre uma lista que o NAVEGADOR desenha, e ela ignora o
 * tema: no escuro vinha com a faixa de selecao azul do sistema, que nao
 * existe em lugar nenhum do painel. O seletor da lista de produtos ja tinha
 * sido feito assim pelo mesmo motivo; aqui a solucao passa a ser reusavel.
 *
 * O <select> continua no DOM, porem: invisivel, sem foco e sem clique. Duas
 * coisas dependem dele e nao funcionariam com um input escondido:
 *
 *   - e ele que o formulario envia (carrega name e value de verdade);
 *   - com `required`, e ele que o navegador valida. O formulario de produto
 *     usa essa validacao para pular ate a aba do primeiro campo vazio (ver
 *     aoInvalidar em produto-form), e input escondido nao valida. Como ocupa
 *     a mesma caixa do botao, o aviso do navegador aponta para o lugar certo.
 *
 * Controlado de fora porque quem usa costuma precisar do valor: a unidade de
 * venda, por exemplo, muda de opcoes quando o produto passa a ser vendido por
 * peso.
 */
export type Opcao = { valor: string; rotulo: string }

export function Selecao({
  name,
  opcoes,
  valor,
  onEscolher,
  rotuloLista,
  vazio = 'Escolha...',
  required,
  disabled,
}: {
  name: string
  opcoes: Opcao[]
  valor: string
  onEscolher: (valor: string) => void
  /** Para quem usa leitor de tela saber que lista abriu. */
  rotuloLista: string
  /** O que aparece enquanto nada foi escolhido. */
  vazio?: string
  required?: boolean
  disabled?: boolean
}) {
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLUListElement>(null)
  const [aberto, abrir] = useState(false)

  useEffect(() => {
    if (!aberto) return
    const cliqueFora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) abrir(false)
    }
    const teclaEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        abrir(false)
        botao.current?.focus()
      }
    }
    document.addEventListener('pointerdown', cliqueFora)
    document.addEventListener('keydown', teclaEsc)
    // Abriu: o foco vai para a opcao atual, para as setas andarem dali.
    lista.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', cliqueFora)
      document.removeEventListener('keydown', teclaEsc)
    }
  }, [aberto])

  function escolher(v: string) {
    onEscolher(v)
    abrir(false)
    botao.current?.focus()
  }

  /** Setas andam pelas opcoes; Home e End vao para as pontas. */
  function aoTeclarNaLista(e: KeyboardEvent<HTMLUListElement>) {
    const passos: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }
    const itens = [...(lista.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
    if (!itens.length) return

    if (e.key in passos) {
      e.preventDefault()
      const atual = itens.indexOf(document.activeElement as HTMLButtonElement)
      itens[Math.min(Math.max(atual + passos[e.key], 0), itens.length - 1)].focus()
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      itens[e.key === 'Home' ? 0 : itens.length - 1].focus()
    }
  }

  const escolhida = opcoes.find((o) => o.valor === valor)

  return (
    <div ref={raiz} className="relative">
      <select
        name={name}
        value={valor}
        onChange={(e) => onEscolher(e.target.value)}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full opacity-0"
      >
        <option value="" />
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor} />
        ))}
      </select>

      <button
        ref={botao}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        disabled={disabled}
        onClick={() => abrir(!aberto)}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 text-left text-base disabled:opacity-50"
      >
        <span className={escolhida ? '' : 'text-muted'}>{escolhida?.rotulo ?? vazio}</span>
        <ChevronDown
          size={18}
          aria-hidden
          className={`shrink-0 text-muted transition-transform ${aberto ? 'rotate-180' : ''}`}
        />
      </button>

      {aberto ? (
        <ul
          ref={lista}
          role="listbox"
          aria-label={rotuloLista}
          onKeyDown={aoTeclarNaLista}
          className="rolagem-discreta absolute inset-x-0 top-13 z-30 max-h-80 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl"
        >
          {opcoes.map((o) => {
            const ativa = o.valor === valor
            return (
              <li key={o.valor}>
                <button
                  type="button"
                  role="option"
                  aria-selected={ativa}
                  onClick={() => escolher(o.valor)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-foreground/5 focus:bg-foreground/5 focus:outline-none ${
                    ativa ? 'text-brand-ink' : ''
                  }`}
                >
                  {o.rotulo}
                  {ativa ? <Check size={16} aria-hidden /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
