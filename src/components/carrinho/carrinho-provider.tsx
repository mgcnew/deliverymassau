'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { CHAVE_CARRINHO, subtotalCarrinho, type ItemCarrinho } from '@/lib/carrinho/tipos'

type CarrinhoContexto = {
  itens: ItemCarrinho[]
  carregado: boolean
  subtotal: number
  adicionar: (item: ItemCarrinho) => void
  /** Soma/subtrai sempre a partir do estado mais recente: toques rapidos nao se perdem. */
  ajustar: (productId: string, delta: number) => void
  definirQuantidade: (productId: string, quantidade: number) => void
  definirObservacao: (productId: string, nota: string) => void
  remover: (productId: string) => void
  limpar: () => void
  quantidadeDe: (productId: string) => number
}

const Contexto = createContext<CarrinhoContexto | null>(null)

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([])
  const [carregado, setCarregado] = useState(false)

  // O carrinho vive no aparelho do cliente: sem conta, sem login.
  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE_CARRINHO)
      if (bruto) setItens(JSON.parse(bruto) as ItemCarrinho[])
    } catch {
      // storage indisponivel (aba anonima, cota cheia): segue com carrinho vazio
    }
    setCarregado(true)
  }, [])

  useEffect(() => {
    if (!carregado) return
    try {
      localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens))
    } catch {
      // ignora falha de escrita: o carrinho continua valendo nesta sessao
    }
  }, [itens, carregado])

  const adicionar = useCallback((novo: ItemCarrinho) => {
    setItens((atual) => {
      const existente = atual.find((i) => i.productId === novo.productId)
      if (!existente) return [...atual, novo]
      return atual.map((i) =>
        i.productId === novo.productId
          ? { ...i, quantity: arredondar(i.quantity + novo.quantity, i.soldByWeight) }
          : i,
      )
    })
  }, [])

  const ajustar = useCallback((productId: string, delta: number) => {
    setItens((atual) =>
      atual.flatMap((i) => {
        if (i.productId !== productId) return [i]
        const q = arredondar(i.quantity + delta, i.soldByWeight)
        return q <= 0 ? [] : [{ ...i, quantity: q }]
      }),
    )
  }, [])

  const definirQuantidade = useCallback((productId: string, quantidade: number) => {
    setItens((atual) =>
      atual.flatMap((i) => {
        if (i.productId !== productId) return [i]
        const q = arredondar(quantidade, i.soldByWeight)
        return q <= 0 ? [] : [{ ...i, quantity: q }]
      }),
    )
  }, [])

  const definirObservacao = useCallback((productId: string, nota: string) => {
    setItens((atual) => atual.map((i) => (i.productId === productId ? { ...i, note: nota } : i)))
  }, [])

  const remover = useCallback((productId: string) => {
    setItens((atual) => atual.filter((i) => i.productId !== productId))
  }, [])

  const limpar = useCallback(() => setItens([]), [])

  const valor = useMemo<CarrinhoContexto>(
    () => ({
      itens,
      carregado,
      subtotal: subtotalCarrinho(itens),
      adicionar,
      ajustar,
      definirQuantidade,
      definirObservacao,
      remover,
      limpar,
      quantidadeDe: (productId) => itens.find((i) => i.productId === productId)?.quantity ?? 0,
    }),
    [itens, carregado, adicionar, ajustar, definirQuantidade, definirObservacao, remover, limpar],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useCarrinho() {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useCarrinho precisa estar dentro de CarrinhoProvider')
  return contexto
}

/** Peso guarda 3 casas (grama); unidade e sempre inteiro. */
function arredondar(valor: number, porPeso: boolean): number {
  return porPeso ? Math.round(valor * 1000) / 1000 : Math.round(valor)
}
