'use client'

import { chaveDoCodigo } from '@/lib/produtos/codigo-barras'

/**
 * O catalogo inteiro guardado no aparelho, para a bipada ser resolvida sem
 * rede.
 *
 * Sao ~4,8 mil produtos com codigo de barras, uns 500 KB de JSON. Baixa uma
 * vez e fica: no corredor do mercado o 4G cai, e uma ida ao servidor por
 * bipada transformaria "bipou, proximo" numa espera a cada item - quando
 * funcionasse. Aqui a leitura e instantanea e a conferencia inteira anda sem
 * sinal; o que precisa de rede e so a fila de leituras (ver sessao.ts).
 *
 * Fica no localStorage e nao na memoria porque recarregar a pagina no meio do
 * corredor e comum (a tela fica horas aberta com a camera ligada) e baixar
 * meio mega de novo, sem sinal, deixaria a pessoa parada.
 */

export type ProdutoCatalogo = {
  id: string
  nome: string
  codigo: string
  /** Inativo hoje: bipar traz de volta para a vitrine. So vem quando e true. */
  inativo?: boolean
}

const CHAVE = 'massa24h:catalogo-conferencia:v1'

/**
 * Depois disso o catalogo local e considerado velho e vale a pena rebaixar.
 * Doze horas cobre uma conferencia inteira sem reavisar, e ainda assim pega o
 * que foi cadastrado ontem.
 */
const VALIDADE_MS = 12 * 60 * 60 * 1000

export type CatalogoGuardado = { baixadoEm: number; produtos: ProdutoCatalogo[] }

const EVENTO = 'massa24h-catalogo-conferencia'

/**
 * O catalogo e store externa (e nao estado de componente) pelo mesmo motivo do
 * rascunho da edicao em lote: quem manda e o localStorage, e a tela so
 * acompanha. Ler no primeiro render evitaria um efeito so para copiar o que ja
 * esta no aparelho para dentro do React.
 *
 * O cache de modulo e o que mantem a referencia estavel entre renders - sem
 * ele o useSyncExternalStore veria objeto novo toda vez e renderizaria sem
 * parar.
 */
let cache: CatalogoGuardado | null = null
let lido = false

export function lerCatalogo(): CatalogoGuardado | null {
  if (lido) return cache
  lido = true
  try {
    const bruto = localStorage.getItem(CHAVE)
    const guardado = bruto ? (JSON.parse(bruto) as CatalogoGuardado) : null
    cache = Array.isArray(guardado?.produtos) ? guardado : null
  } catch {
    cache = null
  }
  return cache
}

/** No servidor nao ha catalogo: o HTML sai sem ele e ele aparece na hidratacao. */
export function lerCatalogoNoServidor(): CatalogoGuardado | null {
  return null
}

export function assinarCatalogo(avisar: () => void) {
  const aoMudar = (e: Event) => {
    if (e instanceof StorageEvent && e.key !== CHAVE) return
    lido = false
    avisar()
  }
  window.addEventListener(EVENTO, avisar)
  window.addEventListener('storage', aoMudar)
  return () => {
    window.removeEventListener(EVENTO, avisar)
    window.removeEventListener('storage', aoMudar)
  }
}

export function guardarCatalogo(produtos: ProdutoCatalogo[]) {
  cache = { baixadoEm: Date.now(), produtos }
  lido = true
  try {
    localStorage.setItem(CHAVE, JSON.stringify(cache))
  } catch {
    // Sem espaco ou sem localStorage: o catalogo vale ate fechar a pagina.
  }
  window.dispatchEvent(new Event(EVENTO))
}

export function catalogoVencido(guardado: CatalogoGuardado | null): boolean {
  return !guardado || Date.now() - guardado.baixadoEm > VALIDADE_MS
}

/**
 * Indice de busca: chave do codigo -> produtos.
 *
 * Uma LISTA e nao um produto so porque o cadastro antigo tem o mesmo item
 * duas vezes, uma gravada com o zero da frente e outra sem - e as duas caem
 * na mesma chave (ver chaveDoCodigo). Sao poucos casos, mas entre eles ha
 * "PALMITO 300G" e "PALMITO 550G" dividindo codigo: escolher sozinho marcaria
 * o produto errado como conferido. Quem bipou decide.
 */
export function indexarCatalogo(produtos: ProdutoCatalogo[]): Map<string, ProdutoCatalogo[]> {
  const indice = new Map<string, ProdutoCatalogo[]>()
  for (const produto of produtos) {
    const chave = chaveDoCodigo(produto.codigo)
    if (!chave) continue
    const iguais = indice.get(chave)
    if (iguais) iguais.push(produto)
    else indice.set(chave, [produto])
  }
  return indice
}
