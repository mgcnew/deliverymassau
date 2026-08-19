'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

export type AcaoState = { erro?: string; ok?: string }

/** Todas as acoes passam por RPC: a permissao e a transicao sao validadas no banco. */
async function chamar(rpc: string, args: Record<string, unknown>): Promise<AcaoState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc(rpc, args)

  if (error) return { erro: traduzir(error.message, error.details) }

  revalidatePath('/painel/pedidos')
  return { ok: 'Pronto.' }
}

export async function iniciarSeparacao(orderId: string) {
  return chamar('start_separation', { p_order_id: orderId })
}

export async function concluirSeparacao(orderId: string) {
  return chamar('finish_separation', { p_order_id: orderId })
}

export async function cancelarPedido(orderId: string, motivo: string) {
  if (!motivo.trim()) return { erro: 'Informe o motivo do cancelamento.' }
  return chamar('cancel_order', { p_order_id: orderId, p_reason: motivo.trim() })
}

export async function iniciarEntrega(orderId: string) {
  return chamar('start_delivery', { p_order_id: orderId })
}

export async function finalizarEntrega(orderId: string) {
  return chamar('finish_delivery', { p_order_id: orderId })
}

export async function assumirEntrega(orderId: string) {
  return chamar('claim_delivery', { p_order_id: orderId })
}

export async function liberarEntrega(orderId: string) {
  return chamar('release_delivery', { p_order_id: orderId })
}

function traduzir(mensagem: string, detalhe?: string | null): string {
  switch (mensagem.trim()) {
    case 'SEM_PERMISSAO':
      return `Voce nao tem a permissao necessaria${detalhe ? ` (${detalhe})` : ''}.`
    case 'PEDIDO_NAO_ESTA_RECEBIDO':
      return 'Outra pessoa ja comecou a separar este pedido.'
    case 'PEDIDO_NAO_ESTA_EM_SEPARACAO':
      return 'O pedido nao esta mais em separacao.'
    case 'ITENS_PENDENTES':
      return 'Ainda ha itens sem conferir na separacao.'
    case 'PEDIDO_NAO_PODE_SER_CANCELADO':
      return 'Este pedido nao pode mais ser cancelado.'
    case 'MOTIVO_OBRIGATORIO':
      return 'Informe o motivo do cancelamento.'
    case 'ENTREGA_JA_ASSUMIDA':
      return 'Outro entregador assumiu esta entrega.'
    case 'ENTREGA_JA_INICIADA':
      return 'A entrega ja comecou e nao pode ser liberada.'
    case 'ENTREGA_NAO_DISPONIVEL':
      return 'Esta entrega nao esta disponivel para voce.'
    default:
      return mensagem.includes('Transicao de status invalida')
        ? 'O pedido mudou de status enquanto voce olhava. A tela ja foi atualizada.'
        : 'Nao foi possivel concluir a acao.'
  }
}
