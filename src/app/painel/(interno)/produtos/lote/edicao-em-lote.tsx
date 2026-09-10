'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { ScanBarcode, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Alert, Card, Empty } from '@/components/ui/card'
import { LeitorCodigoBarras, useLeitorDisponivel } from '@/components/ui/leitor-codigo-barras'
import { RolagemHorizontal } from '@/components/ui/rolagem-horizontal'
import { moeda } from '@/lib/format'
import { buscarProdutosLote, salvarLote, type ProdutoLote, type ResultadoLote } from './actions'
import { LinhaLote, type Categoria } from './linha-lote'
import {
  aplicarEdicao,
  assinarRascunhos,
  gravarRascunhos,
  lerRascunhos,
  lerRascunhosNoServidor,
  paraItem,
  validar,
  type Edicao,
  type Rascunho,
  type Rascunhos,
} from './rascunho'

/**
 * Edicao de produtos em lote.
 *
 * O PDV da loja nao conversa com o sistema, entao todo preco muda duas vezes.
 * Aqui a segunda vez tem que ser rapida: busca (ou bipa), digita o preco,
 * Enter vai para o proximo, e so no fim "Salvar". Inativar e excluir tambem
 * vao em grupo, pelos selecionados.
 *
 * Tudo fica num rascunho no aparelho (rascunho.ts) ate salvar; o salvar e
 * tudo ou nada no banco (aplicar_lote_produtos).
 */
export function EdicaoEmLote({
  categorias,
  iniciais,
  podeEditar,
  podeDesativar,
  podeExcluir,
}: {
  categorias: Categoria[]
  iniciais: { produtos: ProdutoLote[]; total: number }
  podeEditar: boolean
  podeDesativar: boolean
  podeExcluir: boolean
}) {
  const rascunhos = useSyncExternalStore(assinarRascunhos, lerRascunhos, lerRascunhosNoServidor)
  const leitorDisponivel = useLeitorDisponivel()

  const [termo, setTermo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [resultados, setResultados] = useState(iniciais.produtos)
  const [total, setTotal] = useState(iniciais.total)
  const [buscando, startBusca] = useTransition()
  const [visao, setVisao] = useState<'busca' | 'alterados'>('busca')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [problemas, setProblemas] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<{ tom: 'success' | 'error'; texto: string } | null>(null)
  const [salvando, startSalvar] = useTransition()
  const [lendo, setLendo] = useState(false)
  const focarAposBusca = useRef(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const alterados = Object.keys(rascunhos).length

  // Bipou: quando o resultado chegar, o cursor ja vai para o preco.
  useEffect(() => {
    if (!focarAposBusca.current) return
    focarAposBusca.current = false
    document.querySelector<HTMLInputElement>('[data-lote-preco]')?.focus()
  }, [resultados])

  function buscar(t: string, c: string) {
    setSelecionados(new Set())
    startBusca(async () => {
      const r = await buscarProdutosLote(t, c)
      if (r.erro) setAviso({ tom: 'error', texto: r.erro })
      setResultados(r.produtos)
      setTotal(r.total)
    })
  }

  // --- Rascunho ------------------------------------------------------------

  function guardar(proximos: Rascunhos, ids: string[]) {
    gravarRascunhos(proximos)
    if (ids.some((id) => problemas[id])) {
      setProblemas((atual) => {
        const p = { ...atual }
        for (const id of ids) delete p[id]
        return p
      })
    }
  }

  function comRascunho(proximos: Rascunhos, id: string, r: Rascunho) {
    if (!r.excluir && Object.keys(r.mudar).length === 0) delete proximos[id]
    else proximos[id] = r
  }

  function editar(p: ProdutoLote, campo: keyof Edicao, valor: string | boolean) {
    const atual = rascunhos[p.id] ?? { base: p, mudar: {}, excluir: false }
    const proximos = { ...rascunhos }
    comRascunho(proximos, p.id, { ...atual, mudar: aplicarEdicao(atual.base, atual.mudar, campo, valor) })
    guardar(proximos, [p.id])
  }

  function desfazer(id: string) {
    const proximos = { ...rascunhos }
    delete proximos[id]
    guardar(proximos, [id])
  }

  function emGrupo(acao: 'inativar' | 'reativar' | 'excluir') {
    const proximos = { ...rascunhos }
    const ids = [...selecionados]
    for (const id of ids) {
      const base = rascunhos[id]?.base ?? resultados.find((p) => p.id === id)
      if (!base) continue
      const atual = rascunhos[id] ?? { base, mudar: {}, excluir: false }
      const r: Rascunho =
        acao === 'excluir'
          ? { ...atual, excluir: true }
          : { ...atual, mudar: aplicarEdicao(atual.base, atual.mudar, 'is_active', acao === 'reativar') }
      comRascunho(proximos, id, r)
    }
    guardar(proximos, ids)
    setSelecionados(new Set())
  }

  function descartarTudo() {
    gravarRascunhos({})
    setProblemas({})
    setAviso(null)
    setVisao('busca')
  }

  // --- Salvar --------------------------------------------------------------

  const resumo = { precos: 0, ofertas: 0, nomes: 0, categorias: 0, inativar: 0, reativar: 0, excluir: 0 }
  for (const r of Object.values(rascunhos)) {
    if (r.excluir) {
      resumo.excluir++
      continue
    }
    if (r.mudar.price !== undefined) resumo.precos++
    if (r.mudar.original_price !== undefined) resumo.ofertas++
    if (r.mudar.name !== undefined) resumo.nomes++
    if (r.mudar.category_id !== undefined) resumo.categorias++
    if (r.mudar.is_active === false) resumo.inativar++
    if (r.mudar.is_active === true) resumo.reativar++
  }

  function revisar() {
    setAviso(null)
    const comErro = Object.values(rascunhos).filter((r) => validar(r)).length
    if (comErro) {
      setVisao('alterados')
      setAviso({
        tom: 'error',
        texto: `${comErro} ${comErro === 1 ? 'produto precisa' : 'produtos precisam'} de correcao antes de salvar (marcados em vermelho).`,
      })
      return
    }
    dialogRef.current?.showModal()
  }

  function confirmarSalvar() {
    startSalvar(async () => {
      const res = await salvarLote(Object.entries(rascunhos).map(([id, r]) => paraItem(id, r)))
      dialogRef.current?.close()

      if (res.erro) {
        setAviso({ tom: 'error', texto: res.erro })
        return
      }
      if (!res.ok) {
        aoRecusar(res)
        return
      }

      gravarRascunhos({})
      setProblemas({})
      setVisao('busca')
      setAviso({ tom: 'success', texto: textoSalvo(res) })
      buscar(termo, categoria)
    })
  }

  /**
   * Nada foi gravado. Conflito: outra pessoa mudou o produto - o rascunho
   * passa a partir do valor novo (salvar de novo nao acusa de novo) e a
   * linha diz o que mudou. Invalido: a linha diz o que corrigir.
   */
  function aoRecusar(res: ResultadoLote) {
    const proximos = { ...rascunhos }
    const probs: Record<string, string> = {}

    for (const c of res.conflitos ?? []) {
      const r = proximos[c.id]
      if (!r) continue
      if (c.campo === 'produto') {
        probs[c.id] = 'Este produto nao existe mais. Desfaca esta linha.'
        continue
      }
      const valor =
        c.campo === 'price' || c.campo === 'original_price'
          ? c.atual === null
            ? null
            : Number(c.atual)
          : c.atual
      const base = { ...r.base, [c.campo]: valor } as ProdutoLote
      let mudar: Edicao = {}
      for (const [campo, v] of Object.entries(r.mudar) as Array<[keyof Edicao, string | boolean]>) {
        mudar = aplicarEdicao(base, mudar, campo, v)
      }
      comRascunho(proximos, c.id, { ...r, base, mudar })
      const agora =
        c.campo === 'price' || c.campo === 'original_price'
          ? valor === null
            ? 'sem preco antigo'
            : moeda(valor as number)
          : c.campo === 'is_active'
            ? valor
              ? 'ativo'
              : 'inativo'
            : c.campo === 'category_id'
              ? (categorias.find((k) => k.id === valor)?.name ?? 'outra categoria')
              : String(valor)
      probs[c.id] = `Mudou enquanto voce editava - agora: ${agora}. Confira e salve de novo.`
    }
    for (const i of res.invalidos ?? []) probs[i.id] = i.erro

    gravarRascunhos(proximos)
    setProblemas(probs)
    setVisao('alterados')
    setAviso({ tom: 'error', texto: 'Nada foi salvo. Confira os produtos marcados e salve de novo.' })
  }

  // --- Tela ----------------------------------------------------------------

  const linhas: Array<{ p: ProdutoLote; r?: Rascunho }> =
    visao === 'alterados'
      ? Object.values(rascunhos)
          .map((r) => ({ p: r.base, r }))
          .sort((a, b) => a.p.name.localeCompare(b.p.name, 'pt-BR'))
      : resultados.map((p) => ({ p: rascunhos[p.id]?.base ?? p, r: rascunhos[p.id] }))

  const todosMarcados = linhas.length > 0 && linhas.every(({ p }) => selecionados.has(p.id))

  function alternarTodos() {
    setSelecionados(todosMarcados ? new Set() : new Set(linhas.map(({ p }) => p.id)))
  }

  function alternar(id: string) {
    setSelecionados((atual) => {
      const s = new Set(atual)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  // Enter no preco vai para o preco do proximo produto: da para copiar uma
  // lista do PDV sem tirar a mao do teclado.
  function proximoPreco(atual: HTMLInputElement) {
    const campos = [...document.querySelectorAll<HTMLInputElement>('[data-lote-preco]')]
    const proximo = campos[campos.indexOf(atual) + 1]
    if (!proximo) return
    proximo.focus({ preventScroll: true })
    // No meio da tela: embaixo, a barra de salvar cobriria o campo.
    proximo.scrollIntoView({ behavior: 'instant', block: 'center' })
  }

  return (
    // Folga no fim com a barra de salvar aberta: as ultimas linhas conseguem
    // rolar para cima dela em vez de ficarem escondidas atras.
    <div className={`space-y-4 ${alterados > 0 ? 'pb-28' : 'pb-4'}`}>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setAviso(null)
          setVisao('busca')
          buscar(termo, categoria)
        }}
      >
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Nome ou codigo de barras"
          aria-label="Buscar produto"
          className="h-12 min-w-0 flex-1 basis-56 rounded-xl border border-line bg-surface px-3 text-base"
        />
        <select
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value)
            setAviso(null)
            setVisao('busca')
            buscar(termo, e.target.value)
          }}
          aria-label="Categoria"
          className="h-12 min-w-0 flex-1 basis-40 rounded-xl border border-line bg-surface px-3"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {leitorDisponivel ? (
          <button
            type="button"
            onClick={() => setLendo(true)}
            aria-label="Ler codigo de barras com a camera"
            title="Ler codigo de barras"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground"
          >
            <ScanBarcode size={22} aria-hidden />
          </button>
        ) : null}
        <button
          disabled={buscando}
          className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold"
        >
          <Search size={18} aria-hidden />
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      <RolagemHorizontal>
        <div className="flex w-max gap-2">
          <button
            type="button"
            onClick={() => setVisao('busca')}
            className={`rounded-full px-4 py-2.5 text-sm font-bold ${
              visao === 'busca' ? 'bg-brand text-brand-foreground' : 'border border-line bg-surface'
            }`}
          >
            Resultado da busca
          </button>
          <button
            type="button"
            onClick={() => setVisao('alterados')}
            className={`rounded-full px-4 py-2.5 text-sm font-bold ${
              visao === 'alterados' ? 'bg-brand text-brand-foreground' : 'border border-line bg-surface'
            }`}
          >
            Alterados ({alterados})
          </button>
        </div>
      </RolagemHorizontal>

      {aviso ? <Alert tone={aviso.tom}>{aviso.texto}</Alert> : null}

      {selecionados.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand bg-brand/5 p-3">
          <span className="mr-auto text-sm font-bold">
            {selecionados.size} {selecionados.size === 1 ? 'selecionado' : 'selecionados'}
          </span>
          {podeDesativar ? (
            <>
              <Button type="button" variant="secondary" onClick={() => emGrupo('inativar')}>
                Inativar
              </Button>
              <Button type="button" variant="secondary" onClick={() => emGrupo('reativar')}>
                Reativar
              </Button>
            </>
          ) : null}
          {podeExcluir ? (
            <Button type="button" variant="danger" onClick={() => emGrupo('excluir')}>
              Excluir
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => setSelecionados(new Set())}>
            Limpar
          </Button>
        </div>
      ) : null}

      <Card className="p-0 sm:p-0">
        {linhas.length === 0 ? (
          <div className="p-4">
            <Empty>
              {visao === 'alterados' ? 'Nenhuma alteracao ainda.' : 'Nenhum produto nesta busca.'}
            </Empty>
          </div>
        ) : (
          <>
            {/* Cabecalho da tabela: so no computador, onde as colunas existem. */}
            <div className="hidden grid-cols-[2rem_minmax(0,2.2fr)_minmax(0,1.3fr)_7.5rem_7.5rem_6.5rem] items-center gap-3 border-b border-line px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted md:grid">
              <input
                type="checkbox"
                checked={todosMarcados}
                onChange={alternarTodos}
                aria-label="Selecionar todos"
                className="size-5 accent-[var(--brand)]"
              />
              <span>Produto</span>
              <span>Categoria</span>
              <span>Preco</span>
              <span>Preco antigo</span>
              <span />
            </div>
            <label className="flex items-center gap-3 border-b border-line px-4 py-2 text-sm font-semibold md:hidden">
              <input
                type="checkbox"
                checked={todosMarcados}
                onChange={alternarTodos}
                className="size-5 accent-[var(--brand)]"
              />
              Selecionar todos
            </label>

            <ul className="divide-y divide-line">
              {linhas.map(({ p, r }) => (
                <LinhaLote
                  key={p.id}
                  produto={p}
                  rascunho={r}
                  categorias={categorias}
                  selecionado={selecionados.has(p.id)}
                  problema={problemas[p.id] ?? (r ? validar(r) : null)}
                  podeEditar={podeEditar}
                  aoSelecionar={() => alternar(p.id)}
                  aoEditar={(campo, valor) => editar(p, campo, valor)}
                  aoDesfazer={() => desfazer(p.id)}
                  aoEnter={proximoPreco}
                />
              ))}
            </ul>
          </>
        )}
      </Card>

      {visao === 'busca' && total > resultados.length ? (
        <p className="text-center text-sm text-muted">
          Mostrando {resultados.length} de {total}. Refine a busca ou escolha uma categoria para ver
          os outros.
        </p>
      ) : null}

      {/* Barra de salvar: gruda no rodape da area de rolagem. bottom-0 ja
          fica acima da navegacao do celular - o sticky desconta o pb-24 que
          o <main> reserva para ela. */}
      {alterados > 0 ? (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
          <p className="mr-auto font-bold">
            {alterados} {alterados === 1 ? 'alteracao' : 'alteracoes'}
            <span className="block text-xs font-normal text-muted">Guardado neste aparelho ate salvar.</span>
          </p>
          <Button type="button" variant="ghost" onClick={descartarTudo} disabled={salvando}>
            Descartar
          </Button>
          <Button type="button" onClick={revisar} disabled={salvando}>
            Salvar tudo
          </Button>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-5 text-foreground backdrop:bg-black/50"
      >
        <p className="text-lg font-bold">Salvar {alterados} {alterados === 1 ? 'alteracao' : 'alteracoes'}?</p>
        <ul className="mt-3 space-y-1 text-sm">
          {resumo.precos ? <li>{resumo.precos} preco(s) novo(s)</li> : null}
          {resumo.ofertas ? <li>{resumo.ofertas} preco(s) antigo(s) de oferta</li> : null}
          {resumo.nomes ? <li>{resumo.nomes} nome(s)</li> : null}
          {resumo.categorias ? <li>{resumo.categorias} troca(s) de categoria</li> : null}
          {resumo.inativar ? <li>{resumo.inativar} para inativar</li> : null}
          {resumo.reativar ? <li>{resumo.reativar} para reativar</li> : null}
          {resumo.excluir ? (
            <li className="font-semibold text-[var(--tone-error-fg)]">
              {resumo.excluir} para excluir - os que ja venderam sao desativados, nao apagados
            </li>
          ) : null}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Entra tudo de uma vez: se algum produto tiver problema, nada e gravado e ele fica marcado.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={salvando} onClick={() => dialogRef.current?.close()}>
            Voltar
          </Button>
          <Button type="button" disabled={salvando} onClick={confirmarSalvar}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </dialog>

      {lendo ? (
        <LeitorCodigoBarras
          titulo="Aponte para o codigo do produto"
          onFechar={() => setLendo(false)}
          onDetectar={(codigo) => {
            setLendo(false)
            setTermo(codigo)
            setCategoria('')
            setVisao('busca')
            focarAposBusca.current = true
            buscar(codigo, '')
          }}
        />
      ) : null}
    </div>
  )
}

function textoSalvo(res: ResultadoLote) {
  const partes: string[] = []
  if (res.atualizados) partes.push(`${res.atualizados} ${res.atualizados === 1 ? 'produto atualizado' : 'produtos atualizados'}`)
  if (res.excluidos?.length) partes.push(`${res.excluidos.length} excluido(s)`)
  if (res.desativados?.length) {
    partes.push(`${res.desativados.length} desativado(s) em vez de excluido(s), porque ja tinham vendas`)
  }
  return `Salvo: ${partes.join(', ')}.`
}
