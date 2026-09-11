'use client'

import { Minus, Plus, Trash2 } from 'lucide-react'

import { moeda, nomeLegivel } from '@/lib/format'
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
      <p className={`flex ${altura} items-center justify-center rounded-xl bg-foreground/5 font-bold text-muted`}>
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
        className="flex h-full w-11 items-center justify-center text-brand-ink"
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
        className="flex h-full w-11 items-center justify-center text-brand-ink"
      >
        <Plus size={18} />
      </button>
    </div>
  )
}

/**
 * Versao do cartao da vitrine: um "+" redondo no canto da foto (o padrao dos
 * apps de mercado), que vira o seletor de quantidade depois do primeiro
 * toque. O cartao fica ~50px mais baixo que com o botao "Adicionar" de
 * largura inteira - cabe quase o dobro de produto na tela - e a tela para
 * de ter seis botoes vermelhos iguais disputando o olho.
 *
 * Quem chama posiciona (fica por cima da foto, embaixo a direita).
 */
export function BotaoAdicionarCompacto({ produto }: { produto: ProdutoVitrine }) {
  const { adicionar, ajustar, remover, quantidadeDe, carregado } = useCarrinho()
  const quantidade = carregado ? quantidadeDe(produto.id) : 0
  const nome = nomeLegivel(produto.name)

  if (!produto.is_available) return null

  const passo = produto.sold_by_weight ? Number(produto.weight_step ?? 0.1) : 1
  const minimo = produto.sold_by_weight ? Number(produto.min_weight ?? 0.1) : 1

  if (quantidade <= 0) {
    return (
      <button
        type="button"
        onClick={() => adicionar(paraItem(produto, minimo))}
        aria-label={`Adicionar ${nome}`}
        className="flex size-11 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[0_2px_8px_rgba(0,0,0,0.25)] hover:bg-brand-strong"
      >
        <Plus size={22} strokeWidth={2.75} aria-hidden />
      </button>
    )
  }

  const rotulo = produto.sold_by_weight
    ? `${Math.round(quantidade * 1000)} g`
    : `${quantidade} ${produto.unit_type === 'unidade' ? 'un' : produto.unit_type}`
  // No minimo, o "-" tira do carrinho: com peso, descer abaixo do minimo
  // deixaria uma quantidade que o mercado nao vende.
  const noMinimo = quantidade - passo < minimo - 1e-9

  return (
    <div className="flex h-11 w-full items-center justify-between rounded-full border-2 border-brand bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
      <button
        type="button"
        aria-label={noMinimo ? `Tirar ${nome} do carrinho` : `Diminuir ${nome}`}
        onClick={() => (noMinimo ? remover(produto.id) : ajustar(produto.id, -passo))}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-brand-ink"
      >
        {noMinimo ? <Trash2 size={17} aria-hidden /> : <Minus size={18} aria-hidden />}
      </button>
      <span aria-live="polite" className="min-w-0 truncate text-sm font-black tabular-nums">
        {rotulo}
      </span>
      <button
        type="button"
        aria-label={`Aumentar ${nome}`}
        onClick={() => ajustar(produto.id, passo)}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-brand-ink"
      >
        <Plus size={18} aria-hidden />
      </button>
    </div>
  )
}
