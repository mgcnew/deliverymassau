// Tipos do dominio, espelhando o schema do Postgres.
// O banco e a fonte de verdade: qualquer mudanca aqui vem depois de uma migration.

export type UnitType = 'unidade' | 'pacote' | 'caixa' | 'kg' | 'g'

export type OrderStatus =
  | 'recebido'
  | 'separando'
  | 'aguardando_entregador'
  | 'saiu_para_entrega'
  | 'entregue'
  | 'cancelado'

export type OrderItemStatus = 'pendente' | 'separado' | 'indisponivel'
export type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito'
export type ZoneMatchType = 'bairro' | 'regiao' | 'raio'
export type FulfillmentType = 'entrega' | 'retirada'

export type Permission = {
  code: string
  module: string
  label: string
  description: string | null
  sort_order: number
}

export type PermissionPreset = {
  id: string
  slug: string
  name: string
  description: string | null
  is_system: boolean
  is_active: boolean
  sort_order: number
}

export type Profile = {
  id: string
  name: string
  phone: string | null
  preset_id: string | null
  is_active: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  name: string
  slug: string
  sort_order: number
  is_active: boolean
}

export type Product = {
  id: string
  category_id: string
  name: string
  slug: string
  short_description: string | null
  image_path: string | null
  unit_type: UnitType
  sold_by_weight: boolean
  price: number
  weight_step: number | null
  min_weight: number | null
  is_active: boolean
  is_available: boolean
  sort_order: number
  barcode: string | null
}

export type DeliveryZone = {
  id: string
  name: string
  match_type: ZoneMatchType
  fee: number
  is_active: boolean
  sort_order: number
}

export type Settings = {
  id: number
  market_name: string
  market_phone: string | null
  market_logo_path: string | null
  market_address: string | null
  timezone: string
  delivery_enabled: boolean
  delivery_closed_message: string
  min_order_value: number
  weight_tolerance_pct: number
  pix_key: string | null
  pix_receiver_name: string | null
}

export type Order = {
  id: string
  order_number: number
  public_token: string
  fulfillment: FulfillmentType
  customer_id: string
  customer_name: string
  customer_phone: string
  address_cep: string | null
  address_street: string | null
  address_number: string | null
  address_district: string | null
  address_complement: string | null
  address_reference: string | null
  zone_id: string | null
  zone_name: string | null
  delivery_fee: number
  items_subtotal_estimated: number
  items_subtotal_final: number
  total: number
  status: OrderStatus
  payment_method: PaymentMethod
  needs_change: boolean
  change_for: number | null
  change_amount: number | null
  customer_note: string | null
  separated_by: string | null
  delivery_person_id: string | null
  assigned_at: string | null
  dispatched_at: string | null
  delivered_at: string | null
  cancel_reason: string | null
  created_at: string
  updated_at: string
}

export type OrderItem = {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  unit_type: UnitType
  sold_by_weight: boolean
  unit_price: number
  requested_quantity: number
  weighed_quantity: number | null
  estimated_total: number
  final_total: number
  item_status: OrderItemStatus
  note: string | null
}
