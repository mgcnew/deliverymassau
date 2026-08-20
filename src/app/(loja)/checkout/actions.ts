'use server'

import { createClient } from '@/lib/supabase/server'
import { moeda } from '@/lib/format'
import type { PaymentMethod } from '@/lib/types'

export type EntradaPedido = {
  nome: string
  telefone: string
  endereco: {
    cep?: string
    rua: string
    numero: string
    bairro: string
    complemento?: string
    referencia?: string
  }
  pagamento: PaymentMethod
  precisaTroco: boolean
  trocoPara?: number
  observacao?: string
  itens: Array<{ product_id: string; quantity: number; note?: string }>
  /** Total que o cliente viu na tela. Se divergir, o banco recusa e a gente confirma de novo. */
  totalEsperado?: number
}

export type ResultadoPedido = {
  erro?: string
  precisaConfirmarPreco?: boolean
  totalNovo?: number
  pedido?: { numero: number; token: string; total: number; troco: number | null }
}

export async function criarPedido(entrada: EntradaPedido): Promise<ResultadoPedido> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('create_public_order', {
    p_payload: {
      customer: { name: entrada.nome, phone: entrada.telefone },
      address: {
        cep: entrada.endereco.cep ?? null,
        street: entrada.endereco.rua,
        number: entrada.endereco.numero,
        district: entrada.endereco.bairro,
        complement: entrada.endereco.complemento ?? null,
        reference: entrada.endereco.referencia ?? null,
      },
      payment_method: entrada.pagamento,
      needs_change: entrada.precisaTroco,
      change_for: entrada.trocoPara ?? null,
      note: entrada.observacao ?? null,
      items: entrada.itens.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        note: i.note ?? null,
      })),
      ...(entrada.totalEsperado !== undefined ? { expected_total: entrada.totalEsperado } : {}),
    },
  })

  if (error) return traduzirErro(error.message, error.details)

  const retorno = data as {
    order_number: number
    public_token: string
    total: number
    change_amount: number | null
  }

  return {
    pedido: {
      numero: retorno.order_number,
      token: retorno.public_token,
      total: Number(retorno.total),
      troco: retorno.change_amount === null ? null : Number(retorno.change_amount),
    },
  }
}

function traduzirErro(mensagem: string, detalhe?: string | null): ResultadoPedido {
  const codigo = mensagem.trim()

  switch (codigo) {
    case 'DELIVERY_FECHADO':
      return { erro: detalhe || 'O delivery esta fechado no momento.' }

    case 'NOME_OBRIGATORIO':
      return { erro: 'Informe seu nome.' }

    case 'TELEFONE_INVALIDO':
      return { erro: 'Telefone invalido. Use DDD + numero, como (75) 99999-9999.' }

    case 'CLIENTE_BLOQUEADO':
      return { erro: 'Nao foi possivel concluir seu pedido. Entre em contato com o mercado.' }

    case 'CARRINHO_VAZIO':
      return { erro: 'Seu carrinho esta vazio.' }

    case 'PRODUTO_INEXISTENTE':
      return { erro: 'Um dos produtos saiu do catalogo. Revise o carrinho.' }

    case 'PRODUTO_INDISPONIVEL':
      return {
        erro: `Acabou durante a sua compra: ${detalhe}. Remova do carrinho para continuar.`,
      }

    case 'QUANTIDADE_INVALIDA':
      return { erro: 'Ha um item com quantidade invalida no carrinho.' }

    case 'PEDIDO_MINIMO': {
      const info = lerJson(detalhe)
      return {
        erro: `Faltam ${moeda(Number(info?.faltam ?? 0))} para atingir o pedido minimo de ${moeda(
          Number(info?.minimo ?? 0),
        )}.`,
      }
    }

    case 'FORA_DA_AREA':
      return {
        erro: `Ainda nao entregamos em ${detalhe || 'nesse bairro'}. Escolha um bairro atendido.`,
      }

    case 'PRECO_ALTERADO': {
      const info = lerJson(detalhe)
      return {
        precisaConfirmarPreco: true,
        totalNovo: Number(info?.total_atual ?? 0),
        erro: `O valor mudou para ${moeda(Number(info?.total_atual ?? 0))}. Confira e confirme.`,
      }
    }

    case 'PAGAMENTO_INDISPONIVEL':
      return { erro: 'Essa forma de pagamento nao esta disponivel agora.' }

    case 'TROCO_SO_DINHEIRO':
      return { erro: 'Troco so faz sentido para pagamento em dinheiro.' }

    case 'TROCO_INSUFICIENTE': {
      const info = lerJson(detalhe)
      return {
        erro: `O valor para troco precisa ser maior que o total do pedido (${moeda(
          Number(info?.total ?? 0),
        )}).`,
      }
    }

    default:
      return { erro: 'Nao foi possivel concluir o pedido. Tente novamente em instantes.' }
  }
}

function lerJson(texto?: string | null): Record<string, unknown> | null {
  if (!texto) return null
  try {
    return JSON.parse(texto) as Record<string, unknown>
  } catch {
    return null
  }
}
