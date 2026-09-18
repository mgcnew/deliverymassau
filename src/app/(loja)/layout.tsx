import Link from 'next/link'

import { BarraCarrinho } from '@/components/carrinho/barra-carrinho'
import { BotaoSair } from '@/components/loja/botao-sair'
import { LinkMeusPedidos } from '@/components/loja/link-meus-pedidos'
import { MedirCabecalho } from '@/components/loja/medir-cabecalho'
import { ConviteInstalar } from '@/components/pwa/convite-instalar'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'

import { getConfiguracaoPublica } from '@/lib/loja/catalogo'
import { moeda } from '@/lib/format'
import { quando, resumoLoja, semanaAgrupada } from '@/lib/horario'

export default async function LojaLayout({ children }: LayoutProps<'/'>) {
  const config = await getConfiguracaoPublica()
  const horarioSemana = semanaAgrupada(config?.delivery_hours ?? [])

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Mesmo padrao neutro do cabecalho do painel (bg-surface, nao mais
          vermelho fixo) -- a logo troca de versao com o tema, igual la. */}
      <header id="cabecalho-loja" className="sticky top-0 z-20 border-b border-line bg-surface">
        <MedirCabecalho alvo="cabecalho-loja" />
        {/* gap menor no celular: com o Sair, a logo encolhe um pouco em vez
            de empurrar os botoes para fora da tela. */}
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-4 sm:gap-4">
          <Link href="/loja" className="min-w-0 flex-1">
            <Logo altura={44} />
            {/* Era "Delivery aberto 24 horas" fixo; agora diz o que vale agora. */}
            <p className="text-xs font-semibold text-muted">
              {config?.delivery ? resumoLoja(config.delivery) : 'Delivery'}
            </p>
          </Link>
          <LinkMeusPedidos />
          <ThemeToggle />
          <BotaoSair />
        </div>
      </header>

      <ConviteInstalar />

      {!config?.delivery_enabled ? (
        <p className="bg-amber-100 px-4 py-3 text-center text-sm font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
          {config?.delivery_closed_message ?? 'Delivery temporariamente indisponivel.'}
          {config?.delivery?.abre_em
            ? ` Abrimos ${quando(config.delivery.abre_em, config.delivery.fuso)}.`
            : ''}
          {/* "Indisponivel" sozinho soa como "nao da para usar". Da: o
              carrinho fica guardado no aparelho ate a hora de finalizar. */}
          <span className="block font-semibold">
            Pode ir montando o carrinho: ele fica guardado para voce finalizar quando abrirmos.
          </span>
        </p>
      ) : null}

      <div className="flex-1">{children}</div>

      {/*
        Rodape enxuto de proposito. Antes eram oito linhas empilhadas, com
        titulo proprio para o horario e uma frase inteira para o pedido
        minimo -- informacao que o cliente ja encontra onde precisa dela: o
        horario aparece embaixo da logo ("Aberto ate as 22h") e o pedido
        minimo aparece na barra do carrinho, na hora de fechar. Aqui embaixo
        basta o contato e o essencial, numa linha cada.
      */}
      <footer className="mt-8 border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-5xl space-y-1 px-4 py-6 text-sm text-muted">
          <p className="font-bold text-foreground">{config?.market_name ?? 'Mercado Massa 24h'}</p>

          {/* Endereco e WhatsApp na mesma linha, separados por ponto medio;
              no celular estreito o flex-wrap quebra sozinho. */}
          {config?.market_address || config?.market_phone ? (
            <p className="flex flex-wrap gap-x-2">
              {config?.market_address ? <span>{config.market_address}</span> : null}
              {config?.market_address && config?.market_phone ? <span aria-hidden>·</span> : null}
              {config?.market_phone ? <span>WhatsApp {config.market_phone}</span> : null}
            </p>
          ) : null}

          {/* Horario e pedido minimo condensados: os grupos de dias viram
              "Seg a Dom 8h as 22h · Sab 9h as 20h" em vez de um bloco. */}
          <p className="flex flex-wrap gap-x-2">
            {horarioSemana.map((l) => (
              <span key={l.dias}>
                {l.dias} {l.horario}
              </span>
            ))}
            {horarioSemana.length ? <span aria-hidden>·</span> : null}
            <span>Pedido minimo {moeda(config?.min_order_value ?? 0)}</span>
          </p>

          {/*
            Exigencia de licenca, nao enfeite: as fotos de produto que vieram
            das bases abertas Open Food Facts / Beauty / Products estao sob
            CC BY-SA, que permite uso comercial desde que a fonte seja
            creditada. Fica discreto, mas fica -- tirar seria descumprir a
            licenca das fotos que ja estao no catalogo.
          */}
          <p className="pt-1 text-xs opacity-70">
            Fotos:{' '}
            <a
              href="https://world.openfoodfacts.org"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Open Food Facts
            </a>{' '}
            (CC BY-SA)
          </p>
        </div>
      </footer>

      <BarraCarrinho
        pedidoMinimo={Number(config?.min_order_value ?? 0)}
        aberto={config?.delivery_enabled ?? false}
        abreEm={
          config?.delivery?.abre_em ? quando(config.delivery.abre_em, config.delivery.fuso) : null
        }
      />
    </div>
  )
}
