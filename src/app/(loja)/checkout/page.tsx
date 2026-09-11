import { LinkVoltar } from '@/components/ui/link-voltar'
import { redirect } from 'next/navigation'

import { modoEfetivo } from '@/lib/entrega/cotar'
import { getBairrosAtendidos, getConfiguracaoPublica } from '@/lib/loja/catalogo'
import { CheckoutForm } from './checkout-form'

export const metadata = { title: 'Finalizar pedido | Mercado Massa 24h' }

export default async function CheckoutPage() {
  const [config, bairros] = await Promise.all([getConfiguracaoPublica(), getBairrosAtendidos()])

  // Delivery fechado: nem chega a montar o formulario.
  if (!config?.delivery_enabled) redirect('/carrinho')

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <LinkVoltar href="/carrinho">Voltar ao carrinho</LinkVoltar>
      <h1 className="text-2xl font-black">Finalizar pedido</h1>

      <CheckoutForm
        bairros={bairros}
        formasPagamento={config.payment_methods ?? []}
        pedidoMinimo={Number(config.min_order_value ?? 0)}
        modoTaxa={modoEfetivo(config.delivery_fee_mode)}
        whatsapp={config.market_phone}
      />
    </main>
  )
}
