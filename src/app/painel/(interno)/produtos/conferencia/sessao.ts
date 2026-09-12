'use client'

import type { ProdutoCatalogo } from './catalogo-local'

/**
 * As leituras da conferencia, guardadas no aparelho.
 *
 * Mesma ideia do rascunho da edicao em lote, com um motivo a mais: aqui o
 * trabalho e irreproduzivel. Reabrir uma tela de precos e chato; perder duas
 * horas de bipagem porque o sinal caiu no corredor significa andar a loja de
 * novo. Entao a verdade da conferencia e o que esta AQUI, e o servidor recebe
 * copia assim que houver rede.
 *
 * `sincronizada: false` e a fila: o que ainda nao subiu. Reenviar leitura que
 * ja subiu nao causa dano (registrar_leituras e upsert por produto), entao na
 * duvida a tela reenvia em vez de arriscar perder.
 *
 * Uma leitura por produto - bipar o mesmo item de novo atualiza a linha em vez
 * de criar outra. E assim que a conferencia e pensada: uma passada por SKU,
 * com a quantidade digitada quando a pessoa quiser.
 */

export type Leitura = {
  /** Produto do catalogo; null quando o codigo nao existe no cadastro. */
  produtoId: string | null
  codigo: string
  nome: string
  /** Estava inativo no catalogo: conferir traz de volta para a vitrine. */
  inativo: boolean
  /** Opcional. Nulo = "tem"; 0 = "trabalha com isso, mas acabou". Nao e saldo. */
  quantidade: number | null
  em: string
  sincronizada: boolean
}

export type Sessao = {
  conferenciaId: string
  leituras: Record<string, Leitura>
}

const CHAVE = 'massa24h:conferencia:v1'
const EVENTO = 'massa24h-conferencia'

let cache: Sessao | null = null

/**
 * Como a leitura e enderecada na sessao. Produto conhecido vai pelo id;
 * codigo sem cadastro vai pelo proprio codigo, para os desconhecidos tambem
 * nao duplicarem quando a pessoa bipa duas vezes a mesma etiqueta.
 */
export function chaveDaLeitura(l: Pick<Leitura, 'produtoId' | 'codigo'>): string {
  return l.produtoId ?? `codigo:${l.codigo}`
}

function vazia(conferenciaId: string): Sessao {
  return { conferenciaId, leituras: {} }
}

function ler(conferenciaId: string): Sessao {
  if (cache?.conferenciaId === conferenciaId) return cache

  try {
    const guardada = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Sessao | null
    // Sessao de outra conferencia (a anterior foi aplicada e comecou outra):
    // nao mistura as listas.
    cache = guardada?.conferenciaId === conferenciaId ? guardada : vazia(conferenciaId)
  } catch {
    cache = vazia(conferenciaId)
  }
  return cache
}

export function lerSessao(conferenciaId: string) {
  return ler(conferenciaId)
}

/**
 * No servidor a sessao e sempre vazia - ela so existe no aparelho. Constante
 * para o useSyncExternalStore nao ver um objeto novo a cada render.
 */
const NO_SERVIDOR: Sessao = { conferenciaId: '', leituras: {} }
export function lerSessaoNoServidor() {
  return NO_SERVIDOR
}

export function assinarSessao(avisar: () => void) {
  const aoMudar = (e: Event) => {
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

export function gravarSessao(sessao: Sessao) {
  cache = sessao
  try {
    localStorage.setItem(CHAVE, JSON.stringify(sessao))
  } catch {
    // Sem espaco: a sessao vale ate fechar a pagina. A fila continua subindo.
  }
  window.dispatchEvent(new Event(EVENTO))
}

// ---------------------------------------------------------------------------

/**
 * Bipou. Produto ja conferido volta para o topo da lista com a hora nova - e
 * como a pessoa ve que a leitura pegou, mesmo em item repetido. A quantidade
 * ja digitada e preservada: rebipar sem querer nao apaga a contagem.
 */
export function registrar(sessao: Sessao, produto: ProdutoCatalogo | null, codigo: string): Sessao {
  const nova: Leitura = {
    produtoId: produto?.id ?? null,
    codigo,
    nome: produto?.nome ?? codigo,
    inativo: produto?.inativo ?? false,
    quantidade: null,
    em: new Date().toISOString(),
    sincronizada: false,
  }

  const chave = chaveDaLeitura(nova)
  const anterior = sessao.leituras[chave]
  if (anterior) nova.quantidade = anterior.quantidade

  return { ...sessao, leituras: { ...sessao.leituras, [chave]: nova } }
}

export function definirQuantidade(sessao: Sessao, chave: string, quantidade: number | null): Sessao {
  const leitura = sessao.leituras[chave]
  if (!leitura || leitura.quantidade === quantidade) return sessao
  return {
    ...sessao,
    leituras: { ...sessao.leituras, [chave]: { ...leitura, quantidade, sincronizada: false } },
  }
}

export function remover(sessao: Sessao, chave: string): Sessao {
  const leituras = { ...sessao.leituras }
  delete leituras[chave]
  return { ...sessao, leituras }
}

/** O que ainda nao subiu, mais antigo primeiro: a fila sobe na ordem em que foi lida. */
export function pendentes(sessao: Sessao): Array<[string, Leitura]> {
  return Object.entries(sessao.leituras)
    .filter(([, l]) => !l.sincronizada)
    .sort(([, a], [, b]) => a.em.localeCompare(b.em))
}

/**
 * Marca como enviadas as leituras que subiram - mas so as que NAO mudaram
 * desde o envio. Sem essa comparacao, digitar a quantidade enquanto o lote
 * viajava deixaria a alteracao marcada como salva sem nunca ter subido.
 */
export function marcarSincronizadas(sessao: Sessao, enviadas: Array<[string, Leitura]>): Sessao {
  const leituras = { ...sessao.leituras }
  for (const [chave, enviada] of enviadas) {
    const atual = leituras[chave]
    if (!atual || atual.em !== enviada.em || atual.quantidade !== enviada.quantidade) continue
    leituras[chave] = { ...atual, sincronizada: true }
  }
  return { ...sessao, leituras }
}

/** Lista para a tela: bipado por ultimo em cima. */
export function emOrdem(sessao: Sessao): Array<[string, Leitura]> {
  return Object.entries(sessao.leituras).sort(([, a], [, b]) => b.em.localeCompare(a.em))
}

export function contagem(sessao: Sessao) {
  const todas = Object.values(sessao.leituras)
  return {
    conferidos: todas.filter((l) => l.produtoId !== null).length,
    desconhecidos: todas.filter((l) => l.produtoId === null).length,
    acabaram: todas.filter((l) => l.produtoId !== null && l.quantidade === 0).length,
    naFila: todas.filter((l) => !l.sincronizada).length,
  }
}
