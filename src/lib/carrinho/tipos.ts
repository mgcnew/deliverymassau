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
export const CHAVE_DADOS_CHECKOUT_V2 = 'massa24h:checkout-dados:v2'

export type EnderecoSalvo = {
  id: string
  /** "Casa", "Trabalho", "Mae". Vazio ate o cliente nomear. */
  apelido: string
  cep: string
  rua: string
  numero: string
  bairro: string
  complemento: string
  referencia: string
}

/**
 * Nome, telefone e enderecos guardados NESTE APARELHO, para o proximo pedido
 * ja vir preenchido. Gravado so depois que um pedido da certo.
 *
 * Fica no aparelho, e nao no servidor atrelado ao telefone, por privacidade:
 * sem login, uma lista no servidor significaria que qualquer um que digitasse
 * o numero de outra pessoa veria o endereco da casa dela. Guardar por
 * telefone exigiria verificacao por SMS. A contrapartida e que a lista nao
 * acompanha quem troca de aparelho - a mesma regra que ja vale para o
 * carrinho e para "Meus pedidos".
 *
 * A v1 guardava UM endereco (`endereco`). A v2 guarda uma lista; a conversao
 * acontece na leitura, entao quem ja tinha um endereco salvo nao perde nada.
 */
export type DadosCheckoutSalvos = {
  nome: string
  telefone: string
  enderecos: EnderecoSalvo[]
  /** Qual deles veio no ultimo pedido: e o que o formulario abre preenchido. */
  ultimoId: string | null
}

/** Formato antigo, so para converter o que ja esta gravado nos aparelhos. */
export type DadosCheckoutV1 = {
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

/** Dois enderecos sao "o mesmo" quando rua, numero e bairro coincidem - o
 *  apelido e o complemento nao entram, senao "Casa" e "casa" viram dois. */
export function mesmoEndereco(a: Partial<EnderecoSalvo>, b: Partial<EnderecoSalvo>) {
  const n = (t?: string) => (t ?? '').trim().toLowerCase()
  return n(a.rua) === n(b.rua) && n(a.numero) === n(b.numero) && n(a.bairro) === n(b.bairro)
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
