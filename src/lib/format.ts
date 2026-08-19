import type { UnitType } from '@/lib/types'

export function moeda(valor: number | string | null | undefined): string {
  const n = typeof valor === 'string' ? Number(valor) : (valor ?? 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export const UNIT_LABEL: Record<UnitType, string> = {
  unidade: 'unidade',
  pacote: 'pacote',
  caixa: 'caixa',
  kg: 'kg',
  g: 'g',
}

/** "R$ 49,90/kg" para peso, "R$ 10,00" para o resto. */
export function precoPorUnidade(preco: number, porPeso: boolean, unidade: UnitType): string {
  return porPeso ? `${moeda(preco)}/${UNIT_LABEL[unidade]}` : moeda(preco)
}

/** 1.087 -> "1,087 kg" · 2 -> "2 un" */
export function quantidade(valor: number, porPeso: boolean, unidade: UnitType): string {
  if (porPeso) return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ${UNIT_LABEL[unidade]}`
  const inteiro = Number.isInteger(valor) ? valor : Number(valor.toFixed(3))
  return `${inteiro} ${unidade === 'unidade' ? 'un' : UNIT_LABEL[unidade]}`
}

/** Aceita "49,90" e "49.90". */
export function paraNumero(texto: FormDataEntryValue | null): number {
  const limpo = String(texto ?? '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : NaN
}

export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
