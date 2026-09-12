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

/** Remove acento/caixa pra comparar texto digitado por gente com nome cadastrado. */
export function normalizarComparacao(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Chave de busca por nome: sem acento, sem caixa, pontuacao virando espaco.
 *
 * Espelha o normalize_text() do banco, do lado do navegador. O que faz a
 * busca funcionar e normalizar OS DOIS lados - o que a pessoa digita e o nome
 * cadastrado: dai "pao frances" acha "PAO FRANCES" e "pão francês" tambem.
 *
 * Na pratica o segundo caso e o que mais acontece por aqui, ao contrario do
 * que parece: o cadastro veio do PDV em caixa alta e praticamente sem acento
 * (um nome acentuado em 4.796), entao quem digita certo e quem nao acharia
 * nada sem isto.
 *
 * A pontuacao vira espaco por causa de nomes como "SAB.DOVE 500ML" e
 * "CARVAO NARGUILE SOL´TO", que vieram assim do sistema antigo.
 */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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

/** 75988887777 -> (75) 98888-7777 */
export function telefone(digitos: string | null | undefined): string {
  const n = (digitos ?? '').replace(/\D/g, '')
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return n
}

/** Data curta com hora, no formato que a operacao le rapido. */
export function dataHora(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'
}

const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'sem', 'em', 'p/', 'c/', 's/'])
// Siglas que ficam maiusculas ("Leite UHT", nao "Leite Uht").
const SIGLAS = new Set(['UHT', 'PET', 'TP', 'DF', 'FPS', 'LED', 'USB', 'AA', 'AAA'])
const MEDIDA = /^(\d+(?:[.,]\d+)?)(kg|g|mg|ml|l|lt|litros?|un|m|cm|mm|w)$/i

/**
 * "ADORO COXA CONG. 1KG" -> "Adoro Coxa Cong. 1kg".
 *
 * Os nomes vem do PDV em caixa alta e abreviados; em maiusculas a leitura
 * fica lenta, principalmente para quem nao tem costume com app. So mexe em
 * nome que esta INTEIRO em maiusculas - nome que a equipe digitou com
 * cuidado ("Pao frances") fica como esta. E so exibicao: busca e banco
 * continuam com o nome original.
 */
export function nomeLegivel(nome: string): string {
  if (/\p{Ll}/u.test(nome)) return nome
  return nome
    .split(/(\s+)/)
    .map((parte, i) => {
      if (/^\s+$/.test(parte) || parte === '') return parte
      if (SIGLAS.has(parte)) return parte
      const medida = parte.match(MEDIDA)
      if (medida) {
        const unidade = medida[2].toLowerCase()
        return medida[1] + (unidade.startsWith('l') ? 'L' : unidade)
      }
      // Codigos com numero no meio ("LV10PG8", "C/15") ficam como vieram.
      if (/\d/.test(parte) && !/^c\/\d+$/i.test(parte)) return parte
      const minuscula = parte.toLocaleLowerCase('pt-BR')
      if (i > 0 && CONECTIVOS.has(minuscula.replace(/\d+$/, ''))) return minuscula
      // Abreviacao grudada ("BISC.ROSCA") vira "Bisc.Rosca".
      return minuscula.replace(/(^|\.)(\p{L})/gu, (_, ponto, letra) => ponto + letra.toLocaleUpperCase('pt-BR'))
    })
    .join('')
}
