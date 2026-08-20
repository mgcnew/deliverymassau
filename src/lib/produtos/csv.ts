/**
 * Parser de CSV proprio, sem dependencia nova. Trata aspas com virgula/aspas
 * embutida (padrao RFC 4180), BOM do Excel e quebra de linha CRLF/LF.
 * A planilha de origem e simples (4 colunas), entao um parser manual e
 * suficiente e evita subir uma biblioteca inteira de planilha so pra isso.
 */
export function parseCsv(texto: string): string[][] {
  const semBom = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let dentroDeAspas = false

  for (let i = 0; i < semBom.length; i++) {
    const c = semBom[i]

    if (dentroDeAspas) {
      if (c === '"') {
        if (semBom[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          dentroDeAspas = false
        }
      } else {
        campo += c
      }
      continue
    }

    if (c === '"') {
      dentroDeAspas = true
    } else if (c === ',' || c === ';') {
      linha.push(campo)
      campo = ''
    } else if (c === '\r') {
      // ignora: o \n seguinte fecha a linha
    } else if (c === '\n') {
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
    } else {
      campo += c
    }
  }

  if (campo !== '' || linha.length > 0) {
    linha.push(campo)
    linhas.push(linha)
  }

  return linhas.filter((l) => l.some((v) => v.trim() !== ''))
}

export type LinhaPlanilha = {
  linha: number
  name: string
  category: string
  unit: string
  price: number | null
}

const ALIASES: Record<'name' | 'category' | 'unit' | 'price', string[]> = {
  name: ['produto', 'nome', 'name'],
  category: ['categoria', 'category'],
  unit: ['unidade', 'unit'],
  price: ['preco', 'preço', 'price', 'valor'],
}

function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Aceita "52.90", "52,90", "1.234,56" (BR) e "1,234.56" (US).
 * Regra: se tem virgula E ponto, o que aparece por ultimo e o separador
 * decimal (o outro e de milhar). Se so tem um dos dois, um unico ponto ou
 * virgula e decimal; VARIOS pontos (sem virgula) sao milhar ("1.234.567").
 */
function paraNumeroPreco(textoOriginal: string): number | null {
  const texto = textoOriginal.trim()
  if (texto === '') return null

  const temVirgula = texto.includes(',')
  const temPonto = texto.includes('.')
  let normalizado: string

  if (temVirgula && temPonto) {
    const ultimaVirgula = texto.lastIndexOf(',')
    const ultimoPonto = texto.lastIndexOf('.')
    normalizado =
      ultimaVirgula > ultimoPonto
        ? texto.replace(/\./g, '').replace(',', '.')
        : texto.replace(/,/g, '')
  } else if (temVirgula) {
    normalizado = texto.replace(',', '.')
  } else if (temPonto && (texto.match(/\./g)?.length ?? 0) > 1) {
    normalizado = texto.replace(/\./g, '')
  } else {
    normalizado = texto
  }

  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

export type ResultadoLeituraCsv =
  | { ok: true; linhas: LinhaPlanilha[] }
  | { ok: false; erro: string }

/** Le o CSV e mapeia as colunas pelo cabecalho (aceita variacao de acento/nome). */
export function lerPlanilhaProdutos(texto: string): ResultadoLeituraCsv {
  const tabela = parseCsv(texto)
  if (tabela.length === 0) return { ok: false, erro: 'O arquivo esta vazio.' }

  const cabecalho = tabela[0].map(normalizarCabecalho)
  const indice: Partial<Record<'name' | 'category' | 'unit' | 'price', number>> = {}

  for (const campo of Object.keys(ALIASES) as Array<keyof typeof ALIASES>) {
    const pos = cabecalho.findIndex((h) => ALIASES[campo].includes(h))
    if (pos === -1) {
      return {
        ok: false,
        erro: `Coluna "${ALIASES[campo][0]}" nao encontrada no cabecalho. Colunas esperadas: produto, categoria, unidade, preco.`,
      }
    }
    indice[campo] = pos
  }

  const linhas: LinhaPlanilha[] = tabela.slice(1).map((colunas, i) => ({
    linha: i + 2, // +1 pelo cabecalho, +1 porque planilha comeca em 1
    name: (colunas[indice.name!] ?? '').trim(),
    category: (colunas[indice.category!] ?? '').trim(),
    unit: (colunas[indice.unit!] ?? '').trim(),
    price: paraNumeroPreco(colunas[indice.price!] ?? ''),
  }))

  return { ok: true, linhas }
}
