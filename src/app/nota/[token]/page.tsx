import { notFound } from 'next/navigation'

import { getConfiguracaoPublica } from '@/lib/loja/catalogo'
import { moeda, quantidade as formatarQuantidade } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import type { OrderStatus, PaymentMethod, UnitType } from '@/lib/types'
import { ControlesNota } from './controles'

export const metadata = { title: 'Nota do pedido | Mercado Massa 24h' }

/**
 * Nota do pedido para o CLIENTE, aberta pelo mesmo token do acompanhamento.
 *
 * Fica fora do grupo (loja) de proposito, como a via do painel: cabecalho,
 * rodape e barra de carrinho nao tem o que fazer numa folha impressa.
 *
 * Reaproveita o estilo `.via` da via do balcao - monoespacada, preto no
 * branco, sem imagem - para sair igual tanto no papel A4 quanto na termica.
 */

const PAGAMENTO: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'DINHEIRO',
  debito: 'CARTAO DE DEBITO',
  credito: 'CARTAO DE CREDITO',
}

type ItemNota = {
  product_name: string
  unit_type: UnitType
  sold_by_weight: boolean
  unit_price: number
  requested_quantity: number
  weighed_quantity: number | null
  final_total: number
  item_status: 'pendente' | 'separado' | 'indisponivel'
  note: string | null
}

type PedidoNota = {
  order_number: number
  status: OrderStatus
  created_at: string
  delivered_at: string | null
  customer_name: string
  address: {
    street: string | null
    number: string | null
    district: string | null
    complement: string | null
    reference: string | null
    cep: string | null
  }
  items_subtotal_final: number
  delivery_fee: number
  total: number
  payment_method: PaymentMethod
  customer_note: string | null
  items: ItemNota[]
}

function linha(esquerda: string, direita: string) {
  return (
    <div className="flex justify-between gap-2">
      <span>{esquerda}</span>
      <span>{direita}</span>
    </div>
  )
}

export default async function NotaPage({ params }: PageProps<'/nota/[token]'>) {
  const { token } = await params

  const supabase = await createClient()
  const [{ data }, config] = await Promise.all([
    supabase.rpc('get_order_by_token', { p_token: token }),
    getConfiguracaoPublica(),
  ])

  const pedido = data as PedidoNota | null
  if (!pedido) notFound()

  const emFalta = pedido.items.filter((i) => i.item_status === 'indisponivel')
  const fechado = pedido.status === 'entregue' || pedido.status === 'cancelado'
  const endereco = pedido.address

  return (
    <>
      <ControlesNota token={token} />

      <div className="via via-cliente mx-auto">
        <div className="text-center">
          <p className="text-base font-black uppercase">
            {config?.market_name ?? 'Mercado Massa 24h'}
          </p>
          {config?.market_address ? <p>{config.market_address}</p> : null}
          {config?.market_phone ? <p>WhatsApp {config.market_phone}</p> : null}
        </div>

        <hr />

        <p className="text-center text-lg font-black">PEDIDO #{pedido.order_number}</p>
        <p className="text-center">
          Feito em {new Date(pedido.created_at).toLocaleString('pt-BR')}
        </p>
        {pedido.delivered_at ? (
          <p className="text-center">
            Entregue em {new Date(pedido.delivered_at).toLocaleString('pt-BR')}
          </p>
        ) : null}

        {/* Antes da entrega o peso ainda pode mudar e item pode faltar: a nota
            existe, mas nao pode ser lida como valor final. */}
        {!fechado ? (
          <p className="destaque">
            PEDIDO EM ANDAMENTO - os valores ainda podem mudar na pesagem ou por falta de item.
          </p>
        ) : null}

        {pedido.status === 'cancelado' ? <p className="destaque">PEDIDO CANCELADO</p> : null}

        <hr />

        <p className="font-bold">CLIENTE</p>
        <p>{pedido.customer_name}</p>

        {endereco?.street ? (
          <>
            <hr />
            <p className="font-bold">ENTREGA</p>
            <p>
              {endereco.street}, {endereco.number}
            </p>
            {endereco.district ? <p>{endereco.district}</p> : null}
            {endereco.complement ? <p>Compl: {endereco.complement}</p> : null}
            {endereco.cep ? <p>CEP {endereco.cep}</p> : null}
          </>
        ) : null}

        <hr />

        <p className="font-bold">PRODUTOS</p>
        {pedido.items.map((item, i) => {
          const falta = item.item_status === 'indisponivel'
          const usado = item.weighed_quantity ?? item.requested_quantity

          return (
            <div key={`${item.product_name}-${i}`} className="mb-1.5">
              <p className={falta ? 'line-through' : 'font-bold'}>{item.product_name}</p>

              {falta ? (
                <p className="font-bold">*** EM FALTA - NAO ENVIADO ***</p>
              ) : (
                linha(
                  `${formatarQuantidade(Number(usado), item.sold_by_weight, item.unit_type)} x ${moeda(
                    Number(item.unit_price),
                  )}`,
                  moeda(Number(item.final_total)),
                )
              )}

              {item.note ? <p>OBS: {item.note}</p> : null}
            </div>
          )
        })}

        <hr />

        {linha('Subtotal', moeda(Number(pedido.items_subtotal_final)))}
        {linha('Taxa de entrega', moeda(Number(pedido.delivery_fee)))}
        <div className="flex justify-between text-base font-black">
          <span>TOTAL</span>
          <span>{moeda(Number(pedido.total))}</span>
        </div>

        <hr />

        <p className="font-bold">PAGAMENTO: {PAGAMENTO[pedido.payment_method]}</p>

        {pedido.customer_note ? (
          <>
            <hr />
            <p className="font-bold">OBSERVACAO</p>
            <p>{pedido.customer_note}</p>
          </>
        ) : null}

        {emFalta.length > 0 ? (
          <>
            <hr />
            <p className="destaque">
              {emFalta.length} {emFalta.length === 1 ? 'item saiu' : 'itens sairam'} do pedido por
              falta. O valor ja esta descontado do total.
            </p>
          </>
        ) : null}

        <hr />
        <p className="text-center">Obrigado pela preferencia!</p>
        {/* Dito na cara: o mercado nao emite documento fiscal por aqui. */}
        <p className="text-center">Comprovante de compra - sem valor fiscal.</p>
      </div>
    </>
  )
}
