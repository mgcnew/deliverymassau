'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { Receipt } from 'lucide-react'

import { assinarPedidos, lerPedidos, lerPedidosNoServidor } from '@/lib/carrinho/store'

/**
 * Atalho para "Meus pedidos" no cabecalho da loja.
 *
 * Antes, o unico caminho de volta para um pedido era o link recebido no fim
 * do checkout. Quem fechava a aba perdia o acompanhamento - e junto com ele o
 * codigo de confirmacao da entrega, que so aparece na pagina do pedido.
 *
 * So aparece para quem ja pediu alguma coisa neste aparelho: para o visitante
 * de primeira viagem seria um botao que leva a uma tela vazia.
 */
export function LinkMeusPedidos() {
  const pedidos = useSyncExternalStore(assinarPedidos, lerPedidos, lerPedidosNoServidor)

  if (!pedidos?.length) return null

  return (
    <Link
      href="/meus-pedidos"
      // O rotulo some no celular por falta de espaco, mas o nome acessivel
      // fica no aria-label - senao vira um botao sem nome para leitor de tela.
      aria-label="Meus pedidos"
      className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line px-3 text-sm font-bold"
    >
      <Receipt size={18} aria-hidden />
      <span className="hidden sm:inline">Meus pedidos</span>
    </Link>
  )
}
