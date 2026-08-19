import type { OrderStatus } from '@/lib/types'

export const ORDER_STATUS: Record<OrderStatus, { label: string; short: string; tone: string }> = {
  recebido:              { label: 'Recebido',              short: 'Novo',       tone: 'bg-blue-100 text-blue-900 border-blue-300' },
  separando:             { label: 'Separando',             short: 'Separando',  tone: 'bg-amber-100 text-amber-900 border-amber-300' },
  aguardando_entregador: { label: 'Aguardando entregador', short: 'Aguardando', tone: 'bg-purple-100 text-purple-900 border-purple-300' },
  saiu_para_entrega:     { label: 'Saiu para entrega',     short: 'A caminho',  tone: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
  entregue:              { label: 'Entregue',              short: 'Entregue',   tone: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  cancelado:             { label: 'Cancelado',             short: 'Cancelado',  tone: 'bg-rose-100 text-rose-900 border-rose-300' },
}

// Espelha public.order_status_can_move no banco. O banco e quem valida de fato.
export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  recebido:              ['separando', 'cancelado'],
  separando:             ['aguardando_entregador', 'cancelado'],
  aguardando_entregador: ['saiu_para_entrega', 'separando', 'cancelado'],
  saiu_para_entrega:     ['entregue', 'cancelado'],
  entregue:              [],
  cancelado:             [],
}

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'recebido',
  'separando',
  'aguardando_entregador',
  'saiu_para_entrega',
  'entregue',
]
