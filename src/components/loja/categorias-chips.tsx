import Link from 'next/link'

import type { CategoriaVitrine } from '@/lib/loja/catalogo'

export function CategoriasChips({
  categorias,
  ativa,
}: {
  categorias: CategoriaVitrine[]
  ativa?: string
}) {
  return (
    <nav aria-label="Categorias" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-2 pb-1">
        <li>
          <Link
            href="/"
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
              href={`/c/${c.slug}`}
              className={`block rounded-full px-4 py-2.5 text-sm font-bold ${
                ativa === c.slug ? 'bg-brand text-brand-foreground' : 'border border-line bg-surface'
              }`}
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
