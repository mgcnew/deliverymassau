import {
  CHAVE_CARRINHO,
  CHAVE_DADOS_CHECKOUT,
  CHAVE_PEDIDOS,
  type DadosCheckoutSalvos,
  type ItemCarrinho,
} from './tipos'

/**
 * O carrinho vive no localStorage do aparelho (sem conta, sem login).
 * Ele e uma fonte de dados EXTERNA ao React, entao a leitura passa por
 * useSyncExternalStore: alem de ser o caminho correto para hidratacao no
 * servidor, o listener de "storage" mantem duas abas do mesmo cliente com o
 * mesmo carrinho - antes cada aba seguia com a sua copia.
 */

export type EstadoCarrinho = { itens: ItemCarrinho[]; carregado: boolean }

const VAZIO: EstadoCarrinho = { itens: [], carregado: false }
let estado: EstadoCarrinho = VAZIO
const ouvintes = new Set<() => void>()

function lerDoAparelho(): ItemCarrinho[] {
  try {
    const bruto = localStorage.getItem(CHAVE_CARRINHO)
    return bruto ? (JSON.parse(bruto) as ItemCarrinho[]) : []
  } catch {
    return []
  }
}

function definir(itens: ItemCarrinho[]) {
  estado = { itens, carregado: true }
  ouvintes.forEach((avisar) => avisar())
}

export function assinarCarrinho(avisar: () => void) {
  ouvintes.add(avisar)

  const aoMudarStorage = (evento: StorageEvent) => {
    if (evento.key === CHAVE_CARRINHO) definir(lerDoAparelho())
  }
  window.addEventListener('storage', aoMudarStorage)

  return () => {
    ouvintes.delete(avisar)
    window.removeEventListener('storage', aoMudarStorage)
  }
}

export function lerCarrinho(): EstadoCarrinho {
  if (!estado.carregado && typeof window !== 'undefined') {
    estado = { itens: lerDoAparelho(), carregado: true }
  }
  return estado
}

/** No servidor o carrinho e sempre vazio: quem tem os itens e o aparelho. */
export function lerCarrinhoNoServidor(): EstadoCarrinho {
  return VAZIO
}

export function atualizarCarrinho(mudar: (atual: ItemCarrinho[]) => ItemCarrinho[]) {
  const proximos = mudar(lerCarrinho().itens)
  try {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(proximos))
  } catch {
    // sem storage o carrinho ainda vale enquanto a aba estiver aberta
  }
  definir(proximos)
}

// ---------------------------------------------------------------------------
// Pedidos guardados no aparelho (a "area do cliente" sem cadastro)
// ---------------------------------------------------------------------------
export type PedidoSalvo = { token: string; numero: number; em?: string }

const SEM_PEDIDOS: PedidoSalvo[] = []
let pedidos: PedidoSalvo[] | null = null
const ouvintesPedidos = new Set<() => void>()

function lerPedidosDoAparelho(): PedidoSalvo[] {
  try {
    const bruto = localStorage.getItem(CHAVE_PEDIDOS)
    return bruto ? (JSON.parse(bruto) as PedidoSalvo[]) : []
  } catch {
    return []
  }
}

export function assinarPedidos(avisar: () => void) {
  ouvintesPedidos.add(avisar)

  const aoMudarStorage = (evento: StorageEvent) => {
    if (evento.key === CHAVE_PEDIDOS) {
      pedidos = lerPedidosDoAparelho()
      ouvintesPedidos.forEach((f) => f())
    }
  }
  window.addEventListener('storage', aoMudarStorage)

  return () => {
    ouvintesPedidos.delete(avisar)
    window.removeEventListener('storage', aoMudarStorage)
  }
}

export function lerPedidos(): PedidoSalvo[] | null {
  if (pedidos === null && typeof window !== 'undefined') pedidos = lerPedidosDoAparelho()
  return pedidos
}

export function lerPedidosNoServidor(): PedidoSalvo[] | null {
  return null
}

export function guardarPedido(token: string, numero: number) {
  const atuais = lerPedidos() ?? SEM_PEDIDOS
  if (atuais.some((p) => p.token === token)) return

  pedidos = [{ token, numero, em: new Date().toISOString() }, ...atuais].slice(0, 30)
  try {
    localStorage.setItem(CHAVE_PEDIDOS, JSON.stringify(pedidos))
  } catch {
    // sem storage o cliente ainda tem o link na barra de enderecos
  }
  ouvintesPedidos.forEach((f) => f())
}

// ---------------------------------------------------------------------------
// Dados do checkout (nome, telefone, endereco) guardados apos um pedido dar
// certo, para o proximo checkout neste aparelho ja vir preenchido.
// ---------------------------------------------------------------------------
let dadosCheckout: DadosCheckoutSalvos | null | undefined
const ouvintesDadosCheckout = new Set<() => void>()

function lerDadosCheckoutDoAparelho(): DadosCheckoutSalvos | null {
  try {
    const bruto = localStorage.getItem(CHAVE_DADOS_CHECKOUT)
    return bruto ? (JSON.parse(bruto) as DadosCheckoutSalvos) : null
  } catch {
    return null
  }
}

export function assinarDadosCheckout(avisar: () => void) {
  ouvintesDadosCheckout.add(avisar)

  const aoMudarStorage = (evento: StorageEvent) => {
    if (evento.key === CHAVE_DADOS_CHECKOUT) {
      dadosCheckout = lerDadosCheckoutDoAparelho()
      ouvintesDadosCheckout.forEach((f) => f())
    }
  }
  window.addEventListener('storage', aoMudarStorage)

  return () => {
    ouvintesDadosCheckout.delete(avisar)
    window.removeEventListener('storage', aoMudarStorage)
  }
}

export function lerDadosCheckout(): DadosCheckoutSalvos | null {
  if (dadosCheckout === undefined && typeof window !== 'undefined') {
    dadosCheckout = lerDadosCheckoutDoAparelho()
  }
  return dadosCheckout ?? null
}

/** No servidor nao ha aparelho: sempre null, o preenchimento acontece so no cliente. */
export function lerDadosCheckoutNoServidor(): DadosCheckoutSalvos | null {
  return null
}

export function salvarDadosCheckout(dados: DadosCheckoutSalvos) {
  dadosCheckout = dados
  try {
    localStorage.setItem(CHAVE_DADOS_CHECKOUT, JSON.stringify(dados))
  } catch {
    // sem storage nao da pra lembrar no proximo pedido, sem problema
  }
  ouvintesDadosCheckout.forEach((f) => f())
}
