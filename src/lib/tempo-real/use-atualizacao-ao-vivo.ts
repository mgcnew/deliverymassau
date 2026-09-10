'use client'

import { useEffect, useEffectEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'

/**
 * (O prefixo `use` e exigencia do React para hooks - o resto do projeto
 * segue em portugues.)
 *
 * Mantem a tela em dia sozinha: Realtime + tres redes de seguranca. Usado
 * pela fila de entregas e pela tela de pedidos do painel (postgres_changes
 * nas `tabelas`) e pelas telas do cliente (broadcast nos `topicos`, ver
 * migration 0035 - cliente e anonimo e a RLS nao entrega postgres_changes
 * de pedido para ele).
 *
 * Sutilezas que custaram caro:
 *
 * 1) O socket precisa do token ANTES de assinar, senao o Realtime avalia a
 *    RLS como visitante anonimo e nenhum evento chega.
 *
 * 2) Celular no bolso e o caso normal do entregador: com o app em segundo
 *    plano o navegador suspende o socket E congela o setInterval. Ao voltar,
 *    a tela ficava mostrando a fila de minutos atras ate o proximo intervalo
 *    - era o "preciso recarregar" que a equipe sentia. Por isso o refresh
 *    dispara no visibilitychange e no focus, no instante em que a tela volta.
 *
 * 3) Rede de rua cai e volta. O evento `online` refaz a busca na hora, e o
 *    intervalo cobre o caso do socket morrer sem avisar - num 24h e pior
 *    perder pedido do que gastar uma consulta de tempos em tempos.
 *
 * O intervalo so roda com a aba visivel: em segundo plano ele nao ajuda
 * (o navegador atrasa o timer de qualquer jeito) e so gasta bateria.
 *
 * `aoAtualizar` troca o router.refresh() padrao, para tela que busca os
 * dados no navegador em vez de no servidor (Meus pedidos).
 */
export function useAtualizacaoAoVivo({
  canal: nomeDoCanal,
  tabelas = [],
  topicos = [],
  intervaloMs = 30_000,
  aoAtualizar,
}: {
  canal: string
  tabelas?: string[]
  topicos?: string[]
  intervaloMs?: number
  aoAtualizar?: () => void
}) {
  const router = useRouter()
  // Quem chama passa a lista inline ({ tabelas: ['orders'] }), e um array
  // novo a cada render reassinaria o canal a cada render. A string e estavel.
  const chaveTabelas = tabelas.join(',')
  const chaveTopicos = topicos.join(',')

  const atualizar = useEffectEvent(() => {
    if (aoAtualizar) aoAtualizar()
    else router.refresh()
  })

  useEffect(() => {
    const supabase = createClient()
    const canais: RealtimeChannel[] = []
    let vivo = true

    // Uma separacao pesa varios itens em sequencia: cada pesagem dispara
    // UPDATE em order_items e em orders, varios eventos em menos de 1s.
    // Sem agrupar, cada um virava um refresh completo da pagina.
    let temporizador: ReturnType<typeof setTimeout> | null = null
    const atualizarAgrupado = () => {
      if (temporizador) clearTimeout(temporizador)
      temporizador = setTimeout(atualizar, 400)
    }

    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!vivo) return
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token)
      if (!vivo) return

      if (chaveTabelas) {
        let assinatura = supabase.channel(nomeDoCanal)
        for (const table of chaveTabelas.split(',')) {
          assinatura = assinatura.on(
            'postgres_changes',
            { event: '*', schema: 'public', table },
            atualizarAgrupado,
          )
        }
        canais.push(assinatura.subscribe())
      }

      if (chaveTopicos) {
        for (const topico of chaveTopicos.split(',')) {
          canais.push(
            supabase
              .channel(topico)
              .on('broadcast', { event: 'pedido_atualizado' }, atualizarAgrupado)
              .subscribe(),
          )
        }
      }
    })()

    // Voltou a olhar a tela: atualiza agora, sem esperar intervalo nenhum.
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') atualizarAgrupado()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)
    window.addEventListener('online', atualizarAgrupado)

    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') atualizar()
    }, intervaloMs)

    return () => {
      vivo = false
      if (temporizador) clearTimeout(temporizador)
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
      window.removeEventListener('online', atualizarAgrupado)
      for (const canal of canais) supabase.removeChannel(canal)
    }
  }, [nomeDoCanal, intervaloMs, chaveTabelas, chaveTopicos])
}
