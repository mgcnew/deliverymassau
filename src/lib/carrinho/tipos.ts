import type { UnitType } from '@/lib/types'

/** Snapshot do produto no momento em que entrou no carrinho.
 *  O preco de verdade e sempre reconferido no banco na hora de fechar o pedido. */
export type ItemCarrinho = {
  productId: string
  slug: string
  name: string
  imagePath: string | null
  unitType: UnitType
  soldByWeight: boolean
  price: number
  /** unidades inteiras, ou kg com 3 casas para produtos por peso */
  quantity: number
  weightStep: number
  minWeight: number
  note: string
}

export const CHAVE_CARRINHO = 'massa24h:carrinho:v1'
export const CHAVE_PEDIDOS = 'massa24h:pedidos:v1'
export const CHAVE_DADOS_CHECKOUT = 'massa24h:checkout-dados:v1'

/** Nome, telefone e endereco do ultimo pedido feito neste aparelho, para
 *  nao pedir tudo de novo no proximo. Guardado so apos um pedido dar certo. */
export type DadosCheckoutSalvos = {
  nome: string
  telefone: string
  endereco: {
    cep: string
    rua: string
    numero: string
    bairro: string
    complemento: string
    referencia: string
  }
}

export function subtotalItem(item: ItemCarrinho): number {
  return Math.round(item.quantity * item.price * 100) / 100
}

export function subtotalCarrinho(itens: ItemCarrinho[]): number {
  return Math.round(itens.reduce((soma, i) => soma + subtotalItem(i), 0) * 100) / 100
}

export function quantidadeTotal(itens: ItemCarrinho[]): number {
  return itens.length
}
