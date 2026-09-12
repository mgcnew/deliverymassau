'use client'

import type { CamposLote, ItemLote, ProdutoLote } from './actions'

/**
 * Rascunho da edicao em lote, guardado no aparelho.
 *
 * As alteracoes se acumulam enquanto a pessoa troca de busca e de categoria -
 * o lote nao e "o que esta na tela", e tudo o que foi mexido desde o ultimo
 * salvar. Fica no localStorage para sobreviver a um recarregar sem querer ou
 * a ir conferir um produto e voltar.
 *
 * Os precos ficam como texto digitado ("10,9" no meio da digitacao): so viram
 * numero na hora de validar e de salvar.
 */

export type Edicao = {
  name?: string
  price?: string
  original_price?: string
  category_id?: string
  is_active?: boolean
  always_stocked?: boolean
}

export type Rascunho = {
  /** O produto como estava quando a pessoa comecou a mexer: e o "esperado". */
  base: ProdutoLote
  mudar: Edicao
  excluir: boolean
}

export type Rascunhos = Record<string, Rascunho>

const CHAVE = 'massa24h:lote-produtos:v1'
const EVENTO = 'massa24h-lote-produtos'
const VAZIO: Rascunhos = {}

let cache: Rascunhos | null = null

function ler(): Rascunhos {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Rascunhos
  } catch {
    cache = {}
  }
  return cache
}

export function lerRascunhos() {
  return ler()
}
export function lerRascunhosNoServidor() {
  return VAZIO
}

export function assinarRascunhos(avisar: () => void) {
  const aoMudar = (e: Event) => {
    // Outra aba mexeu no mesmo rascunho.
    if (e instanceof StorageEvent && e.key !== CHAVE) return
    cache = null
    avisar()
  }
  window.addEventListener(EVENTO, avisar)
  window.addEventListener('storage', aoMudar)
  return () => {
    window.removeEventListener(EVENTO, avisar)
    window.removeEventListener('storage', aoMudar)
  }
}

export function gravarRascunhos(proximos: Rascunhos) {
  cache = proximos
  try {
    localStorage.setItem(CHAVE, JSON.stringify(proximos))
  } catch {
    // Sem localStorage: o rascunho vale ate fechar a pagina.
  }
  window.dispatchEvent(new Event(EVENTO))
}

// ---------------------------------------------------------------------------

/** "10,99", "10.99" e "1.234,50" -> numero. Ponto sozinho com ate 2 casas e decimal. */
export function lerPreco(texto: string): number {
  const t = texto.replace(/\s/g, '').replace(/^R\$/i, '')
  if (!t) return NaN
  const n = /^\d+\.\d{1,2}$/.test(t) ? Number(t) : Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/** 10.9 -> "10,90", para mostrar no campo. */
export function escreverPreco(valor: number | null) {
  return valor === null ? '' : valor.toFixed(2).replace('.', ',')
}

/** Valor que a linha mostra: o editado, ou o do produto. */
export function valorAtual(r: { base: ProdutoLote; mudar: Edicao }) {
  return {
    name: r.mudar.name ?? r.base.name,
    price: r.mudar.price ?? escreverPreco(r.base.price),
    original_price: r.mudar.original_price ?? escreverPreco(r.base.original_price),
    category_id: r.mudar.category_id ?? r.base.category_id,
    is_active: r.mudar.is_active ?? r.base.is_active,
    always_stocked: r.mudar.always_stocked ?? r.base.always_stocked,
  }
}

/**
 * Aplica uma mudanca e tira do rascunho o que voltou a ser igual ao produto
 * (digitou 10,99 de novo onde ja era 10,99 = nao ha alteracao ali).
 */
export function aplicarEdicao(base: ProdutoLote, mudar: Edicao, campo: keyof Edicao, valor: string | boolean): Edicao {
  const proximo: Edicao = { ...mudar, [campo]: valor }
  const igual =
    campo === 'price'
      ? lerPreco(String(valor)) === base.price
      : campo === 'original_price'
        ? String(valor).trim() === ''
          ? base.original_price === null
          : lerPreco(String(valor)) === base.original_price
        : campo === 'name'
          ? String(valor).trim() === base.name
          : valor === base[campo]
  if (igual) delete proximo[campo]
  return proximo
}

/** Problema que impede salvar a linha, dito do jeito que a pessoa corrige. */
export function validar(r: Rascunho): string | null {
  if (r.excluir) return null
  const v = valorAtual(r)
  if (!v.name.trim()) return 'O nome nao pode ficar vazio.'
  const preco = lerPreco(v.price)
  if (!Number.isFinite(preco) || preco <= 0) return 'Preco invalido.'
  if (v.original_price.trim()) {
    const antigo = lerPreco(v.original_price)
    if (!Number.isFinite(antigo)) return 'Preco antigo invalido.'
    if (antigo <= preco) return 'O preco antigo precisa ser maior que o preco (ou fique em branco).'
  }
  return null
}

/** Rascunho -> o que vai para o banco, com o valor "visto" de cada campo mudado. */
export function paraItem(id: string, r: Rascunho): ItemLote {
  if (r.excluir) return { id, esperado: {}, mudar: {}, excluir: true }

  const esperado: Partial<CamposLote> = {}
  const mudar: Partial<CamposLote> = {}
  if (r.mudar.name !== undefined) {
    esperado.name = r.base.name
    mudar.name = r.mudar.name.trim()
  }
  if (r.mudar.price !== undefined) {
    esperado.price = r.base.price
    mudar.price = lerPreco(r.mudar.price)
  }
  if (r.mudar.original_price !== undefined) {
    esperado.original_price = r.base.original_price
    mudar.original_price = r.mudar.original_price.trim() ? lerPreco(r.mudar.original_price) : null
  }
  if (r.mudar.category_id !== undefined) {
    esperado.category_id = r.base.category_id
    mudar.category_id = r.mudar.category_id
  }
  if (r.mudar.is_active !== undefined) {
    esperado.is_active = r.base.is_active
    mudar.is_active = r.mudar.is_active
  }
  if (r.mudar.always_stocked !== undefined) {
    esperado.always_stocked = r.base.always_stocked
    mudar.always_stocked = r.mudar.always_stocked
  }
  return { id, esperado, mudar }
}
