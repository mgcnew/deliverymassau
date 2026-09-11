'use client'

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, X } from 'lucide-react'

import { ORDER_STATUS } from '@/lib/orders/status'
import { Empty } from '@/components/ui/card'
import { useAtualizacaoAoVivo } from '@/lib/tempo-real/use-atualizacao-ao-vivo'
import type { OrderStatus } from '@/lib/types'
import { CardPedido } from './card-pedido'
import { FiltroDia } from './filtro-dia'
import { useAgora } from './relogio'
import { COR_URGENCIA, minutosDesde, tempoRelativo, urgencia, type PedidoOperacional } from './tipos'

/**
 * Fila de pedidos em andamento.
 *
 * - Celular: seletor fixo das 4 etapas (cabe inteiro em 375px, sem faixa
 *   deslizando) e a lista da etapa escolhida. Abre na primeira etapa que tem
 *   pedido - abrir num "Novo" vazio com pedido parado em outra etapa fazia
 *   parecer que nao havia nada.
 * - Computador: as 4 etapas lado a lado numa linha so, a partir de 1024px.
 * - Finalizados (historico do dia) ficam numa gaveta, com o filtro de dia
 *   dentro: o dia so vale para eles, entao o filtro mora junto.
 *
 * A etapa e a gaveta vao para a URL (?etapa=, ?finalizados=1) com
 * replaceState: recarregar ou trocar o dia volta no mesmo lugar.
 */

const ETAPAS: OrderStatus[] = ['recebido', 'separando', 'aguardando_entregador', 'saiu_para_entrega']

const VAZIO: Partial<Record<OrderStatus, string>> = {
  recebido: 'Nenhum pedido novo agora.',
  separando: 'Nenhum pedido sendo separado.',
  aguardando_entregador: 'Nenhum pedido esperando entregador.',
  saiu_para_entrega: 'Nenhum pedido a caminho.',
}

function marcarNaUrl(chave: string, valor: string | null) {
  const url = new URL(window.location.href)
  if (valor === null) url.searchParams.delete(chave)
  else url.searchParams.set(chave, valor)
  window.history.replaceState(null, '', url)
}

export function PainelPedidos({
  pedidos,
  finalizados,
  dia,
  hoje,
  ontem,
  rotuloDia,
  etapaInicial,
  gavetaAberta,
  agoraServidor,
  podeSeparar,
  podeImprimir,
}: {
  pedidos: PedidoOperacional[]
  finalizados: PedidoOperacional[]
  dia: string
  hoje: string
  ontem: string
  /** "hoje", "ontem" ou "21/08" - so os finalizados seguem o filtro de data. */
  rotuloDia: string
  etapaInicial?: string
  gavetaAberta: boolean
  agoraServidor: number
  podeSeparar: boolean
  podeImprimir: boolean
}) {
  const agora = useAgora(agoraServidor)
  const porEtapa = (status: OrderStatus) => pedidos.filter((p) => p.status === status)

  const [etapa, setEtapa] = useState<OrderStatus>(() => {
    const pedida = ETAPAS.find((e) => e === etapaInicial)
    if (pedida) return pedida
    return ETAPAS.find((e) => pedidos.some((p) => p.status === e)) ?? 'recebido'
  })
  const [gaveta, setGaveta] = useState(gavetaAberta)
  const botoes = useRef<Map<OrderStatus, HTMLButtonElement>>(new Map())

  // Tempo real da operacao: o hook cuida do socket, do token, da rede que
  // cai e do refresh no instante em que a tela volta ao foco.
  useAtualizacaoAoVivo({ canal: 'operacao-pedidos', tabelas: ['orders', 'order_items'] })

  function escolher(status: OrderStatus) {
    setEtapa(status)
    marcarNaUrl('etapa', status)
  }

  function abrirGaveta(aberta: boolean) {
    setGaveta(aberta)
    marcarNaUrl('finalizados', aberta ? '1' : null)
  }

  // Setas trocam de etapa, como o padrao de abas do leitor de tela espera.
  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = ETAPAS.indexOf(etapa)
    const proxima = ETAPAS[(i + (e.key === 'ArrowRight' ? 1 : -1) + ETAPAS.length) % ETAPAS.length]
    escolher(proxima)
    botoes.current.get(proxima)?.focus()
  }

  const cartao = (p: PedidoOperacional) => (
    <CardPedido
      key={p.id}
      pedido={p}
      agora={agora}
      podeSeparar={podeSeparar && p.status === 'recebido'}
      podeImprimir={podeImprimir}
    />
  )

  const daEtapa = porEtapa(etapa)

  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Pedidos</h1>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => abrirGaveta(true)}
          className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface pl-4 pr-2.5 text-sm font-bold hover:bg-foreground/5"
        >
          Finalizados {rotuloDia}
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs tabular-nums">
            {finalizados.length}
          </span>
          <ChevronRight size={18} aria-hidden className="text-muted" />
        </button>
      </div>

      {/* Celular e tablet: seletor das etapas, grudado no topo ao rolar */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-10 -mx-4 bg-background px-4 pb-3 md:-mx-6 md:px-6">
          <div
            role="tablist"
            aria-label="Etapas do pedido"
            className="grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface p-1"
          >
            {ETAPAS.map((status) => {
              const total = porEtapa(status).length
              const selecionada = status === etapa
              const chamando = status === 'recebido' && total > 0 && !selecionada
              return (
                <button
                  key={status}
                  ref={(el) => {
                    if (el) botoes.current.set(status, el)
                    else botoes.current.delete(status)
                  }}
                  type="button"
                  role="tab"
                  id={`etapa-${status}`}
                  aria-selected={selecionada}
                  aria-controls="lista-etapa"
                  tabIndex={selecionada ? 0 : -1}
                  onClick={() => escolher(status)}
                  onKeyDown={aoTeclar}
                  className={`flex min-w-0 flex-col items-center rounded-xl px-1 py-2 ${
                    selecionada
                      ? 'bg-foreground text-background'
                      : chamando
                        ? 'bg-brand/10'
                        : 'hover:bg-foreground/5'
                  }`}
                >
                  <span
                    className={`text-2xl font-black leading-none tabular-nums ${
                      chamando ? 'text-brand-ink' : total === 0 && !selecionada ? 'text-muted' : ''
                    }`}
                  >
                    {total}
                  </span>
                  <span className="mt-1 max-w-full truncate text-xs font-bold">
                    {ORDER_STATUS[status].short}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div role="tabpanel" id="lista-etapa" aria-labelledby={`etapa-${etapa}`}>
          {daEtapa.length === 0 ? (
            <Empty>
              {pedidos.length === 0
                ? 'Nenhum pedido em andamento.'
                : VAZIO[etapa]}
            </Empty>
          ) : (
            <div className="space-y-3">{daEtapa.map(cartao)}</div>
          )}
        </div>
      </div>

      {/* Computador: as 4 etapas numa linha so. Cada coluna rola junto com a
          pagina e o cabecalho gruda no topo, entao nome e contagem ficam
          sempre a vista. */}
      <div className="hidden items-start gap-3 lg:grid lg:grid-cols-4">
        {ETAPAS.map((status) => {
          const lista = porEtapa(status)
          const maisAntigo = lista[0]
          const minutos = maisAntigo ? minutosDesde(maisAntigo.created_at, agora) : 0
          return (
            <section key={status} aria-labelledby={`coluna-${status}`} className="min-w-0">
              <header className="sticky top-0 z-10 -mt-1 bg-background pb-2 pt-1">
                <h2 id={`coluna-${status}`} className="flex items-center gap-2 font-black">
                  {ORDER_STATUS[status].short}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      status === 'recebido' && lista.length > 0
                        ? 'bg-brand text-brand-foreground'
                        : 'bg-foreground/10'
                    }`}
                  >
                    {lista.length}
                  </span>
                </h2>
                <p className={`text-xs ${maisAntigo ? COR_URGENCIA[urgencia(status, minutos)] : 'text-muted'}`}>
                  {maisAntigo ? `Mais antigo: ${tempoRelativo(minutos)}` : 'Vazio'}
                </p>
              </header>

              {lista.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-2xl border-2 border-dashed border-line text-sm text-muted">
                  Nenhum pedido
                </div>
              ) : (
                <div className="space-y-2">{lista.map(cartao)}</div>
              )}
            </section>
          )
        })}
      </div>

      {gaveta ? (
        <GavetaFinalizados
          finalizados={finalizados}
          rotuloDia={rotuloDia}
          aoFechar={() => abrirGaveta(false)}
          filtro={
            <FiltroDia
              dia={dia}
              hoje={hoje}
              ontem={ontem}
              // A gaveta continua aberta (e a etapa escolhida) ao trocar de dia.
              hrefDoDia={(d) => {
                const q = new URLSearchParams({ finalizados: '1', etapa })
                if (d !== hoje) q.set('dia', d)
                return `/painel/pedidos?${q}`
              }}
            />
          }
        >
          {finalizados.length === 0 ? (
            <Empty>Nenhum pedido finalizado {rotuloDia}.</Empty>
          ) : (
            <div className="space-y-2">
              {finalizados.map((p) => (
                <CardPedido key={p.id} pedido={p} agora={agora} podeSeparar={false} podeImprimir={false} />
              ))}
            </div>
          )}
        </GavetaFinalizados>
      ) : null}
    </div>
  )
}

const semAssinatura = () => () => {}

function GavetaFinalizados({
  finalizados,
  rotuloDia,
  filtro,
  aoFechar,
  children,
}: {
  finalizados: PedidoOperacional[]
  rotuloDia: string
  filtro: ReactNode
  aoFechar: () => void
  children: ReactNode
}) {
  // Portal so existe no navegador; a gaveta pode vir aberta do servidor
  // (?finalizados=1), entao ela aparece logo depois de hidratar.
  const noNavegador = useSyncExternalStore(semAssinatura, () => true, () => false)
  const fechar = useRef<HTMLButtonElement>(null)
  // Evento, nao dependencia: a cada atualizacao ao vivo o pai recria a
  // funcao, e o foco nao pode pular de volta para o "fechar".
  const aoTeclarEsc = useEffectEvent((e: globalThis.KeyboardEvent) => {
    // O calendario do filtro fecha primeiro com o proprio Esc.
    if (e.key === 'Escape' && !document.querySelector('[aria-label="Escolher dia"]')) aoFechar()
  })

  useEffect(() => {
    if (!noNavegador) return
    const antes = document.activeElement as HTMLElement | null
    fechar.current?.focus()
    const ouvir = (e: globalThis.KeyboardEvent) => aoTeclarEsc(e)
    document.addEventListener('keydown', ouvir)
    return () => {
      document.removeEventListener('keydown', ouvir)
      antes?.focus?.()
    }
  }, [noNavegador])

  if (!noNavegador) return null

  const entregues = finalizados.filter((p) => p.status === 'entregue').length
  const cancelados = finalizados.length - entregues

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div aria-hidden onClick={aoFechar} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-finalizados"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-background shadow-2xl"
      >
        <div className="space-y-3 border-b border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-finalizados" className="text-xl font-black">
                Finalizados {rotuloDia}
              </h2>
              <p className="text-sm text-muted">
                {entregues} {entregues === 1 ? 'entregue' : 'entregues'} · {cancelados}{' '}
                {cancelados === 1 ? 'cancelado' : 'cancelados'}
              </p>
            </div>
            <button
              ref={fechar}
              type="button"
              onClick={aoFechar}
              aria-label="Fechar finalizados"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line hover:bg-foreground/5"
            >
              <X size={20} aria-hidden />
            </button>
          </div>
          {filtro}
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
