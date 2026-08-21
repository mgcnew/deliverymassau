'use client'

import { CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/**
 * Filtro de dia dos pedidos finalizados.
 *
 * Hoje/Ontem sao <Link> de proposito: sao os dois cliques do dia a dia e
 * assim funcionam como navegacao normal (prefetch, voltar do navegador).
 * O seletor de data cobre o resto.
 */
export function FiltroDia({
  dia,
  hoje,
  ontem,
}: {
  dia: string
  hoje: string
  ontem: string
}) {
  const router = useRouter()

  const base = 'flex h-11 items-center rounded-xl px-4 text-sm font-bold'
  const escolhido = 'bg-brand text-brand-foreground'
  const solto = 'border border-line bg-surface'
  const outroDia = dia !== hoje && dia !== ontem

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/painel/pedidos" className={`${base} ${dia === hoje ? escolhido : solto}`}>
        Hoje
      </Link>
      <Link
        href={`/painel/pedidos?dia=${ontem}`}
        className={`${base} ${dia === ontem ? escolhido : solto}`}
      >
        Ontem
      </Link>

      <label
        className={`${base} gap-2 cursor-pointer ${outroDia ? escolhido : solto}`}
        title="Escolher outro dia"
      >
        <CalendarDays size={18} aria-hidden />
        <span className="sr-only">Escolher outro dia</span>
        <input
          type="date"
          value={dia}
          max={hoje}
          onChange={(e) => {
            const escolhido = e.target.value
            if (escolhido) router.push(`/painel/pedidos?dia=${escolhido}`)
          }}
          className="bg-transparent text-sm font-bold outline-none"
        />
      </label>
    </div>
  )
}
