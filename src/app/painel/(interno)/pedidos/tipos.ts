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
  payment_brand: string | null
  needs_change: boolean
  change_amount: number | null
  itens: number
  delivery_person_id: string | null
  /** Nome de quem assumiu a entrega (null enquanto ninguem pegou). */
  entregador: string | null
}

export const PAGAMENTO_CURTO: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  debito: 'Debito',
  credito: 'Credito',
  voucher: 'Voucher',
}

/** "Voucher - Alelo": a bandeira diz ao entregador qual maquininha/opcao usar. */
export function rotuloPagamento(metodo: PaymentMethod, bandeira: string | null) {
  return bandeira ? `${PAGAMENTO_CURTO[metodo]} - ${bandeira}` : PAGAMENTO_CURTO[metodo]
}

/** `agora` vem do relogio da tela (useAgora), para a idade andar sozinha. */
export function minutosDesde(iso: string, agora: number): number {
  return Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000))
}

export function tempoRelativo(minutos: number): string {
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `${minutos} min`
  if (minutos < 24 * 60) {
    return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`
  }
  const dias = Math.floor(minutos / (24 * 60))
  return dias === 1 ? 'ha 1 dia' : `ha ${dias} dias`
}

/**
 * Quanto tempo cada etapa aguenta antes de virar atencao (amarelo) e atraso
 * (vermelho). "Novo" e o mais apertado: pedido parado ali ninguem pegou.
 */
const LIMITES: Partial<Record<OrderStatus, [atencao: number, atraso: number]>> = {
  recebido: [10, 20],
  separando: [20, 40],
  aguardando_entregador: [15, 30],
  saiu_para_entrega: [45, 90],
}

export type Urgencia = 'ok' | 'atencao' | 'atraso'

export function urgencia(status: OrderStatus, minutos: number): Urgencia {
  const limite = LIMITES[status]
  if (!limite) return 'ok'
  if (minutos > limite[1]) return 'atraso'
  if (minutos > limite[0]) return 'atencao'
  return 'ok'
}

export const COR_URGENCIA: Record<Urgencia, string> = {
  ok: 'text-muted',
  atencao: 'font-bold text-amber-800 dark:text-amber-300',
  atraso: 'font-black text-[var(--tone-error-fg)]',
}
