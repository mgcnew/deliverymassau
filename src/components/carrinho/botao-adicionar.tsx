'use client'

import { Minus, Plus } from 'lucide-react'

import { moeda } from '@/lib/format'
import type { ProdutoVitrine } from '@/lib/loja/catalogo'
import type { ItemCarrinho } from '@/lib/carrinho/tipos'
import { useCarrinho } from './use-carrinho'

function paraItem(produto: ProdutoVitrine, quantidade: number): ItemCarrinho {
  return {
    productId: produto.id,
    slug: produto.slug,
    name: produto.name,
    imagePath: produto.image_path,
    unitType: produto.unit_type,
    soldByWeight: produto.sold_by_weight,
    price: Number(produto.price),
    quantity: quantidade,
    weightStep: Number(produto.weight_step ?? 0.1),
    minWeight: Number(produto.min_weight ?? 0.1),
    note: '',
  }
}

export function BotaoAdicionar({
  produto,
  tamanho = 'md',
}: {
  produto: ProdutoVitrine
  tamanho?: 'md' | 'lg'
}) {
  const { adicionar, ajustar, quantidadeDe, carregado } = useCarrinho()
  const quantidade = quantidadeDe(produto.id)

  const passo = produto.sold_by_weight ? Number(produto.weight_step ?? 0.1) : 1
  const minimo = produto.sold_by_weight ? Number(produto.min_weight ?? 0.1) : 1
  const altura = tamanho === 'lg' ? 'h-14 text-base' : 'h-11 text-sm'

  if (!produto.is_available) {
    return (
      <p className={`flex ${altura} items-center justify-center rounded-xl bg-black/5 font-bold text-muted`}>
        Indisponivel
      </p>
    )
  }

  if (!carregado || quantidade <= 0) {
    return (
      <button
        type="button"
        onClick={() => adicionar(paraItem(produto, minimo))}
        className={`w-full rounded-xl bg-brand ${altura} font-bold text-brand-foreground hover:bg-brand-strong`}
      >
        Adicionar
      </button>
    )
  }

  // Peso: o cliente pensa em gramas, nao em "0,300 kg".
  const rotulo = produto.sold_by_weight
    ? `${Math.round(quantidade * 1000)} g`
    : `${quantidade} ${produto.unit_type === 'unidade' ? 'un' : produto.unit_type}`

  return (
    <div className={`flex ${altura} items-center justify-between rounded-xl border-2 border-brand`}>
      <button
        type="button"
        aria-label="Diminuir"
        onClick={() => ajustar(produto.id, -passo)}
        className="flex h-full w-11 items-center justify-center text-brand"
      >
        <Minus size={18} />
      </button>
      <span className="flex flex-col items-center leading-tight">
        <span className="font-bold">{rotulo}</span>
        <span className="text-[11px] text-muted">{moeda(quantidade * Number(produto.price))}</span>
      </span>
      <button
        type="button"
        aria-label="Aumentar"
        onClick={() => ajustar(produto.id, passo)}
        className="flex h-full w-11 items-center justify-center text-brand"
      >
        <Plus size={18} />
      </button>
    </div>
  )
}
