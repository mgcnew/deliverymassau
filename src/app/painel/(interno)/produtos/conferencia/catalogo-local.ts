'use client'

import { normalizarBusca } from '@/lib/format'
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
  /** Nulo em ~120 produtos que nao tem codigo: padaria, fatiados, hortifruti. */
  codigo?: string
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
 * As duas maneiras de achar um produto no aparelho, montadas de uma vez so
 * porque percorrer 5 mil itens duas vezes nao tem por que.
 */
export type Indice = {
  /** Chave do codigo -> produtos. */
  porCodigo: Map<string, ProdutoCatalogo[]>
  /** Nome ja normalizado, para a busca digitada. */
  porNome: Array<{ produto: ProdutoCatalogo; busca: string }>
}

/**
 * porCodigo guarda uma LISTA e nao um produto so porque o cadastro antigo tem
 * o mesmo item duas vezes, uma gravada com o zero da frente e outra sem - e as
 * duas caem na mesma chave (ver chaveDoCodigo). Sao poucos casos, mas entre
 * eles ha "PALMITO 300G" e "PALMITO 550G" dividindo codigo: escolher sozinho
 * marcaria o produto errado como conferido. Quem bipou decide.
 */
export function indexarCatalogo(produtos: ProdutoCatalogo[]): Indice {
  const porCodigo = new Map<string, ProdutoCatalogo[]>()
  const porNome: Indice['porNome'] = []

  for (const produto of produtos) {
    const chave = produto.codigo ? chaveDoCodigo(produto.codigo) : null
    if (chave) {
      const iguais = porCodigo.get(chave)
      if (iguais) iguais.push(produto)
      else porCodigo.set(chave, [produto])
    }
    // O nome e normalizado UMA vez, aqui, e nao a cada tecla digitada.
    porNome.push({ produto, busca: normalizarBusca(produto.nome) })
  }

  return { porCodigo, porNome }
}

/** Menos que isto devolveria meia loja e nao ajudaria ninguem a escolher. */
const MINIMO_PARA_BUSCAR = 2

/**
 * Busca por nome, para conferir o que nao da para bipar - pao da padaria,
 * mortadela fatiada, hortifruti, dose de bebida.
 *
 * Todas as palavras digitadas precisam aparecer, em qualquer ordem: "frances
 * pao" acha "PAO FRANCES", e "leite ninho" nao traz todo leite da loja.
 *
 * Ordena por: produto ativo antes de inativo, depois por onde a palavra
 * aparece (nome que COMECA com o digitado vem antes) e, empatando, pelo nome
 * mais curto - entre "PAO FRANCES" e "MASSA DE PAO FRANCES CONGELADA", quem
 * procurou "pao frances" quer o primeiro.
 *
 * Ativo primeiro porque o cadastro tem duplicata: "Pao frances" existe duas
 * vezes, uma ativa e uma inativa sobrando de antes. As duas aparecem - conferir
 * um inativo e como ele volta para a vitrine, e isso e util - mas a que a loja
 * usa hoje vem em cima.
 */
export function buscarPorNome(indice: Indice, termo: string, limite = 8): ProdutoCatalogo[] {
  const alvo = normalizarBusca(termo)
  if (alvo.length < MINIMO_PARA_BUSCAR) return []

  const palavras = alvo.split(' ')
  const achados: Array<{ produto: ProdutoCatalogo; peso: number }> = []

  for (const { produto, busca } of indice.porNome) {
    let maisTarde = 0
    let serve = true
    for (const palavra of palavras) {
      const onde = busca.indexOf(palavra)
      if (onde < 0) {
        serve = false
        break
      }
      if (onde > maisTarde) maisTarde = onde
    }
    if (serve) {
      const peso = (produto.inativo ? 1_000_000 : 0) + maisTarde * 1000 + busca.length
      achados.push({ produto, peso })
    }
  }

  achados.sort((a, b) => a.peso - b.peso)
  return achados.slice(0, limite).map((a) => a.produto)
}
