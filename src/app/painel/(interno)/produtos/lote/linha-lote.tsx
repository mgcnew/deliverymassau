'use client'

import { RotateCcw } from 'lucide-react'

import { moeda } from '@/lib/format'
import type { ProdutoLote } from './actions'
import { valorAtual, type Edicao, type Rascunho } from './rascunho'

export type Categoria = { id: string; name: string; is_active: boolean }

/**
 * Um produto na edicao em lote. No computador e uma linha de tabela
 * (colunas alinhadas com o cabecalho); no celular vira um cartao compacto,
 * com o preco bem a mao para quem bipa na gondola.
 *
 * O que mudou fica marcado no proprio campo - borda da marca e o valor
 * antigo embaixo - para a pessoa revisar o lote antes de salvar.
 */
export function LinhaLote({
  produto,
  rascunho,
  categorias,
  selecionado,
  problema,
  podeEditar,
  aoSelecionar,
  aoEditar,
  aoDesfazer,
  aoEnter,
}: {
  produto: ProdutoLote
  rascunho?: Rascunho
  categorias: Categoria[]
  selecionado: boolean
  problema: string | null
  podeEditar: boolean
  aoSelecionar: () => void
  aoEditar: (campo: keyof Edicao, valor: string | boolean) => void
  aoDesfazer: () => void
  aoEnter: (campo: HTMLInputElement) => void
}) {
  const r = rascunho ?? { base: produto, mudar: {}, excluir: false }
  const v = valorAtual(r)
  const mudou = (campo: keyof Edicao) => r.mudar[campo] !== undefined
  const excluir = r.excluir
  const travado = excluir || !podeEditar

  const campo = (alterado: boolean) =>
    `h-11 w-full min-w-0 rounded-lg border bg-surface px-2.5 disabled:opacity-60 ${
      alterado ? 'border-brand bg-brand/5 font-semibold' : 'border-line'
    }`

  return (
    <li
      className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[2rem_minmax(0,2.2fr)_minmax(0,1.3fr)_7.5rem_7.5rem_6.5rem] md:items-center ${
        excluir ? 'bg-[var(--tone-error-bg)]' : selecionado ? 'bg-brand/5' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={selecionado}
        onChange={aoSelecionar}
        aria-label={`Selecionar ${produto.name}`}
        className="mt-3 size-5 accent-[var(--brand)] md:mt-0"
      />

      {/* Nome: no celular divide a primeira linha com o botao de desfazer. */}
      <div className="min-w-0">
        <input
          value={v.name}
          onChange={(e) => aoEditar('name', e.target.value)}
          disabled={travado}
          aria-label={`Nome de ${produto.name}`}
          className={`${campo(mudou('name'))} ${excluir ? 'line-through' : ''}`}
        />
        <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted">
          {produto.barcode ? <span>{produto.barcode}</span> : null}
          {!v.is_active && !mudou('is_active') ? <Selo>inativo</Selo> : null}
          {mudou('is_active') ? <Selo forte>{v.is_active ? 'reativar' : 'inativar'}</Selo> : null}
          <BotaoSempreTem
            marcado={v.always_stocked}
            mudou={mudou('always_stocked')}
            travado={travado}
            nome={produto.name}
            aoAlternar={() => aoEditar('always_stocked', !v.always_stocked)}
          />
          {excluir ? <Selo perigo>excluir</Selo> : null}
        </p>
      </div>

      <div className="flex items-center justify-end md:order-last">
        {rascunho ? (
          <button
            type="button"
            onClick={aoDesfazer}
            aria-label={`Desfazer alteracoes de ${produto.name}`}
            title="Desfazer"
            className="flex h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-foreground/5"
          >
            <RotateCcw size={16} aria-hidden />
            <span className="hidden sm:inline">Desfazer</span>
          </button>
        ) : null}
      </div>

      {/* Celular: categoria e precos numa segunda linha, abaixo do nome. */}
      <div className="col-span-2 col-start-2 grid grid-cols-2 gap-2 md:contents">
        <select
          value={v.category_id}
          onChange={(e) => aoEditar('category_id', e.target.value)}
          disabled={travado}
          aria-label={`Categoria de ${produto.name}`}
          className={`${campo(mudou('category_id'))} col-span-2 md:col-span-1`}
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.is_active ? '' : ' (inativa)'}
            </option>
          ))}
        </select>

        <label className="min-w-0">
          <span className="mb-0.5 block text-xs font-semibold text-muted md:hidden">Preco</span>
          <input
            data-lote-preco
            value={v.price}
            onChange={(e) => aoEditar('price', e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              aoEnter(e.currentTarget)
            }}
            inputMode="decimal"
            enterKeyHint="next"
            disabled={travado}
            aria-label={`Preco de ${produto.name}`}
            className={`${campo(mudou('price'))} text-right tabular-nums`}
          />
          {mudou('price') && !excluir ? (
            <span className="mt-0.5 block text-right text-xs text-muted">era {moeda(r.base.price)}</span>
          ) : null}
        </label>

        <label className="min-w-0">
          <span className="mb-0.5 block text-xs font-semibold text-muted md:hidden">Preco antigo</span>
          <input
            value={v.original_price}
            onChange={(e) => aoEditar('original_price', e.target.value)}
            onFocus={(e) => e.target.select()}
            inputMode="decimal"
            placeholder="-"
            disabled={travado}
            aria-label={`Preco antigo (oferta) de ${produto.name}`}
            className={`${campo(mudou('original_price'))} text-right tabular-nums`}
          />
          {mudou('original_price') && !excluir ? (
            <span className="mt-0.5 block text-right text-xs text-muted">
              era {r.base.original_price === null ? 'sem oferta' : moeda(r.base.original_price)}
            </span>
          ) : null}
        </label>
      </div>

      {problema ? (
        <p
          role="status"
          className="col-span-2 col-start-2 text-sm font-semibold text-[var(--tone-error-fg)] md:col-span-5"
        >
          {problema}
        </p>
      ) : null}
    </li>
  )
}

/**
 * "Sempre tem" da linha: um toque marca, outro desmarca.
 *
 * Existe alem da acao em grupo porque o caso comum nao e marcar uma categoria
 * inteira - e passar o olho numa busca ("pao") e marcar os dois ou tres que
 * a loja realmente sempre trabalha. Ir ate a ficha de cada um so para isso
 * fazia a pessoa desistir no meio.
 *
 * Desmarcado ele continua a vista, apagado: senao nao haveria onde tocar, e
 * a unica forma de descobrir que o campo existe seria ja ter marcado.
 */
function BotaoSempreTem({
  marcado,
  mudou,
  travado,
  nome,
  aoAlternar,
}: {
  marcado: boolean
  mudou: boolean
  travado: boolean
  nome: string
  aoAlternar: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      disabled={travado}
      aria-pressed={marcado}
      title={
        marcado
          ? 'A conferencia nunca tira este produto do catalogo'
          : 'Marcar: a conferencia nunca tira este produto do catalogo'
      }
      aria-label={`Sempre tem - ${nome}`}
      className={`rounded-full px-2 py-0.5 font-bold disabled:opacity-60 ${
        mudou
          ? 'bg-brand text-brand-foreground'
          : marcado
            ? 'bg-foreground/10 text-foreground'
            : 'border border-dashed border-line text-muted'
      }`}
    >
      {marcado ? 'sempre tem' : 'nao sempre'}
    </button>
  )
}

function Selo({
  children,
  forte,
  perigo,
}: {
  children: React.ReactNode
  forte?: boolean
  perigo?: boolean
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-bold ${
        perigo
          ? 'bg-rose-600 text-white'
          : forte
            ? 'bg-brand text-brand-foreground'
            : 'bg-foreground/10 text-foreground'
      }`}
    >
      {children}
    </span>
  )
}
