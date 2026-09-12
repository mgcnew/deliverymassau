'use client'

import { useActionState, useRef, useState, type FormEvent } from 'react'

import { Abas, type Aba } from '@/components/ui/abas'
import { Selecao } from '@/components/ui/selecao'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { CampoCodigoBarras } from './campo-codigo-barras'
import { CampoFoto } from './campo-foto'
import { UNIT_LABEL } from '@/lib/format'
import type { UnitType } from '@/lib/types'
import { salvarProduto, type FormState } from './actions'

export type ProdutoFormValores = {
  id?: string
  name: string
  category_id: string
  short_description: string
  unit_type: UnitType
  sold_by_weight: boolean
  price: string
  original_price: string
  weight_step_g: number
  min_weight_g: number
  sort_order: number
  imagemUrl: string | null
  barcode: string
}

/** Abas do formulario na edicao. Preco vem primeiro: e o que mais se muda
 *  (quem bipa o produto na gondola vem trocar preco). */
const ABAS_DO_FORM = ['preco', 'dados', 'foto'] as const

const UNIDADES_PESO: UnitType[] = ['kg', 'g']
const UNIDADES_CONTAGEM: UnitType[] = ['unidade', 'pacote', 'caixa']

export function ProdutoForm({
  valores,
  categorias,
  somenteLeitura,
  volta,
  emAbas,
}: {
  valores: ProdutoFormValores
  categorias: Array<{ id: string; name: string }>
  somenteLeitura: boolean
  /** Lista de onde a pessoa veio: salvar volta para ela (ver lib/produtos/volta). */
  volta: string
  /**
   * Edicao: campos em abas (Preco, Dados, Foto e codigo) mais as `extras`
   * que nao sao do formulario (ex.: Estado, que salva na hora). Sem isso -
   * cadastro novo - tudo fica numa pagina so, preenchida em sequencia.
   */
  emAbas?: { inicial: string; extras?: Aba[] }
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(salvarProduto, {})
  const [nome, setNome] = useState(valores.name)
  const [categoria, setCategoria] = useState(valores.category_id)
  const [porPeso, setPorPeso] = useState(valores.sold_by_weight)
  const [unidade, setUnidade] = useState<UnitType>(valores.unit_type)

  const extras = emAbas?.extras ?? []
  const idsValidos = [...ABAS_DO_FORM, ...extras.map((e) => e.id)] as string[]
  const [aba, setAba] = useState(
    emAbas && idsValidos.includes(emAbas.inicial) ? emAbas.inicial : ABAS_DO_FORM[0],
  )
  // O botao Salvar e do formulario: numa aba extra (Estado, que salva na
  // hora) ele so confundiria.
  const naAbaDoForm = !emAbas || (ABAS_DO_FORM as readonly string[]).includes(aba)

  // Campo obrigatorio vazio numa aba escondida: o navegador bloqueia o envio
  // mas nao consegue mostrar o aviso num campo invisivel - o botao parecia
  // nao fazer nada. Leva a pessoa ate a aba do PRIMEIRO campo invalido.
  const pulouNesteEnvio = useRef(false)
  function aoInvalidar(e: FormEvent<HTMLFormElement>) {
    if (!emAbas || pulouNesteEnvio.current) return
    pulouNesteEnvio.current = true
    // Os avisos de invalido de um mesmo envio chegam todos juntos, na mesma
    // tarefa: so o primeiro decide a aba.
    setTimeout(() => {
      pulouNesteEnvio.current = false
    })

    const campo = e.target as HTMLInputElement
    const painel = campo.closest<HTMLElement>('[role="tabpanel"]')
    if (!painel?.hidden) return
    setAba(painel.id.replace('painel-', ''))
    // Depois que a aba aparece, o aviso do navegador ja consegue apontar.
    setTimeout(() => {
      campo.focus()
      campo.reportValidity()
    })
  }

  // Peso e unidade andam juntos: marcar "vende por peso" ja assume kg.
  function marcarPorPeso(marcado: boolean) {
    setPorPeso(marcado)
    if (marcado && unidade !== 'kg' && unidade !== 'g') setUnidade('kg')
    if (!marcado && (unidade === 'kg' || unidade === 'g')) setUnidade('unidade')
  }

  const secaoDados = (
    <>
      <Field label="Nome">
        {/* Controlado por causa do atalho de buscar imagem na aba da foto: ele
            precisa do nome como esta AGORA, nao do que veio do banco. */}
        <Input
          name="name"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          disabled={somenteLeitura}
        />
      </Field>

      <Field label="Categoria">
        <Selecao
          name="category_id"
          rotuloLista="Categoria do produto"
          opcoes={categorias.map((c) => ({ valor: c.id, rotulo: c.name }))}
          valor={categoria}
          onEscolher={setCategoria}
          required
          disabled={somenteLeitura}
        />
      </Field>

      <Field label="Descricao curta" hint="Aparece embaixo do nome no portal.">
        <Textarea
          name="short_description"
          defaultValue={valores.short_description}
          maxLength={140}
          disabled={somenteLeitura}
        />
      </Field>

      <Field label="Ordem de exibicao">
        <Input
          name="sort_order"
          type="number"
          defaultValue={valores.sort_order}
          disabled={somenteLeitura}
        />
      </Field>
    </>
  )

  const secaoPreco = (
    <>
      <label className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
        <input
          type="checkbox"
          name="sold_by_weight"
          className="size-5 accent-[var(--brand)]"
          checked={porPeso}
          onChange={(e) => marcarPorPeso(e.target.checked)}
          disabled={somenteLeitura}
        />
        <span>
          <span className="block font-semibold">Vendido por peso</span>
          <span className="block text-sm text-muted">
            O cliente pede um peso aproximado e a balanca define o valor final na separacao.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Unidade de venda">
          <Selecao
            name="unit_type"
            rotuloLista="Unidade de venda"
            opcoes={(porPeso ? UNIDADES_PESO : UNIDADES_CONTAGEM).map((u) => ({
              valor: u,
              rotulo: UNIT_LABEL[u],
            }))}
            valor={unidade}
            onEscolher={(u) => setUnidade(u as UnitType)}
            disabled={somenteLeitura}
          />
        </Field>

        <Field label={porPeso ? `Preco por ${unidade}` : 'Preco'}>
          <Input
            name="price"
            inputMode="decimal"
            defaultValue={valores.price}
            placeholder="0,00"
            required
            disabled={somenteLeitura}
          />
        </Field>
      </div>

      <Field
        label="Preco antigo (opcional)"
        hint="Preenchendo, o produto aparece em Ofertas com o preco antigo riscado. Deixe em branco pra tirar da promocao."
      >
        <Input
          name="original_price"
          inputMode="decimal"
          defaultValue={valores.original_price}
          placeholder="0,00"
          disabled={somenteLeitura}
        />
      </Field>

      {porPeso ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Incremento no carrinho (g)" hint="Passo dos botoes + e - do cliente.">
            <Input
              name="weight_step_g"
              type="number"
              min={10}
              step={10}
              defaultValue={valores.weight_step_g}
              disabled={somenteLeitura}
            />
          </Field>
          <Field label="Pedido minimo do item (g)">
            <Input
              name="min_weight_g"
              type="number"
              min={10}
              step={10}
              defaultValue={valores.min_weight_g}
              disabled={somenteLeitura}
            />
          </Field>
        </div>
      ) : null}
    </>
  )

  const secaoFoto = (
    <>
      <CampoFoto imagemAtualUrl={valores.imagemUrl} nome={nome} disabled={somenteLeitura} />
      <CampoCodigoBarras
        produtoId={valores.id}
        defaultValue={valores.barcode}
        disabled={somenteLeitura}
      />
    </>
  )

  return (
    <form action={action} onInvalidCapture={aoInvalidar} className="space-y-4">
      {valores.id ? <input type="hidden" name="id" value={valores.id} /> : null}
      <input type="hidden" name="volta" value={volta} />

      {emAbas ? (
        <Abas
          rotulo="Partes do cadastro do produto"
          ativa={aba}
          aoTrocar={setAba}
          abas={[
            { id: 'preco', rotulo: 'Preco', conteudo: secaoPreco },
            { id: 'dados', rotulo: 'Dados', conteudo: secaoDados },
            { id: 'foto', rotulo: 'Foto e codigo', conteudo: secaoFoto },
            ...extras,
          ]}
        />
      ) : (
        <>
          {secaoDados}
          {secaoPreco}
          {secaoFoto}
        </>
      )}

      {naAbaDoForm && state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {naAbaDoForm && state.ok ? <Alert tone="success">{state.ok}</Alert> : null}

      {!naAbaDoForm ? null : !somenteLeitura ? (
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Salvando...' : valores.id ? 'Salvar produto' : 'Cadastrar produto'}
        </Button>
      ) : (
        <Alert>Voce nao tem permissao para editar produtos.</Alert>
      )}
    </form>
  )
}
