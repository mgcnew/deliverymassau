'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Filtro de dia dos pedidos finalizados.
 *
 * Hoje/Ontem sao <Link> de proposito: sao os dois cliques do dia a dia e
 * assim funcionam como navegacao normal (prefetch, voltar do navegador).
 *
 * O calendario e desenhado aqui em vez de um <input type="date"> porque a
 * janela do input nativo pertence ao navegador e ignora o tema do app
 * (aparecia clara no modo escuro). Toda a conta de dias usa UTC puro sobre
 * strings AAAA-MM-DD -- o fuso do mercado ja foi aplicado pelo servidor ao
 * calcular "hoje", aqui e so aritmetica de calendario.
 */

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function chave(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

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
  const raiz = useRef<HTMLDivElement>(null)
  const [aberto, setAberto] = useState(false)

  // Mes exibido no calendario: comeca no mes do dia filtrado.
  const [anoSel, mesSel] = dia.split('-').map(Number)
  const [visivel, setVisivel] = useState({ ano: anoSel, mes: mesSel - 1 })

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

  function abrir() {
    setVisivel({ ano: anoSel, mes: mesSel - 1 })
    setAberto((v) => !v)
  }

  function mudarMes(passo: number) {
    setVisivel(({ ano, mes }) => {
      const d = new Date(Date.UTC(ano, mes + passo, 1))
      return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() }
    })
  }

  function escolher(diaEscolhido: string) {
    setAberto(false)
    router.push(
      diaEscolhido === hoje ? '/painel/pedidos' : `/painel/pedidos?dia=${diaEscolhido}`,
    )
  }

  // Grade do mes visivel: celulas vazias ate o dia da semana do dia 1.
  const primeiroDia = new Date(Date.UTC(visivel.ano, visivel.mes, 1)).getUTCDay()
  const totalDias = new Date(Date.UTC(visivel.ano, visivel.mes + 1, 0)).getUTCDate()
  const nomeMes = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(visivel.ano, visivel.mes, 1)))

  const base = 'flex h-11 items-center rounded-xl px-4 text-sm font-bold'
  const escolhido = 'bg-brand text-brand-foreground'
  const solto = 'border border-line bg-surface'
  const outroDia = dia !== hoje && dia !== ontem

  return (
    <div ref={raiz} className="relative flex flex-wrap items-center gap-2">
      <Link href="/painel/pedidos" className={`${base} ${dia === hoje ? escolhido : solto}`}>
        Hoje
      </Link>
      <Link
        href={`/painel/pedidos?dia=${ontem}`}
        className={`${base} ${dia === ontem ? escolhido : solto}`}
      >
        Ontem
      </Link>

      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={abrir}
        className={`${base} gap-2 ${outroDia ? escolhido : solto}`}
      >
        <CalendarDays size={18} aria-hidden />
        {outroDia ? dia.split('-').reverse().join('/') : 'Outro dia'}
      </button>

      {aberto ? (
        <div
          role="dialog"
          aria-label="Escolher dia"
          className="absolute right-0 top-13 z-30 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={() => mudarMes(-1)}
              className="flex size-9 items-center justify-center rounded-lg hover:bg-foreground/5"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <p className="text-sm font-bold first-letter:uppercase">{nomeMes}</p>
            <button
              type="button"
              aria-label="Mes seguinte"
              onClick={() => mudarMes(1)}
              className="flex size-9 items-center justify-center rounded-lg hover:bg-foreground/5"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 text-center">
            {DIAS_SEMANA.map((d, i) => (
              <span key={i} className="py-1 text-xs font-bold text-muted">
                {d}
              </span>
            ))}
            {Array.from({ length: primeiroDia }).map((_, i) => (
              <span key={`v${i}`} />
            ))}
            {Array.from({ length: totalDias }).map((_, i) => {
              const valor = chave(visivel.ano, visivel.mes, i + 1)
              const futuro = valor > hoje
              const ativo = valor === dia
              return (
                <button
                  key={valor}
                  type="button"
                  disabled={futuro}
                  onClick={() => escolher(valor)}
                  className={`mx-auto flex size-9 items-center justify-center rounded-full text-sm font-semibold ${
                    ativo
                      ? 'bg-brand font-black text-brand-foreground'
                      : futuro
                        ? 'text-muted/40'
                        : 'hover:bg-foreground/5'
                  } ${valor === hoje && !ativo ? 'border border-brand text-brand' : ''}`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
