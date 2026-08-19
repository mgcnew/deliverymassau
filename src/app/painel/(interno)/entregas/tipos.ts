import type { OrderStatus, PaymentMethod } from '@/lib/types'

export type EntregaCard = {
  id: string
  order_number: number
  status: OrderStatus
  customer_name: string
  customer_phone: string
  address_street: string | null
  address_number: string | null
  address_district: string | null
  address_complement: string | null
  address_reference: string | null
  customer_note: string | null
  total: number
  payment_method: PaymentMethod
  needs_change: boolean
  change_for: number | null
  change_amount: number | null
  delivery_person_id: string | null
}

export const CAMPOS_ENTREGA =
  'id, order_number, status, customer_name, customer_phone, address_street, address_number, address_district, address_complement, address_reference, customer_note, total, payment_method, needs_change, change_for, change_amount, delivery_person_id'
