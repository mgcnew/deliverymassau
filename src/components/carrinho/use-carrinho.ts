'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

import {
  assinarCarrinho,
  atualizarCarrinho,
  lerCarrinho,
  lerCarrinhoNoServidor,
} from '@/lib/carrinho/store'
import { subtotalCarrinho, type ItemCarrinho } from '@/lib/carrinho/tipos'

/** Peso guarda 3 casas (grama); unidade e sempre inteiro. */
function arredondar(valor: number, porPeso: boolean): number {
  return porPeso ? Math.round(valor * 1000) / 1000 : Math.round(valor)
}

export function useCarrinho() {
  const { itens, carregado } = useSyncExternalStore(
    assinarCarrinho,
    lerCarrinho,
    lerCarrinhoNoServidor,
  )

  const adicionar = useCallback((novo: ItemCarrinho) => {
    atualizarCarrinho((atual) => {
      const existente = atual.find((i) => i.productId === novo.productId)
      if (!existente) return [...atual, novo]
      return atual.map((i) =>
        i.productId === novo.productId
          ? { ...i, quantity: arredondar(i.quantity + novo.quantity, i.soldByWeight) }
          : i,
      )
    })
  }, [])

  /** Soma/subtrai a partir do estado mais recente: toques rapidos nao se perdem. */
  const ajustar = useCallback((productId: string, delta: number) => {
    atualizarCarrinho((atual) =>
      atual.flatMap((i) => {
        if (i.productId !== productId) return [i]
        const q = arredondar(i.quantity + delta, i.soldByWeight)
        return q <= 0 ? [] : [{ ...i, quantity: q }]
      }),
    )
  }, [])

  const definirObservacao = useCallback((productId: string, nota: string) => {
    atualizarCarrinho((atual) =>
      atual.map((i) => (i.productId === productId ? { ...i, note: nota } : i)),
    )
  }, [])

  const remover = useCallback((productId: string) => {
    atualizarCarrinho((atual) => atual.filter((i) => i.productId !== productId))
  }, [])

  const limpar = useCallback(() => atualizarCarrinho(() => []), [])

  return useMemo(
    () => ({
      itens,
      carregado,
      subtotal: subtotalCarrinho(itens),
      adicionar,
      ajustar,
      definirObservacao,
      remover,
      limpar,
      quantidadeDe: (productId: string) =>
        itens.find((i) => i.productId === productId)?.quantity ?? 0,
    }),
    [itens, carregado, adicionar, ajustar, definirObservacao, remover, limpar],
  )
}
