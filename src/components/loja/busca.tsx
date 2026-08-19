'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function CampoBusca({ inicial = '' }: { inicial?: string }) {
  const router = useRouter()
  const [texto, setTexto] = useState(inicial)

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const q = texto.trim()
        router.push(q ? `/busca?q=${encodeURIComponent(q)}` : '/loja')
      }}
      className="relative"
    >
      <Search
        size={20}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        type="search"
        name="q"
        placeholder="Buscar no mercado"
        aria-label="Buscar produto"
        className="h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-3 text-base"
      />
    </form>
  )
}
