import {
  CHAVE_CARRINHO,
  CHAVE_DADOS_CHECKOUT,
  CHAVE_DADOS_CHECKOUT_V2,
  CHAVE_PEDIDOS,
  mesmoEndereco,
  type DadosCheckoutSalvos,
  type DadosCheckoutV1,
  type EnderecoSalvo,
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

function novoId() {
  return Math.random().toString(36).slice(2, 10)
}

function lerDadosCheckoutDoAparelho(): DadosCheckoutSalvos | null {
  try {
    const novo = localStorage.getItem(CHAVE_DADOS_CHECKOUT_V2)
    if (novo) {
      const d = JSON.parse(novo) as DadosCheckoutSalvos
      // Defesa contra JSON estragado ou de versao futura: sem lista utilizavel
      // e melhor comecar do zero que quebrar o checkout.
      return Array.isArray(d?.enderecos) ? d : null
    }

    // Aparelho que so tem o formato antigo: converte o unico endereco em uma
    // lista de um. Roda uma vez - a proxima gravacao ja sai na v2.
    const velho = localStorage.getItem(CHAVE_DADOS_CHECKOUT)
    if (!velho) return null
    const v1 = JSON.parse(velho) as DadosCheckoutV1
    if (!v1?.endereco) return null
    const convertido: DadosCheckoutSalvos = {
      nome: v1.nome,
      telefone: v1.telefone,
      enderecos: [{ id: novoId(), apelido: '', ...v1.endereco }],
      ultimoId: null,
    }
    convertido.ultimoId = convertido.enderecos[0].id
    return convertido
  } catch {
    return null
  }
}

export function assinarDadosCheckout(avisar: () => void) {
  ouvintesDadosCheckout.add(avisar)

  const aoMudarStorage = (evento: StorageEvent) => {
    if (evento.key === CHAVE_DADOS_CHECKOUT_V2 || evento.key === CHAVE_DADOS_CHECKOUT) {
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
    localStorage.setItem(CHAVE_DADOS_CHECKOUT_V2, JSON.stringify(dados))
    // A chave antiga sai de cena: deixa-la para tras faria um aparelho que
    // limpasse a v2 voltar a um endereco desatualizado.
    localStorage.removeItem(CHAVE_DADOS_CHECKOUT)
  } catch {
    // sem storage nao da pra lembrar no proximo pedido, sem problema
  }
  ouvintesDadosCheckout.forEach((f) => f())
}

/**
 * Guarda o endereco do pedido que acabou de dar certo. Se ja existir um com a
 * mesma rua, numero e bairro, atualiza no lugar em vez de duplicar - senao a
 * lista enche de repeticoes de quem sempre pede para casa.
 *
 * O limite de 6 evita a lista virar rolagem infinita num celular; o mais
 * antigo que nao esta em uso sai.
 */
export function guardarEnderecoUsado(
  base: { nome: string; telefone: string },
  endereco: Omit<EnderecoSalvo, 'id'>,
) {
  const atual = lerDadosCheckout()
  const lista = atual?.enderecos ?? []
  const existente = lista.find((e) => mesmoEndereco(e, endereco))
  const id = existente?.id ?? novoId()

  const atualizada = existente
    ? lista.map((e) => (e.id === id ? { ...e, ...endereco, id } : e))
    : [{ ...endereco, id }, ...lista].slice(0, 6)

  salvarDadosCheckout({ nome: base.nome, telefone: base.telefone, enderecos: atualizada, ultimoId: id })
}

export function removerEnderecoSalvo(id: string) {
  const atual = lerDadosCheckout()
  if (!atual) return
  const enderecos = atual.enderecos.filter((e) => e.id !== id)
  salvarDadosCheckout({
    ...atual,
    enderecos,
    ultimoId: atual.ultimoId === id ? (enderecos[0]?.id ?? null) : atual.ultimoId,
  })
}
