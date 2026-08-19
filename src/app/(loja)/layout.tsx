import Link from 'next/link'

import { getConfiguracaoPublica } from '@/lib/loja/catalogo'
import { urlImagemProduto } from '@/lib/supabase/storage'
import { moeda } from '@/lib/format'

export default async function LojaLayout({ children }: LayoutProps<'/'>) {
  const config = await getConfiguracaoPublica()
  const logo = urlImagemProduto(config?.market_logo_path)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-brand text-brand-foreground">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-10 rounded-lg bg-white/20 object-cover" />
          ) : null}
          <Link href="/" className="min-w-0">
            <p className="truncate text-lg font-black leading-tight">
              {config?.market_name ?? 'Mercado Massa 24h'}
            </p>
            <p className="text-xs font-semibold opacity-90">Delivery aberto 24 horas</p>
          </Link>
        </div>
      </header>

      {!config?.delivery_enabled ? (
        <p className="bg-amber-100 px-4 py-3 text-center text-sm font-bold text-amber-900">
          {config?.delivery_closed_message ?? 'Delivery temporariamente indisponivel.'}
        </p>
      ) : null}

      <div className="flex-1">{children}</div>

      <footer className="mt-8 border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-5xl space-y-1 px-4 py-6 text-sm text-muted">
          <p className="font-bold text-foreground">{config?.market_name ?? 'Mercado Massa 24h'}</p>
          {config?.market_address ? <p>{config.market_address}</p> : null}
          {config?.market_phone ? <p>WhatsApp {config.market_phone}</p> : null}
          <p>
            Pedido minimo de {moeda(config?.min_order_value ?? 0)} em produtos, sem contar a taxa de
            entrega.
          </p>
          <p className="pt-2">
            <Link href="/painel" className="font-semibold underline">
              Sou da equipe
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
