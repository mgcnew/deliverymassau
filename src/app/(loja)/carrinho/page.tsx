import { LinkVoltar } from '@/components/ui/link-voltar'

import { getConfiguracaoPublica } from '@/lib/loja/catalogo'
import { CarrinhoCliente } from './carrinho-cliente'

export const metadata = { title: 'Carrinho | Mercado Massa 24h' }

export default async function CarrinhoPage() {
  const config = await getConfiguracaoPublica()

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <LinkVoltar href="/">Continuar comprando</LinkVoltar>
      <h1 className="text-2xl font-black">Seu carrinho</h1>

      <CarrinhoCliente
        pedidoMinimo={Number(config?.min_order_value ?? 0)}
        deliveryAberto={config?.delivery_enabled ?? false}
      />
    </main>
  )
}
