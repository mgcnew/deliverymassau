'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'

/**
 * Dropdown de categoria da lista de produtos.
 *
 * Nao e um <select> nativo de proposito: a lista aberta do select e
 * desenhada pelo navegador e ignora o tema do app (aparecia branca no modo
 * escuro). Este aqui usa os mesmos tokens de cor do resto do painel.
 *
 * Escolher navega na hora, preservando o filtro de disponibilidade e a
 * busca, e voltando pra pagina 1 -- o mesmo que os chips antigos faziam.
 */
export function SeletorCategoria({
  categorias,
  selecionada,
  filtro,
  busca,
}: {
  categorias: Array<{ id: string; name: string }>
  selecionada: string
  filtro: string
  busca: string
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const cliqueFora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    const teclaEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('pointerdown', cliqueFora)
    document.addEventListener('keydown', teclaEsc)
    return () => {
      document.removeEventListener('pointerdown', cliqueFora)
      document.removeEventListener('keydown', teclaEsc)
    }
  }, [aberto])

  function escolher(id: string) {
    setAberto(false)
    const sp = new URLSearchParams({ f: filtro, p: '1' })
    if (busca) sp.set('q', busca)
    if (id) sp.set('c', id)
    router.push(`/painel/produtos?${sp.toString()}`)
  }

  const rotulo = categorias.find((c) => c.id === selecionada)?.name ?? 'Todas as categorias'
  const opcoes = [{ id: '', name: 'Todas as categorias' }, ...categorias]

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={`flex h-10 items-center gap-2 rounded-full border bg-surface px-4 text-sm font-bold ${
          selecionada ? 'border-brand text-brand' : 'border-line'
        }`}
      >
        {rotulo}
        <ChevronDown
          size={16}
          aria-hidden
          className={`transition-transform ${aberto ? 'rotate-180' : ''}`}
        />
      </button>

      {aberto ? (
        <ul
          role="listbox"
          aria-label="Filtrar por categoria"
          className="rolagem-discreta absolute left-0 top-11 z-30 max-h-80 w-60 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl"
        >
          {opcoes.map((opcao) => {
            const ativa = (opcao.id || '') === selecionada
            return (
              <li key={opcao.id || 'todas'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={ativa}
                  onClick={() => escolher(opcao.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-foreground/5 ${
                    ativa ? 'text-brand' : ''
                  }`}
                >
                  {opcao.name}
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
