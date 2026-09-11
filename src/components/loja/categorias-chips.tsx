'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { RolagemHorizontal } from '@/components/ui/rolagem-horizontal'
import type { CategoriaVitrine } from '@/lib/loja/catalogo'

/**
 * Faixa de categorias das paginas de categoria e da busca.
 *
 * - Cada pilula abre a pagina da categoria (/c/slug), uma categoria por vez.
 *   Antes elas rolavam a home ate a secao: a pessoa caia 12 mil pixels abaixo
 *   e a faixa ficava la em cima, fora de alcance, e o "voltar" nao desfazia.
 * - A faixa gruda logo abaixo do cabecalho: trocar de categoria e sempre um
 *   toque, em qualquer ponto da lista.
 * - A pilula da categoria aberta rola para dentro da tela ao chegar - com 18
 *   categorias, a de "Pet" ficava escondida na ponta da faixa.
 */
export function CategoriasChips({
  categorias,
  ativa,
}: {
  categorias: CategoriaVitrine[]
  ativa?: string
}) {
  const ativaRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    ativaRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [ativa])

  const pilula = (selecionada: boolean) =>
    `flex h-11 items-center rounded-full px-4 text-sm font-bold ${
      selecionada ? 'bg-brand text-brand-foreground' : 'border border-line bg-surface hover:bg-foreground/5'
    }`

  return (
    <nav
      aria-label="Categorias"
      style={{ top: 'var(--altura-cabecalho, 0px)' }}
      className="sticky z-10 -mx-4 bg-background px-4 py-2"
    >
      <RolagemHorizontal>
        <ul className="flex w-max gap-2">
          <li>
            <Link href="/loja" className={pilula(false)}>
              Inicio
            </Link>
          </li>
          {categorias.map((c) => (
            <li key={c.id}>
              <Link
                ref={ativa === c.slug ? ativaRef : undefined}
                href={`/c/${c.slug}`}
                aria-current={ativa === c.slug ? 'page' : undefined}
                className={pilula(ativa === c.slug)}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </RolagemHorizontal>
    </nav>
  )
}
