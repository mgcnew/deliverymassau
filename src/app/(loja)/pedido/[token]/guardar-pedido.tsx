'use client'

import { useEffect } from 'react'

import { guardarPedido } from '@/lib/carrinho/store'

/** Abriu o link em outro aparelho? Ele passa a constar em "Meus pedidos" ali tambem. */
export function GuardarPedido({ token, numero }: { token: string; numero: number }) {
  useEffect(() => {
    guardarPedido(token, numero)
  }, [token, numero])

  return null
}
