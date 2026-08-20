import Image from 'next/image'
import Link from 'next/link'

import { BarraCarrinho } from '@/components/carrinho/barra-carrinho'
import { RodapeEquipe } from '@/components/loja/rodape-equipe'
import { ThemeToggle } from '@/components/ui/theme-toggle'

import { getConfiguracaoPublica } from '@/lib/loja/catalogo'
import { moeda } from '@/lib/format'

export default async function LojaLayout({ children }: LayoutProps<'/'>) {
  const config = await getConfiguracaoPublica()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-brand text-brand-foreground">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/loja" className="min-w-0 flex-1">
            {/* Fundo do cabecalho e sempre vermelho (claro ou escuro), entao
                a versao com texto branco da logo e fixa aqui -- nao troca
                com o tema do site como no painel. */}
            <Image src="/logo-escuro.png" alt={config?.market_name ?? 'Mercado Massa 24h'} width={166} height={35} priority />
            <p className="text-xs font-semibold opacity-90">Delivery aberto 24 horas</p>
          </Link>
          <ThemeToggle inverso />
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
          <RodapeEquipe />
        </div>
      </footer>

      <BarraCarrinho />
    </div>
  )
}
