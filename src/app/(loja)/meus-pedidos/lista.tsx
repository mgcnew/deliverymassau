'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Card, Empty } from '@/components/ui/card'
import { CHAVE_PEDIDOS } from '@/lib/carrinho/tipos'

type PedidoSalvo = { token: string; numero: number; em?: string }

export function ListaMeusPedidos() {
  const [pedidos, setPedidos] = useState<PedidoSalvo[] | null>(null)

  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE_PEDIDOS)
      setPedidos(bruto ? (JSON.parse(bruto) as PedidoSalvo[]) : [])
    } catch {
      setPedidos([])
    }
  }, [])

  if (pedidos === null) return <Empty>Carregando...</Empty>
  if (pedidos.length === 0) return <Empty>Voce ainda nao fez pedidos neste aparelho.</Empty>

  return (
    <Card className="p-0">
      <ul className="divide-y divide-line">
        {pedidos.map((p) => (
          <li key={p.token}>
            <Link
              href={`/pedido/${p.token}`}
              className="flex items-center justify-between gap-3 p-4"
            >
              <span>
                <span className="block font-bold">Pedido #{p.numero}</span>
                {p.em ? (
                  <span className="text-sm text-muted">
                    {new Date(p.em).toLocaleString('pt-BR')}
                  </span>
                ) : null}
              </span>
              <span aria-hidden className="text-muted">
                &rsaquo;
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
