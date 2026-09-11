'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Alert, Card, CardTitle } from '@/components/ui/card'
import { NOMES_DIAS, ORDEM_DIAS, type DiaHorario, type ModoDia } from '@/lib/horario'
import { salvarHorarios } from './actions'

/**
 * Horario de funcionamento do delivery, um horario corrido por dia.
 *
 * Fechamento antes da abertura (18:00 as 02:00) quer dizer que passa da
 * meia-noite: o banco conta o fim da noite como parte do dia em que abriu.
 */

type Linha = { weekday: number; mode: ModoDia; opens_at: string; closes_at: string }

const MODOS: Array<{ valor: ModoDia; rotulo: string }> = [
  { valor: 'horario', rotulo: 'Horario' },
  { valor: '24h', rotulo: '24 horas' },
  { valor: 'fechado', rotulo: 'Fechado' },
]

function paraLinhas(dias: DiaHorario[]): Linha[] {
  const porDia = new Map(dias.map((d) => [d.weekday, d]))
  return ORDEM_DIAS.map((w) => {
    const d = porDia.get(w)
    return {
      weekday: w,
      mode: d?.mode ?? '24h',
      // Quem troca de 24h para horario ja encontra um horario comum preenchido.
      opens_at: d?.opens_at ?? '08:00',
      closes_at: d?.closes_at ?? '22:00',
    }
  })
}

export function HorarioDelivery({ dias }: { dias: DiaHorario[] }) {
  const [linhas, setLinhas] = useState(() => paraLinhas(dias))
  const [pendente, startTransition] = useTransition()
  const [resultado, setResultado] = useState<{ erro?: string; ok?: string }>({})

  function mudar(weekday: number, patch: Partial<Linha>) {
    setResultado({})
    setLinhas((atual) => atual.map((l) => (l.weekday === weekday ? { ...l, ...patch } : l)))
  }

  function copiarParaTodos(origem: Linha) {
    setResultado({})
    setLinhas((atual) =>
      atual.map((l) => ({ ...l, mode: origem.mode, opens_at: origem.opens_at, closes_at: origem.closes_at })),
    )
  }

  function salvar() {
    startTransition(async () => {
      setResultado(await salvarHorarios(linhas))
    })
  }

  const tudo24h = linhas.every((l) => l.mode === '24h')

  return (
    <Card>
      <CardTitle>Horario de funcionamento</CardTitle>
      <p className="-mt-1 mb-3 text-sm text-muted">
        Fora do horario a loja continua no ar, avisando quando abre, mas nao aceita pedido. Para
        abrir ou fechar numa ocasiao, use o botao acima: ele vale ate a proxima troca do horario.
      </p>

      <ul className="divide-y divide-line">
        {linhas.map((l) => {
          const viraDia = l.mode === 'horario' && l.closes_at <= l.opens_at
          return (
            <li key={l.weekday} className="space-y-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{NOMES_DIAS[l.weekday]}</span>
                <button
                  type="button"
                  onClick={() => copiarParaTodos(l)}
                  className="text-sm font-semibold text-brand-ink"
                >
                  Copiar para todos
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={l.mode}
                  onChange={(e) => mudar(l.weekday, { mode: e.target.value as ModoDia })}
                  aria-label={`${NOMES_DIAS[l.weekday]}: tipo de horario`}
                  className="h-11 rounded-xl border border-line bg-surface px-3 font-semibold"
                >
                  {MODOS.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.rotulo}
                    </option>
                  ))}
                </select>

                {l.mode === 'horario' ? (
                  <>
                    <input
                      type="time"
                      value={l.opens_at}
                      onChange={(e) => mudar(l.weekday, { opens_at: e.target.value })}
                      aria-label={`${NOMES_DIAS[l.weekday]}: abre`}
                      required
                      className="h-11 rounded-xl border border-line bg-surface px-3"
                    />
                    <span className="text-sm text-muted">as</span>
                    <input
                      type="time"
                      value={l.closes_at}
                      onChange={(e) => mudar(l.weekday, { closes_at: e.target.value })}
                      aria-label={`${NOMES_DIAS[l.weekday]}: fecha`}
                      required
                      className="h-11 rounded-xl border border-line bg-surface px-3"
                    />
                  </>
                ) : null}
              </div>

              {viraDia && l.closes_at !== l.opens_at ? (
                <p className="text-xs text-muted">Fecha depois da meia-noite, ja no dia seguinte.</p>
              ) : null}
            </li>
          )
        })}
      </ul>

      {tudo24h ? (
        <p className="mt-2 text-sm text-muted">
          Com todos os dias em 24 horas, o delivery fica sempre aberto (so fecha pelo botao).
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {resultado.erro ? <Alert tone="error">{resultado.erro}</Alert> : null}
        {resultado.ok ? <Alert tone="success">{resultado.ok}</Alert> : null}
        <Button type="button" onClick={salvar} disabled={pendente}>
          {pendente ? 'Salvando...' : 'Salvar horario'}
        </Button>
      </div>
    </Card>
  )
}
