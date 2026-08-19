'use client'

import { useEffect } from 'react'

import { CHAVE_PEDIDOS } from '@/lib/carrinho/tipos'

/** Abriu o link em outro aparelho? Ele passa a constar em "Meus pedidos" ali tambem. */
export function GuardarPedido({ token, numero }: { token: string; numero: number }) {
  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE_PEDIDOS)
      const lista = bruto ? (JSON.parse(bruto) as Array<{ token: string }>) : []
      if (lista.some((p) => p.token === token)) return
      localStorage.setItem(
        CHAVE_PEDIDOS,
        JSON.stringify([{ token, numero, em: new Date().toISOString() }, ...lista].slice(0, 30)),
      )
    } catch {
      // sem storage nao tem problema: o link continua valendo
    }
  }, [token, numero])

  return null
}
