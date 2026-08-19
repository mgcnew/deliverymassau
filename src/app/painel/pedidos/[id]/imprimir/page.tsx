import { notFound } from 'next/navigation'

import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { moeda, quantidade as formatarQuantidade } from '@/lib/format'
import type { OrderItem, PaymentMethod, UnitType } from '@/lib/types'
import { ControlesImpressao } from './controles'

export const metadata = { title: 'Via do pedido | Mercado Massa 24h' }

const PAGAMENTO: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'DINHEIRO',
  debito: 'CARTAO DE DEBITO',
  credito: 'CARTAO DE CREDITO',
}

function linha(esquerda: string, direita: string) {
  return (
    <div className="flex justify-between gap-2">
      <span>{esquerda}</span>
      <span>{direita}</span>
    </div>
  )
}

export default async function ImprimirPedidoPage({
  params,
  searchParams,
}: PageProps<'/painel/pedidos/[id]/imprimir'>) {
  const { id } = await params
  const query = await searchParams
  await requirePermission(PERMISSIONS.pedidosImprimir)
  const supabase = await createClient()

  const [{ data: pedido }, { data: itens }, { data: config }] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).maybeSingle(),
    supabase.from('order_items').select('*').eq('order_id', id).order('created_at'),
    supabase
      .from('settings')
      .select('market_name, market_phone, market_address, market_city, pix_key, pix_receiver_name')
      .eq('id', 1)
      .maybeSingle(),
  ])

  if (!pedido) notFound()

  const lista = (itens ?? []) as OrderItem[]
  const emFalta = lista.filter((i) => i.item_status === 'indisponivel')
  const pagamento = pedido.payment_method as PaymentMethod

  return (
    <>
      <ControlesImpressao orderId={id} auto={query.auto === '1'} />

      <div className="via mx-auto">
        <div className="text-center">
          <p className="text-base font-black uppercase">
            {config?.market_name ?? 'Mercado Massa 24h'}
          </p>
          {config?.market_address ? <p>{config.market_address}</p> : null}
          {config?.market_city ? <p>{config.market_city}</p> : null}
          {config?.market_phone ? <p>WhatsApp {config.market_phone}</p> : null}
        </div>

        <hr />

        <p className="text-center text-lg font-black">PEDIDO #{pedido.order_number}</p>
        <p className="text-center">{new Date(pedido.created_at).toLocaleString('pt-BR')}</p>

        <hr />

        <p className="font-bold">CLIENTE</p>
        <p>{pedido.customer_name}</p>
        <p>{pedido.customer_phone}</p>

        <hr />

        <p className="font-bold">ENDERECO</p>
        <p>
          {pedido.address_street}, {pedido.address_number}
        </p>
        <p>{pedido.address_district}</p>
        {pedido.address_complement ? <p>Compl: {pedido.address_complement}</p> : null}
        {pedido.address_reference ? <p>Ref: {pedido.address_reference}</p> : null}
        {pedido.address_cep ? <p>CEP {pedido.address_cep}</p> : null}

        <hr />

        <p className="font-bold">PRODUTOS</p>
        {lista.map((item) => {
          const falta = item.item_status === 'indisponivel'
          const usado = item.weighed_quantity ?? item.requested_quantity

          return (
            <div key={item.id} className="mb-1.5">
              <p className={falta ? 'line-through' : 'font-bold'}>{item.product_name}</p>

              {item.sold_by_weight && !falta ? (
                <>
                  <p>
                    Pedido: {formatarQuantidade(Number(item.requested_quantity), true, item.unit_type as UnitType)}
                  </p>
                  <p>
                    {item.weighed_quantity !== null
                      ? `Separado: ${formatarQuantidade(Number(item.weighed_quantity), true, item.unit_type as UnitType)}`
                      : 'Separado: ____ kg'}
                  </p>
                </>
              ) : null}

              {falta ? (
                <p className="font-bold">*** EM FALTA - NAO ENVIADO ***</p>
              ) : (
                linha(
                  `${formatarQuantidade(Number(usado), item.sold_by_weight, item.unit_type as UnitType)} x ${moeda(Number(item.unit_price))}`,
                  moeda(Number(item.final_total)),
                )
              )}

              {item.note ? <p className="destaque">OBS: {item.note}</p> : null}
            </div>
          )
        })}

        <hr />

        {linha('Subtotal', moeda(Number(pedido.items_subtotal_final)))}
        {linha(`Taxa de entrega${pedido.zone_name ? ` (${pedido.zone_name})` : ''}`, moeda(Number(pedido.delivery_fee)))}
        <div className="flex justify-between text-base font-black">
          <span>TOTAL</span>
          <span>{moeda(Number(pedido.total))}</span>
        </div>

        <hr />

        <p className="font-bold">PAGAMENTO: {PAGAMENTO[pagamento]}</p>

        {pagamento === 'dinheiro' && pedido.needs_change ? (
          <div className="destaque">
            <p>TROCO PARA: {moeda(Number(pedido.change_for))}</p>
            <p>TROCO ESTIMADO: {moeda(Number(pedido.change_amount ?? 0))}</p>
          </div>
        ) : null}

        {pagamento === 'dinheiro' && !pedido.needs_change ? <p>Cliente nao precisa de troco.</p> : null}

        {pagamento === 'pix' && config?.pix_key ? (
          <>
            <p>Chave PIX: {config.pix_key}</p>
            {config.pix_receiver_name ? <p>Em nome de: {config.pix_receiver_name}</p> : null}
          </>
        ) : null}

        {pedido.customer_note ? (
          <>
            <hr />
            <p className="font-bold">OBSERVACAO DO CLIENTE</p>
            <p className="destaque">{pedido.customer_note}</p>
          </>
        ) : null}

        {emFalta.length > 0 ? (
          <>
            <hr />
            <p className="destaque">
              ATENCAO: {emFalta.length} {emFalta.length === 1 ? 'item saiu' : 'itens sairam'} do
              pedido por falta. Valor ja descontado.
            </p>
          </>
        ) : null}

        <hr />
        <p className="text-center">Obrigado pela preferencia!</p>
      </div>
    </>
  )
}
