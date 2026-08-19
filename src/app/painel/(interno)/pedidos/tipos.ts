import type { OrderStatus, PaymentMethod } from '@/lib/types'

export type PedidoOperacional = {
  id: string
  order_number: number
  status: OrderStatus
  created_at: string
  customer_name: string
  customer_phone: string
  address_district: string | null
  total: number
  payment_method: PaymentMethod
  needs_change: boolean
  change_amount: number | null
  itens: number
  delivery_person_id: string | null
}

export const PAGAMENTO_CURTO: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  debito: 'Debito',
  credito: 'Credito',
}

export function minutosDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

export function tempoRelativo(iso: string): string {
  const minutos = minutosDesde(iso)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  return `${horas}h${String(minutos % 60).padStart(2, '0')}`
}
