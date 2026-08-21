'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { RealtimeChannel } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'
import { ORDER_STATUS } from '@/lib/orders/status'
import { Empty } from '@/components/ui/card'
import { RolagemHorizontal } from '@/components/ui/rolagem-horizontal'
import type { OrderStatus } from '@/lib/types'
import { CardPedido } from './card-pedido'
import type { PedidoOperacional } from './tipos'

const COLUNAS: OrderStatus[] = [
  'recebido',
  'separando',
  'aguardando_entregador',
  'saiu_para_entrega',
]

export function PainelPedidos({
  pedidos,
  finalizados,
  rotuloDia,
  podeSeparar,
  podeImprimir,
}: {
  pedidos: PedidoOperacional[]
  finalizados: PedidoOperacional[]
  /** "hoje", "ontem" ou "21/08" - so os finalizados seguem o filtro de data. */
  rotuloDia: string
  podeSeparar: boolean
  podeImprimir: boolean
}) {
  const router = useRouter()
  const [aba, setAba] = useState<OrderStatus | 'finalizados'>('recebido')

  // Tempo real. Duas sutilezas que custaram caro:
  // 1) o socket precisa do token ANTES de assinar, senao o Realtime avalia a RLS
  //    como visitante anonimo e nenhum evento de pedido chega;
  // 2) rede de balcao cai. O intervalo e a rede de seguranca para o caso de o
  //    socket morrer sem avisar - num 24h e pior perder pedido do que gastar
  //    uma consulta a cada 30 segundos.
  useEffect(() => {
    const supabase = createClient()
    let canal: RealtimeChannel | null = null
    let vivo = true

    // Uma separacao pesa varios itens em sequencia rapida: cada pesagem
    // dispara UPDATE em order_items + orders, ou seja, varios eventos em
    // menos de 1s. Sem agrupar, cada um deles disparava um refresh
    // completo da pagina - agrupa numa janela curta e refaz so uma vez.
    let temporizador: ReturnType<typeof setTimeout> | null = null
    const atualizarAgrupado = () => {
      if (temporizador) clearTimeout(temporizador)
      temporizador = setTimeout(() => router.refresh(), 400)
    }

    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!vivo) return
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token)

      canal = supabase
        .channel('operacao-pedidos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, atualizarAgrupado)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, atualizarAgrupado)
        .subscribe()
    })()

    const intervalo = setInterval(() => router.refresh(), 30_000)

    return () => {
      vivo = false
      if (temporizador) clearTimeout(temporizador)
      clearInterval(intervalo)
      if (canal) supabase.removeChannel(canal)
    }
  }, [router])

  const porStatus = (status: OrderStatus) => pedidos.filter((p) => p.status === status)
  const daAba = aba === 'finalizados' ? finalizados : porStatus(aba)

  return (
    <>
      {/* Celular e tablet: uma coluna por vez, com contador em cada aba */}
      <div className="space-y-3 lg:hidden">
        <RolagemHorizontal>
          <div className="flex w-max gap-2">
            {COLUNAS.map((status) => {
              const total = porStatus(status).length
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setAba(status)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold ${
                    aba === status ? 'bg-brand text-brand-foreground' : 'border border-line bg-surface'
                  }`}
                >
                  {ORDER_STATUS[status].short}
                  <span
                    className={`rounded-full px-1.5 text-xs ${
                      aba === status ? 'bg-white/25' : 'bg-foreground/10'
                    }`}
                  >
                    {total}
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setAba('finalizados')}
              className={`rounded-full px-4 py-2.5 text-sm font-bold ${
                aba === 'finalizados'
                  ? 'bg-brand text-brand-foreground'
                  : 'border border-line bg-surface'
              }`}
            >
              Finalizados {rotuloDia}
            </button>
          </div>
        </RolagemHorizontal>

        {daAba.length === 0 ? (
          <Empty>
            {aba === 'finalizados'
              ? `Nenhum pedido finalizado ${rotuloDia}.`
              : 'Nenhum pedido aqui agora.'}
          </Empty>
        ) : (
          <div className="space-y-3">
            {daAba.map((p) => (
              <CardPedido key={p.id} pedido={p} podeSeparar={podeSeparar} podeImprimir={podeImprimir} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: quadro com todas as colunas. Em vez de forcar rolagem
          horizontal com largura fixa (que cortava a ultima coluna dependendo
          da largura da tela), a grade se reorganiza - 2 colunas em telas
          menores, ate 5 lado a lado nas bem largas. Nada fica escondido. */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-5">
          {COLUNAS.map((status) => {
            const lista = porStatus(status)
            return (
              <section key={status} className="space-y-2">
                <h2 className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wide">
                  {ORDER_STATUS[status].short}
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">{lista.length}</span>
                </h2>
                <div className="space-y-2">
                  {lista.map((p) => (
                    <CardPedido key={p.id} pedido={p} podeSeparar={podeSeparar} podeImprimir={podeImprimir} />
                  ))}
                </div>
              </section>
            )
          })}

          <section className="space-y-2">
            <h2 className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wide">
              Finalizados {rotuloDia}
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                {finalizados.length}
              </span>
            </h2>
            <div className="space-y-2">
              {finalizados.map((p) => (
                <CardPedido key={p.id} pedido={p} podeSeparar={false} podeImprimir={podeImprimir} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
