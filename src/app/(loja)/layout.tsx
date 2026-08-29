import Link from 'next/link'

import { BarraCarrinho } from '@/components/carrinho/barra-carrinho'
import { LinkMeusPedidos } from '@/components/loja/link-meus-pedidos'
import { RodapeEquipe } from '@/components/loja/rodape-equipe'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'

import { getConfiguracaoPublica } from '@/lib/loja/catalogo'
import { moeda } from '@/lib/format'

export default async function LojaLayout({ children }: LayoutProps<'/'>) {
  const config = await getConfiguracaoPublica()

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Mesmo padrao neutro do cabecalho do painel (bg-surface, nao mais
          vermelho fixo) -- a logo troca de versao com o tema, igual la. */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-4">
          <Link href="/loja" className="min-w-0 flex-1">
            <Logo altura={44} />
            <p className="text-xs font-semibold text-muted">Delivery aberto 24 horas</p>
          </Link>
          <LinkMeusPedidos />
          <ThemeToggle />
        </div>
      </header>

      {!config?.delivery_enabled ? (
        <p className="bg-amber-100 px-4 py-3 text-center text-sm font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
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
          {/*
            Exigencia de licenca, nao enfeite: as fotos de produto que vieram
            das bases abertas Open Food Facts / Beauty / Products estao sob
            CC BY-SA, que permite uso comercial desde que a fonte seja
            creditada. O credito fica aqui, uma vez, em vez de poluir cada
            card da vitrine.
          */}
          <p className="text-xs">
            Algumas fotos de produtos:{' '}
            <a
              href="https://world.openfoodfacts.org"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Open Food Facts
            </a>{' '}
            (CC BY-SA).
          </p>

          <RodapeEquipe />
        </div>
      </footer>

      <BarraCarrinho />
    </div>
  )
}
