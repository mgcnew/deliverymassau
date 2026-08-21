'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MouseEvent } from 'react'

import { RolagemHorizontal } from '@/components/ui/rolagem-horizontal'
import type { CategoriaVitrine } from '@/lib/loja/catalogo'

/**
 * Sempre aponta pra /loja, que ja lista todas as categorias empilhadas na
 * mesma pagina. Quando ja esta la, a rolagem ate a secao e feita na mao
 * (scrollIntoView) em vez de depender do Next rolar sozinho pelo href com
 * #hash -- isso se mostrou pouco confiavel de pagina pra pagina (às vezes
 * nao rolava nada, as vezes parava no meio). Chegando de outra rota (ex:
 * /c/[slug]), o Link navega normal e o navegador rola pro #hash sozinho.
 */
export function CategoriasChips({
  categorias,
  ativa,
}: {
  categorias: CategoriaVitrine[]
  ativa?: string
}) {
  const pathname = usePathname()
  const naLoja = pathname === '/loja'

  function aoClicar(slug: string | null) {
    return (evento: MouseEvent<HTMLAnchorElement>) => {
      if (!naLoja) return

      evento.preventDefault()
      // O Next intercepta history.replaceState pra sincronizar o proprio
      // router -- e ele mesmo mexe no scroll nessa hora. Por isso a troca de
      // URL vem ANTES: qualquer coisa que o Next faca com o scroll acontece
      // primeiro, e o scrollIntoView daqui e que fica valendo por ultimo.
      history.replaceState(null, '', slug ? `/loja#cat-${slug}` : '/loja')
      const alvo = slug ? document.getElementById(`cat-${slug}`) : null
      if (alvo) {
        alvo.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  return (
    <nav aria-label="Categorias">
      <RolagemHorizontal>
        <ul className="flex w-max gap-2 pb-1">
        <li>
          <Link
            href="/loja"
            onClick={aoClicar(null)}
            className={`block rounded-full px-4 py-2.5 text-sm font-bold ${
              ativa ? 'border border-line bg-surface' : 'bg-brand text-brand-foreground'
            }`}
          >
            Tudo
          </Link>
        </li>
        {categorias.map((c) => (
          <li key={c.id}>
            <Link
              href={`/loja#cat-${c.slug}`}
              onClick={aoClicar(c.slug)}
              className={`block rounded-full px-4 py-2.5 text-sm font-bold ${
                ativa === c.slug ? 'bg-brand text-brand-foreground' : 'border border-line bg-surface'
              }`}
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
