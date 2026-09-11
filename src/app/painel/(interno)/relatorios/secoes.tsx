import type { ReactNode } from 'react'

import { Card, CardTitle, Empty } from '@/components/ui/card'
import { RolagemHorizontal } from '@/components/ui/rolagem-horizontal'
import { moeda, quantidade } from '@/lib/format'
import type { UnitType } from '@/lib/types'
import type { Relatorio } from './tipos'

/** "2026-08-28" -> "28/08" (a data ja vem pronta do banco, no fuso do mercado). */
function diaCurto(dia: string): string {
  const [, mes, d] = dia.split('-')
  return `${d}/${mes}`
}

function Variacao({ pct }: { pct: number | null }) {
  // Sem base de comparacao o certo e nao mostrar nada: "+100%" partindo de
  // zero nao informa, so enfeita.
  if (pct === null) return <span className="text-sm text-muted">sem base anterior</span>

  const subiu = pct >= 0
  return (
    <span
      className="text-sm font-bold"
      style={{ color: `var(--tone-${subiu ? 'success' : 'error'}-fg)` }}
    >
      {subiu ? '▲' : '▼'} {Math.abs(pct).toLocaleString('pt-BR')}%
    </span>
  )
}

export function Kpi({
  titulo,
  valor,
  detalhe,
  destaque,
}: {
  titulo: string
  valor: string
  detalhe?: ReactNode
  destaque?: boolean
}) {
  return (
    <Card className={`h-full ${destaque ? 'border-brand' : ''}`}>
      <p className="text-sm font-semibold text-muted">{titulo}</p>
      <p
        className={`break-words text-xl font-black tabular-nums sm:text-2xl lg:text-3xl ${
          destaque ? 'text-brand-ink' : ''
        }`}
      >
        {valor}
      </p>
      {detalhe ? <div className="mt-0.5">{detalhe}</div> : null}
    </Card>
  )
}

export function Indicadores({ dados }: { dados: Relatorio }) {
  const { resumo, anterior } = dados
  // O periodo anterior tem o mesmo tamanho e termina na vespera deste.
  const periodoAnterior =
    anterior.inicio === anterior.fim
      ? diaCurto(anterior.inicio)
      : `${diaCurto(anterior.inicio)} a ${diaCurto(anterior.fim)}`

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          titulo="Faturamento"
          valor={moeda(Number(resumo.faturamento))}
          destaque
          detalhe={<Variacao pct={anterior.variacao_faturamento} />}
        />
        <Kpi
          titulo="Pedidos entregues"
          valor={String(resumo.entregues)}
          detalhe={<Variacao pct={anterior.variacao_pedidos} />}
        />
        <Kpi titulo="Ticket medio" valor={moeda(Number(resumo.ticket_medio))} />
        <Kpi
          titulo="Media por dia"
          valor={moeda(Number(resumo.media_diaria))}
          detalhe={
            <span className="text-sm text-muted">
              em {dados.dias} {dados.dias === 1 ? 'dia' : 'dias'}
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          titulo="Pedidos no periodo"
          valor={String(resumo.pedidos)}
          detalhe={
            <span className="text-sm text-muted">
              {resumo.cancelados} cancelados
              {resumo.em_andamento > 0 ? `, ${resumo.em_andamento} em andamento` : ''}
            </span>
          }
        />
        <Kpi
          titulo="Itens vendidos"
          valor={String(resumo.itens)}
          detalhe={
            resumo.itens_em_falta > 0 ? (
              <span className="text-sm" style={{ color: 'var(--tone-error-fg)' }}>
                {resumo.itens_em_falta} faltaram na separacao
              </span>
            ) : (
              <span className="text-sm text-muted">nenhum item em falta</span>
            )
          }
        />
        <Kpi titulo="Taxas de entrega" valor={moeda(Number(resumo.taxas))} />
        <Kpi
          titulo="Retiradas no balcao"
          valor={String(resumo.retiradas)}
          detalhe={
            <span className="text-sm text-muted">
              {resumo.entregues - resumo.retiradas} entregues em casa
            </span>
          }
        />
      </div>

      <p className="text-sm text-muted">
        Comparado com {periodoAnterior}: {moeda(Number(anterior.faturamento))} em{' '}
        {anterior.entregues} {anterior.entregues === 1 ? 'pedido' : 'pedidos'}. Faturamento, ticket
        e itens contam somente pedidos <strong>entregues</strong> - pedido em andamento ainda pode
        mudar de valor na pesagem ou ser cancelado. O dia comeca a meia-noite no fuso {dados.fuso}.
      </p>
    </div>
  )
}

/** Altura da barra em %, com um minimo visivel para nao sumir valor pequeno. */
function altura(valor: number, maximo: number): number {
  if (maximo <= 0 || valor <= 0) return 0
  return Math.max(3, Math.round((valor / maximo) * 100))
}

export function PorDia({ dados }: { dados: Relatorio['por_dia'] }) {
  const maximo = Math.max(...dados.map((d) => Number(d.faturamento)), 0)
  // Com muitos dias os rotulos se sobrepoem: mostra um a cada N.
  const passo = dados.length <= 14 ? 1 : dados.length <= 31 ? 3 : Math.ceil(dados.length / 12)

  return (
    <Card>
      <CardTitle>Faturamento por dia</CardTitle>

      {maximo <= 0 ? (
        <Empty>Nenhum pedido entregue nesse periodo.</Empty>
      ) : (
        <RolagemHorizontal>
          {/*
            Ate um mes o grafico cabe inteiro em qualquer tela - inclusive no
            celular, com barras finas. Passando disso, cada dia ganha uma
            largura minima e a faixa rola de lado; sem isso as barras viravam
            fios de cabelo indistinguiveis.
          */}
          <div style={dados.length > 31 ? { minWidth: `${dados.length * 22}px` } : undefined}>
            <div className="flex h-44 items-end gap-1">
              {dados.map((d) => (
                <div
                  key={d.dia}
                  className="flex flex-1 items-end"
                  style={{ height: '100%' }}
                  title={`${diaCurto(d.dia)}: ${moeda(Number(d.faturamento))} - ${d.entregues} entregues`}
                >
                  <div
                    // max-w: com periodo curto (2 ou 3 dias) a barra ocupava a
                    // largura inteira do cartao e virava um bloco, nao um grafico.
                    className="mx-auto w-full max-w-12 rounded-t bg-brand"
                    style={{ height: `${altura(Number(d.faturamento), maximo)}%` }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-2 flex gap-1">
              {dados.map((d, i) => (
                <span
                  key={d.dia}
                  // min-w-0: sem isso o span nao encolhe abaixo do proprio
                  // texto (min-width:auto do flex) e o eixo desalinha das
                  // barras. Vazio ao lado, o rotulo pode transbordar a vontade.
                  //
                  // No celular cabe metade dos rotulos: os intermediarios
                  // ficam invisiveis e voltam a partir do sm. invisible, e nao
                  // hidden, porque display:none tiraria a coluna do flex e o
                  // eixo desalinharia das barras de novo.
                  className={`min-w-0 flex-1 text-center text-[11px] font-semibold text-muted ${
                    i % passo === 0 && i % (passo * 2) !== 0 ? 'invisible sm:visible' : ''
                  }`}
                >
                  {i % passo === 0 ? diaCurto(d.dia) : ''}
                </span>
              ))}
            </div>
          </div>
        </RolagemHorizontal>
      )}

      <p className="mt-2 text-sm text-muted">Maior dia: {moeda(maximo)}</p>
    </Card>
  )
}

export function PorHora({ dados }: { dados: Relatorio['horas'] }) {
  const maximo = Math.max(...dados.map((h) => h.pedidos), 0)
  const pico = dados.reduce((a, b) => (b.pedidos > a.pedidos ? b : a), dados[0])

  return (
    <Card>
      <CardTitle>Movimento por hora</CardTitle>

      {maximo <= 0 ? (
        <Empty>Nenhum pedido nesse periodo.</Empty>
      ) : (
        <>
          <div className="flex h-28 items-end gap-[3px]">
            {dados.map((h) => (
              <div
                key={h.hora}
                className="flex flex-1 items-end"
                style={{ height: '100%' }}
                title={`${String(h.hora).padStart(2, '0')}h: ${h.pedidos} pedidos`}
              >
                <div
                  className="w-full rounded-t bg-brand/70"
                  style={{ height: `${altura(h.pedidos, maximo)}%` }}
                />
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-[3px]">
            {dados.map((h) => (
              <span
                key={h.hora}
                className="min-w-0 flex-1 text-center text-[10px] font-semibold text-muted"
              >
                {h.hora % 3 === 0 ? h.hora : ''}
              </span>
            ))}
          </div>

          <p className="mt-2 text-sm text-muted">
            Pico as {String(pico.hora).padStart(2, '0')}h, com {pico.pedidos}{' '}
            {pico.pedidos === 1 ? 'pedido' : 'pedidos'}. Conta a hora em que o pedido entrou.
          </p>
        </>
      )}
    </Card>
  )
}

/**
 * Lista ordenada com barra de proporcao no fundo da linha. Mesma forma para
 * produtos, bairros e pagamentos - o que muda e so o texto de cada linha.
 */
function Ranking({
  titulo,
  vazio,
  itens,
  rodape,
}: {
  titulo: string
  vazio: string
  itens: Array<{ chave: string; rotulo: string; detalhe: string; valor: number }>
  rodape?: string
}) {
  const maximo = Math.max(...itens.map((i) => i.valor), 0)

  return (
    <Card>
      <CardTitle>{titulo}</CardTitle>

      {!itens.length ? (
        <Empty>{vazio}</Empty>
      ) : (
        <ul className="space-y-1">
          {itens.map((item) => (
            <li key={item.chave} className="relative overflow-hidden rounded-lg px-2 py-2">
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-lg bg-brand/10"
                style={{ width: `${maximo > 0 ? Math.max(4, (item.valor / maximo) * 100) : 0}%` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.rotulo}</p>
                  <p className="truncate text-sm text-muted">{item.detalhe}</p>
                </div>
                <p className="shrink-0 font-bold tabular-nums">{moeda(item.valor)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rodape ? <p className="mt-2 text-sm text-muted">{rodape}</p> : null}
    </Card>
  )
}

const PAGAMENTO: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  debito: 'Cartao de debito',
  credito: 'Cartao de credito',
  voucher: 'Voucher',
}

export function Produtos({ dados }: { dados: Relatorio['produtos'] }) {
  return (
    <Ranking
      titulo="Produtos que mais venderam"
      vazio="Nenhum item entregue nesse periodo."
      rodape="Ordenado por faturamento. Item marcado como em falta na separacao nao entra."
      itens={dados.map((p) => ({
        chave: p.nome,
        rotulo: p.nome,
        detalhe: `${quantidade(Number(p.quantidade), p.por_peso, p.unidade as UnitType)} em ${p.pedidos} ${
          p.pedidos === 1 ? 'pedido' : 'pedidos'
        }`,
        valor: Number(p.faturamento),
      }))}
    />
  )
}

export function Bairros({ dados }: { dados: Relatorio['bairros'] }) {
  return (
    <Ranking
      titulo="Bairros que mais pedem"
      vazio="Nenhuma entrega nesse periodo."
      rodape="Somente entregas: retirada no balcao nao tem bairro."
      itens={dados.map((b) => ({
        chave: `${b.bairro}-${b.zona}`,
        rotulo: b.bairro,
        detalhe: [
          // A zona costuma ter o nome de um bairro: repetir os dois so ocupa
          // a linha e nao informa nada.
          b.zona !== b.bairro && b.zona !== '-' ? b.zona : null,
          `${b.pedidos} ${b.pedidos === 1 ? 'pedido' : 'pedidos'}`,
          `${moeda(Number(b.taxas))} de taxa`,
        ]
          .filter(Boolean)
          .join(' - '),
        valor: Number(b.faturamento),
      }))}
    />
  )
}

export function Pagamentos({ dados }: { dados: Relatorio['pagamentos'] }) {
  return (
    <Ranking
      titulo="Formas de pagamento"
      vazio="Nenhum pedido entregue nesse periodo."
      itens={dados.map((p) => ({
        chave: p.metodo,
        rotulo: PAGAMENTO[p.metodo] ?? p.metodo,
        detalhe: `${p.pedidos} ${p.pedidos === 1 ? 'pedido' : 'pedidos'}`,
        valor: Number(p.faturamento),
      }))}
    />
  )
}
