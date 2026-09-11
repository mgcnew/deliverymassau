'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'

/**
 * Botao "Mais" que abre um menu de atalhos secundarios.
 *
 * Para cabecalho com varias acoes: a principal fica a vista (ex.: "Novo")
 * e o resto entra aqui, em vez de quatro botoes disputando o olhar. Mesmo
 * nome e icone do "Mais" da barra de navegacao do celular.
 *
 * Fecha ao escolher, ao tocar fora e no Esc; as setas andam pelos itens.
 */
export type ItemMenu = { href: string; rotulo: string; descricao?: string; icone?: ReactNode }

export function MenuMais({
  itens,
  rotulo = 'Mais',
  ancora = 'botao',
}: {
  itens: ItemMenu[]
  rotulo?: string
  /**
   * Por onde o menu se alinha a direita. 'pai': pela borda do elemento
   * posicionado de fora (relative) - para quando ha outro botao a direita do
   * "Mais" e, alinhado so a ele, o menu sairia da tela no celular.
   */
  ancora?: 'botao' | 'pai'
}) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const idMenu = useId()

  useEffect(() => {
    if (!aberto) return
    const foraDaqui = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false)
        botao.current?.focus()
      }
    }
    document.addEventListener('pointerdown', foraDaqui)
    document.addEventListener('keydown', aoTeclar)
    // Abriu pelo teclado ou toque: o foco ja vai para o primeiro item.
    raiz.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', foraDaqui)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  function andar(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const itensMenu = [...(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const i = itensMenu.indexOf(document.activeElement as HTMLElement)
    const proximo = e.key === 'ArrowDown' ? i + 1 : i - 1
    itensMenu[(proximo + itensMenu.length) % itensMenu.length]?.focus()
  }

  if (itens.length === 0) return null

  return (
    <div ref={raiz} className={ancora === 'botao' ? 'relative' : ''} onKeyDown={andar}>
      <button
        ref={botao}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={idMenu}
        onClick={() => setAberto((a) => !a)}
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-[15px] font-semibold transition ${
          aberto ? 'border-brand bg-brand/5' : 'border-line bg-surface hover:bg-background'
        }`}
      >
        <Ellipsis size={18} aria-hidden />
        {rotulo}
      </button>

      {aberto ? (
        <div
          id={idMenu}
          role="menu"
          aria-label={rotulo}
          className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-1.5 shadow-xl"
        >
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setAberto(false)}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-foreground/5 focus:bg-foreground/5"
            >
              {item.icone ? <span className="mt-0.5 shrink-0 text-muted">{item.icone}</span> : null}
              <span className="min-w-0">
                <span className="block font-semibold">{item.rotulo}</span>
                {item.descricao ? (
                  <span className="block text-sm text-muted">{item.descricao}</span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
