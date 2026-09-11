'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'

import { cancelar, inscrever, inscricaoAtual, pushSuportado } from '@/lib/push/cliente'
import { liberarSom } from '@/lib/push/alerta-sonoro'
import { removerInscricaoPush, salvarInscricaoPush } from './actions'

/**
 * Liga os avisos de pedido novo neste aparelho.
 *
 * Um toque so resolve as duas metades do problema: pede a permissao de
 * notificacao (que cobre o app fechado) e, no mesmo gesto, destrava o audio
 * (que cobre o app aberto, com o celular no suporte da moto). Sao coisas
 * tecnicamente separadas, mas para quem usa e uma decisao unica: "quero ser
 * avisado neste celular".
 *
 * Fica na tela de entregas porque e la que a decisao faz sentido - e cada
 * aparelho decide por si, nao a conta: o mesmo entregador pode querer aviso
 * no celular do trabalho e nao no computador do balcao.
 */
export function AlertasEntregador({ chavePublica }: { chavePublica: string }) {
  const [estado, setEstado] = useState<'carregando' | 'indisponivel' | 'ligado' | 'desligado'>(
    'carregando',
  )
  const [erro, setErro] = useState<string | null>(null)
  const [processando, iniciar] = useTransition()

  useEffect(() => {
    let vivo = true

    // Tudo aqui depende de API do navegador (service worker, permissao), que
    // no servidor nao existe - por isso a checagem so acontece depois da
    // montagem, e nunca de forma sincrona dentro do efeito.
    const verificar = async () => {
      if (!pushSuportado() || !chavePublica) {
        if (vivo) setEstado('indisponivel')
        return
      }

      const inscricao = await inscricaoAtual()
      if (!vivo) return

      const ligado = Boolean(inscricao) && Notification.permission === 'granted'
      setEstado(ligado ? 'ligado' : 'desligado')
      // Ja estava ligado de outra visita: o toque de agora (abrir a tela) nao
      // serve de gesto, mas qualquer clique posterior libera o som.
      if (ligado) liberarSom()
    }

    void verificar()
    return () => {
      vivo = false
    }
  }, [chavePublica])

  function ligar() {
    setErro(null)
    // Antes do await: o navegador so aceita liberar audio dentro do gesto.
    liberarSom()

    iniciar(async () => {
      try {
        const dados = await inscrever(chavePublica)
        if (!dados) {
          setErro(
            Notification.permission === 'denied'
              ? 'O aviso esta bloqueado nas configuracoes do navegador para este site.'
              : 'Nao foi possivel ligar os avisos neste aparelho.',
          )
          return
        }
        const resultado = await salvarInscricaoPush(dados)
        if (resultado.erro) setErro(resultado.erro)
        else setEstado('ligado')
      } catch {
        setErro('Nao foi possivel ligar os avisos neste aparelho.')
      }
    })
  }

  function desligar() {
    setErro(null)
    iniciar(async () => {
      const endpoint = await cancelar()
      if (endpoint) await removerInscricaoPush(endpoint)
      setEstado('desligado')
    })
  }

  if (estado === 'carregando') return null

  if (estado === 'indisponivel') {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-muted">
        <BellOff size={16} aria-hidden />
        Este navegador nao avisa de pedido novo. No iPhone, instale o painel na tela de inicio.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {estado === 'ligado' ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BellRing size={16} className="text-brand-ink" aria-hidden />
            Avisos ligados neste aparelho
          </p>
          <button
            type="button"
            onClick={desligar}
            disabled={processando}
            className="shrink-0 text-sm font-semibold text-muted underline"
          >
            Desligar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={ligar}
          disabled={processando}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-bold text-brand-foreground hover:bg-brand-strong disabled:opacity-60"
        >
          <Bell size={18} aria-hidden />
          {processando ? 'Ligando...' : 'Me avisar de pedido novo'}
        </button>
      )}

      {erro ? (
        <p className="text-sm" style={{ color: 'var(--tone-error-fg)' }}>
          {erro}
        </p>
      ) : null}
    </div>
  )
}
