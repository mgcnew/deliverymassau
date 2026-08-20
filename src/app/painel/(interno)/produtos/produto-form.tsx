'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { CampoCodigoBarras } from './campo-codigo-barras'
import { CampoFoto } from './campo-foto'
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
  weight_step_g: number
  min_weight_g: number
  sort_order: number
  imagemUrl: string | null
  barcode: string
}

export function ProdutoForm({
  valores,
  categorias,
  somenteLeitura,
}: {
  valores: ProdutoFormValores
  categorias: Array<{ id: string; name: string }>
  somenteLeitura: boolean
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(salvarProduto, {})
  const [porPeso, setPorPeso] = useState(valores.sold_by_weight)
  const [unidade, setUnidade] = useState<UnitType>(valores.unit_type)

  // Peso e unidade andam juntos: marcar "vende por peso" ja assume kg.
  function marcarPorPeso(marcado: boolean) {
    setPorPeso(marcado)
    if (marcado && unidade !== 'kg' && unidade !== 'g') setUnidade('kg')
    if (!marcado && (unidade === 'kg' || unidade === 'g')) setUnidade('unidade')
  }

  return (
    <form action={action} className="space-y-4">
      {valores.id ? <input type="hidden" name="id" value={valores.id} /> : null}

      <Field label="Nome">
        <Input name="name" defaultValue={valores.name} required disabled={somenteLeitura} />
      </Field>

      <Field label="Categoria">
        <Select name="category_id" defaultValue={valores.category_id} required disabled={somenteLeitura}>
          <option value="" disabled>
            Escolha...
          </option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Descricao curta" hint="Aparece embaixo do nome no portal.">
        <Textarea
          name="short_description"
          defaultValue={valores.short_description}
          maxLength={140}
          disabled={somenteLeitura}
        />
      </Field>

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
          <Select
            name="unit_type"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value as UnitType)}
            disabled={somenteLeitura}
          >
            {(porPeso ? ['kg', 'g'] : ['unidade', 'pacote', 'caixa']).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
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

      <CampoFoto imagemAtualUrl={valores.imagemUrl} disabled={somenteLeitura} />

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoCodigoBarras
          produtoId={valores.id}
          defaultValue={valores.barcode}
          disabled={somenteLeitura}
        />
        <Field label="Ordem de exibicao">
          <Input
            name="sort_order"
            type="number"
            defaultValue={valores.sort_order}
            disabled={somenteLeitura}
          />
        </Field>
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}

      {!somenteLeitura ? (
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Salvando...' : valores.id ? 'Salvar produto' : 'Cadastrar produto'}
        </Button>
      ) : (
        <Alert>Voce nao tem permissao para editar produtos.</Alert>
      )}
    </form>
  )
}
