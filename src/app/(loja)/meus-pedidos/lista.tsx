'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Card, Empty } from '@/components/ui/card'
import { assinarPedidos, lerPedidos, lerPedidosNoServidor } from '@/lib/carrinho/store'
import { moeda } from '@/lib/format'
import { ORDER_STATUS } from '@/lib/orders/status'
import { createClient } from '@/lib/supabase/client'
import type { OrderStatus } from '@/lib/types'
import { useSyncExternalStore } from 'react'

type Resumo = {
  public_token: string
  order_number: number
  status: OrderStatus
  created_at: string
  total: number
  /** O banco devolve null depois de entregue ou cancelado. */
  delivery_code: string | null
  fulfillment: 'entrega' | 'retirada'
}

const EM_ANDAMENTO: OrderStatus[] = [
  'recebido',
  'separando',
  'aguardando_entregador',
  'saiu_para_entrega',
]

/**
 * Lista dos pedidos deste aparelho.
 *
 * O localStorage guarda so token e numero - o suficiente para achar o pedido,
 * nao para saber em que pe ele esta. Por isso a tela busca o resumo de todos
 * de uma vez (get_orders_summary_by_tokens): o cliente quer bater o olho e ver
 * "o meu esta a caminho", e quer reler o codigo da entrega sem abrir pedido
 * por pedido.
 *
 * A lista guardada continua sendo a fonte da verdade de QUAIS pedidos existem:
 * se a busca falhar (rede ruim), ainda da para entrar em cada um pelo link.
 */
export function ListaMeusPedidos() {
  const guardados = useSyncExternalStore(assinarPedidos, lerPedidos, lerPedidosNoServidor)
  const [resumos, setResumos] = useState<Map<string, Resumo> | null>(null)

  useEffect(() => {
    if (!guardados?.length) return
    let vivo = true

    const buscar = async () => {
      const supabase = createClient()
      const { data } = await supabase.rpc('get_orders_summary_by_tokens', {
        p_tokens: guardados.map((p) => p.token),
      })
      if (!vivo) return
      const lista = (data ?? []) as Resumo[]
      setResumos(new Map(lista.map((r) => [r.public_token, r])))
    }

    void buscar()
    return () => {
      vivo = false
    }
  }, [guardados])

  if (guardados === null) return <Empty>Carregando...</Empty>
  if (guardados.length === 0) return <Empty>Voce ainda nao fez pedidos neste aparelho.</Empty>

  const emAndamento = guardados.filter((p) => {
    const r = resumos?.get(p.token)
    return r && EM_ANDAMENTO.includes(r.status)
  })
  const anteriores = guardados.filter((p) => !emAndamento.includes(p))

  return (
    <div className="space-y-4">
      {emAndamento.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-black">Em andamento</h2>
          {emAndamento.map((p) => (
            <PedidoAtual key={p.token} token={p.token} resumo={resumos!.get(p.token)!} />
          ))}
        </section>
      ) : null}

      {anteriores.length > 0 ? (
        <section className="space-y-2">
          {emAndamento.length > 0 ? <h2 className="text-lg font-black">Anteriores</h2> : null}
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {anteriores.map((p) => {
                const resumo = resumos?.get(p.token)
                return (
                  <li key={p.token}>
                    <Link
                      href={`/pedido/${p.token}`}
                      className="flex items-center justify-between gap-3 p-4"
                    >
                      <span className="min-w-0">
                        <span className="block font-bold">Pedido #{p.numero}</span>
                        <span className="text-sm text-muted">
                          {resumo
                            ? `${ORDER_STATUS[resumo.status].label} - ${moeda(Number(resumo.total))}`
                            : p.em
                              ? new Date(p.em).toLocaleString('pt-BR')
                              : 'Toque para ver'}
                        </span>
                      </span>
                      <span aria-hidden className="shrink-0 text-muted">
                        &rsaquo;
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  )
}

/**
 * Pedido que ainda esta acontecendo. Traz o codigo da entrega na propria
 * lista: e o numero que o cliente precisa ter na mao quando a moto chega, e
 * procurar por ele dentro do pedido, na hora da campainha, e o pior momento
 * possivel.
 */
function PedidoAtual({ token, resumo }: { token: string; resumo: Resumo }) {
  return (
    <Card className="space-y-3 border-brand">
      <Link href={`/pedido/${token}`} className="block space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xl font-black">Pedido #{resumo.order_number}</span>
          <span
            className={`rounded-full border px-3 py-1 text-sm font-bold ${ORDER_STATUS[resumo.status].tone}`}
          >
            {ORDER_STATUS[resumo.status].label}
          </span>
        </div>
        <p className="text-muted">
          {moeda(Number(resumo.total))} - toque para acompanhar
        </p>
      </Link>

      {resumo.delivery_code && resumo.fulfillment === 'entrega' ? (
        <div className="rounded-xl border-2 border-dashed border-brand bg-brand/5 p-3 text-center">
          <p className="text-sm font-bold">Codigo de confirmacao da entrega</p>
          <p className="text-3xl font-black tracking-[0.3em] text-brand">{resumo.delivery_code}</p>
          <p className="text-sm text-muted">Fale este numero ao entregador quando ele chegar.</p>
        </div>
      ) : null}
    </Card>
  )
}
