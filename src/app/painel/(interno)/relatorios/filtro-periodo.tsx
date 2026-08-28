'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

import { somarDias } from '@/lib/datas'

/**
 * Periodo do relatorio: atalhos + calendario de intervalo.
 *
 * Os atalhos sao <Link> (navegacao de verdade: prefetch e botao voltar do
 * navegador funcionam). O calendario e desenhado aqui, e nao um
 * <input type="date">, pelo mesmo motivo do filtro de pedidos: a janela
 * nativa pertence ao navegador e ignora o tema do app.
 *
 * Escolha do intervalo em dois cliques - primeiro o inicio, depois o fim.
 * Clicar numa data anterior ao inicio nao e erro: vira o intervalo ao
 * contrario, que e o que a pessoa quis dizer.
 */

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function chave(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function FiltroPeriodo({ de, ate, hoje }: { de: string; ate: string; hoje: string }) {
  const router = useRouter()
  const raiz = useRef<HTMLDivElement>(null)
  const [aberto, setAberto] = useState(false)
  const [inicioEscolhido, setInicioEscolhido] = useState<string | null>(null)

  const [anoSel, mesSel] = de.split('-').map(Number)
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

  const atalhos = [
    { rotulo: 'Hoje', de: hoje, ate: hoje },
    { rotulo: '7 dias', de: somarDias(hoje, -6), ate: hoje },
    { rotulo: '30 dias', de: somarDias(hoje, -29), ate: hoje },
    { rotulo: 'Este mes', de: `${hoje.slice(0, 7)}-01`, ate: hoje },
  ]

  const ehAtalhoAtivo = atalhos.some((a) => a.de === de && a.ate === ate)

  function abrir() {
    setInicioEscolhido(null)
    setVisivel({ ano: anoSel, mes: mesSel - 1 })
    setAberto((v) => !v)
  }

  function mudarMes(passo: number) {
    setVisivel(({ ano, mes }) => {
      const d = new Date(Date.UTC(ano, mes + passo, 1))
      return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() }
    })
  }

  function escolher(dia: string) {
    if (!inicioEscolhido) {
      setInicioEscolhido(dia)
      return
    }
    const [inicio, fim] = dia < inicioEscolhido ? [dia, inicioEscolhido] : [inicioEscolhido, dia]
    setAberto(false)
    setInicioEscolhido(null)
    router.push(`/painel/relatorios?de=${inicio}&ate=${fim}`)
  }

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

  return (
    <div ref={raiz} className="relative flex flex-wrap items-center gap-2">
      {atalhos.map((a) => (
        <Link
          key={a.rotulo}
          href={`/painel/relatorios?de=${a.de}&ate=${a.ate}`}
          className={`${base} ${a.de === de && a.ate === ate ? escolhido : solto}`}
        >
          {a.rotulo}
        </Link>
      ))}

      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={abrir}
        className={`${base} gap-2 ${ehAtalhoAtivo ? solto : escolhido}`}
      >
        <CalendarDays size={18} aria-hidden />
        {ehAtalhoAtivo
          ? 'Escolher periodo'
          : `${de.split('-').reverse().join('/')} a ${ate.split('-').reverse().join('/')}`}
      </button>

      {aberto ? (
        <div
          role="dialog"
          aria-label="Escolher periodo"
          className="absolute right-0 top-13 z-30 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl"
        >
          <p className="mb-2 text-center text-sm font-semibold text-muted">
            {inicioEscolhido
              ? `Inicio ${inicioEscolhido.split('-').reverse().join('/')} - escolha o fim`
              : 'Escolha o primeiro dia'}
          </p>

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
              const noIntervalo = !inicioEscolhido && valor >= de && valor <= ate
              const ativo = valor === inicioEscolhido
              return (
                <button
                  key={valor}
                  type="button"
                  disabled={futuro}
                  onClick={() => escolher(valor)}
                  className={`mx-auto flex size-9 items-center justify-center rounded-full text-sm font-semibold ${
                    ativo
                      ? 'bg-brand font-black text-brand-foreground'
                      : noIntervalo
                        ? 'bg-brand/15 text-brand'
                        : futuro
                          ? 'text-muted/40'
                          : 'hover:bg-foreground/5'
                  } ${valor === hoje && !ativo ? 'border border-brand' : ''}`}
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
