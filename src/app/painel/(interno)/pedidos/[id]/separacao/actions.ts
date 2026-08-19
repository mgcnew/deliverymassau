'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import type { OrderItemStatus } from '@/lib/types'

export type SeparacaoState = { erro?: string }

/** Peso chega em GRAMAS da tela (o balconista digita 1087, nao 1,087). */
export async function registrarPeso(
  orderId: string,
  itemId: string,
  gramas: number,
): Promise<SeparacaoState> {
  if (!Number.isFinite(gramas) || gramas <= 0) return { erro: 'Peso invalido.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_item_weight', {
    p_item_id: itemId,
    p_weight: gramas / 1000,
  })

  if (error) return { erro: traduzir(error.message, error.details) }

  revalidatePath(`/painel/pedidos/${orderId}/separacao`)
  return {}
}

export async function marcarItem(
  orderId: string,
  itemId: string,
  status: OrderItemStatus,
): Promise<SeparacaoState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_item_status', {
    p_item_id: itemId,
    p_status: status,
  })

  if (error) return { erro: traduzir(error.message, error.details) }

  revalidatePath(`/painel/pedidos/${orderId}/separacao`)
  return {}
}

function traduzir(mensagem: string, detalhe?: string | null): string {
  switch (mensagem.trim()) {
    case 'SEM_PERMISSAO':
      return `Voce nao tem a permissao necessaria${detalhe ? ` (${detalhe})` : ''}.`
    case 'PEDIDO_NAO_ESTA_EM_SEPARACAO':
      return 'Este pedido nao esta mais em separacao.'
    case 'ITEM_NAO_E_POR_PESO':
      return 'Este item nao e vendido por peso.'
    case 'PESO_INVALIDO':
      return 'Peso invalido.'
    case 'ITEM_NAO_ENCONTRADO':
      return 'Item nao encontrado.'
    default:
      return 'Nao foi possivel registrar. Tente de novo.'
  }
}
