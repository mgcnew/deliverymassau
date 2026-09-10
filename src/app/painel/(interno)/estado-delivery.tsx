'use client'

import { useState, useTransition } from 'react'

import { Button, buttonClass } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmarAcao } from '@/components/ui/confirmar-acao'
import { quando, type EstadoDelivery } from '@/lib/horario'
import { definirManual, voltarAoHorario } from './configuracoes/actions'

/**
 * Delivery aberto ou fechado, e por que - na pagina inicial e na aba
 * Delivery das configuracoes.
 *
 * Antes era um interruptor liga/desliga que alguem tinha que lembrar de usar
 * todo dia. Agora quem manda e o horario da semana, e o botao e a excecao:
 * "Fechar agora" dentro do horario, "Abrir agora" fora dele. A excecao vale
 * ate a proxima troca do horario e volta sozinha ao automatico.
 */
export function EstadoDeliveryCard({
  estado,
  podeAlterar,
}: {
  estado: EstadoDelivery
  podeAlterar: boolean
}) {
  const [pendente, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const q = (iso: string) => quando(iso, estado.fuso)

  function explicacao() {
    const { aberto, motivo, fecha_em, abre_em, manual_ate } = estado
    if (motivo === 'sempre') return 'Aberto 24 horas, todos os dias.'
    if (motivo === 'horario') {
      if (aberto) return fecha_em ? `Pelo horario. Fecha ${q(fecha_em)}.` : 'Pelo horario.'
      return abre_em ? `Fora do horario. Abre ${q(abre_em)}.` : 'Fora do horario, sem abertura na semana.'
    }
    if (aberto) {
      return fecha_em
        ? `Aberto manualmente. Fecha ${q(fecha_em)} e volta a seguir o horario.`
        : 'Aberto manualmente.'
    }
    if (!manual_ate) return 'Fechado manualmente, ate alguem reabrir.'
    return abre_em ? `Fechado manualmente. Reabre ${q(abre_em)}.` : 'Fechado manualmente.'
  }

  // O que acontece depois do toque, dito antes de confirmar. A excecao vale
  // ate a proxima troca do horario - que, para quem fecha dentro do horario,
  // e o fechamento normal: dali em diante e o horario que decide quando abre.
  const avisoFechar = estado.troca_horario
    ? `Pedidos novos param agora. O horario normal volta a valer ${q(estado.troca_horario)}. Pedidos em andamento seguem normalmente.`
    : 'Pedidos novos param agora e o delivery fica fechado ate alguem reabrir. Pedidos em andamento seguem normalmente.'
  const avisoAbrir =
    estado.motivo === 'manual'
      ? 'O fechamento manual e desfeito e o delivery volta a aceitar pedidos.'
      : estado.troca_horario
        ? `O delivery passa a aceitar pedidos fora do horario. A partir de ${q(estado.troca_horario)} volta a seguir o horario normal.`
        : 'O delivery passa a aceitar pedidos agora.'

  async function rodar(acao: () => Promise<{ erro?: string }>) {
    setErro(null)
    const r = await acao()
    if (r.erro) setErro(r.erro)
    return r
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">Delivery</p>
          <p className="flex items-center gap-2 text-lg font-bold">
            <span
              aria-hidden
              className={`size-2.5 shrink-0 rounded-full ${estado.aberto ? 'bg-emerald-500' : 'bg-rose-500'}`}
            />
            {estado.aberto ? 'Aberto para pedidos' : 'Fechado para pedidos'}
          </p>
          <p className="text-sm text-muted">{explicacao()}</p>
        </div>

        {!podeAlterar ? (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
              estado.aberto
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200'
                : 'bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-200'
            }`}
          >
            {estado.aberto ? 'Aberto' : 'Fechado'}
          </span>
        ) : null}
      </div>

      {podeAlterar ? (
        <div className="flex flex-wrap gap-2">
          {estado.aberto ? (
            <ConfirmarAcao
              className={buttonClass('danger')}
              disabled={pendente}
              titulo="Fechar o delivery agora?"
              descricao={avisoFechar}
              rotuloConfirmar="Fechar agora"
              onConfirmar={() => rodar(() => definirManual('fechado'))}
            >
              Fechar agora
            </ConfirmarAcao>
          ) : (
            <ConfirmarAcao
              className={buttonClass('primary')}
              disabled={pendente}
              titulo="Abrir o delivery agora?"
              descricao={avisoAbrir}
              rotuloConfirmar="Abrir agora"
              variante="secondary"
              onConfirmar={() => rodar(() => definirManual('aberto'))}
            >
              Abrir agora
            </ConfirmarAcao>
          )}

          {estado.motivo === 'manual' ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pendente}
              onClick={() => startTransition(async () => void (await rodar(voltarAoHorario)))}
            >
              Voltar ao horario
            </Button>
          ) : null}
        </div>
      ) : null}

      {erro ? (
        <p role="status" aria-live="polite" className="text-sm font-semibold text-[var(--tone-error-fg)]">
          {erro}
        </p>
      ) : null}
    </Card>
  )
}
