import Link from 'next/link'

import { ListaMeusPedidos } from './lista'

export const metadata = { title: 'Meus pedidos | Mercado Massa 24h' }

export default function MeusPedidosPage() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <Link href="/" className="text-sm font-semibold text-muted">
        &lsaquo; Voltar a loja
      </Link>
      <h1 className="text-2xl font-black">Meus pedidos</h1>
      <p className="text-muted">
        Guardados neste aparelho, sem precisar de conta. Trocou de celular? Peca o link no WhatsApp
        do mercado.
      </p>
      <ListaMeusPedidos />
    </main>
  )
}
