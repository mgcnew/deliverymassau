'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

import { avisarEntregadores } from '@/lib/push/enviar'
import { moeda } from '@/lib/format'
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
  const resultado = await chamar('finish_separation', { p_order_id: orderId })

  // Este e o unico caminho que coloca pedido em 'aguardando_entregador'
  // (finish_separation, migration 0007) - por isso o aviso mora aqui.
  //
  // after(): o balconista nao espera o push sair. Ele ja terminou a
  // separacao; a notificacao e assunto de bastidor.
  if (!resultado.erro) after(() => avisarPedidoPronto(orderId))

  return resultado
}

export async function liberarEntrega(orderId: string) {
  const resultado = await chamar('release_delivery', { p_order_id: orderId })
  // Entrega liberada volta para a fila: para os outros entregadores e a
  // mesma novidade que um pedido recem-separado.
  if (!resultado.erro) after(() => avisarPedidoPronto(orderId))
  return resultado
}

/**
 * Avisa os entregadores inscritos de que ha corrida esperando.
 *
 * Nunca lanca: o pedido ja mudou de status e a tela de quem esta com o app
 * aberto ja recebeu pelo Realtime. Falha de notificacao nao pode derrubar a
 * operacao do balcao.
 */
async function avisarPedidoPronto(orderId: string) {
  try {
    const supabase = await createClient()
    const { data: pedido } = await supabase
      .from('orders')
      .select('order_number, address_district, total, fulfillment')
      .eq('id', orderId)
      .maybeSingle()

    // Retirada no balcao nao tem entrega: quem vem buscar e o cliente.
    if (!pedido || pedido.fulfillment === 'retirada') return

    const bairro = pedido.address_district?.trim()

    await avisarEntregadores({
      titulo: `Pedido #${pedido.order_number} esperando entregador`,
      corpo: [bairro, moeda(Number(pedido.total))].filter(Boolean).join(' - '),
      url: '/painel/entregas',
      // Uma notificacao por pedido: aviso repetido do mesmo pedido substitui
      // o anterior em vez de encher a tela de quem esta na rua.
      tag: `entrega-${pedido.order_number}`,
    })
  } catch {
    // Silencio proposital - ver comentario acima.
  }
}

export async function cancelarPedido(orderId: string, motivo: string) {
  if (!motivo.trim()) return { erro: 'Informe o motivo do cancelamento.' }
  return chamar('cancel_order', { p_order_id: orderId, p_reason: motivo.trim() })
}

export async function iniciarEntrega(orderId: string) {
  return chamar('start_delivery', { p_order_id: orderId })
}

export async function finalizarEntrega(orderId: string, codigo: string) {
  return chamar('finish_delivery', { p_order_id: orderId, p_code: codigo })
}

export async function assumirEntrega(orderId: string) {
  return chamar('claim_delivery', { p_order_id: orderId })
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
    case 'CODIGO_INVALIDO':
      return 'Codigo incorreto. Confirme com o cliente e tente de novo.'
    default:
      return mensagem.includes('Transicao de status invalida')
        ? 'O pedido mudou de status enquanto voce olhava. A tela ja foi atualizada.'
        : 'Nao foi possivel concluir a acao.'
  }
}
