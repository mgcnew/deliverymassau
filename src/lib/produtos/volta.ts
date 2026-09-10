/**
 * "Volta para onde eu estava": a lista de produtos guarda filtro, busca,
 * categoria e pagina na URL (?f=&q=&c=&p=), entao o link para a edicao
 * leva essa URL junto (?volta=...) e, ao salvar, o painel retorna a ela -
 * na categoria Danones, pagina 3, e nao no comeco do catalogo.
 */

const LISTA = '/painel/produtos'

/**
 * So aceita voltar para a propria lista de produtos. O valor vem da URL:
 * sem essa trava, um link com ?volta=https://outro-site levaria quem salvou
 * para fora do painel.
 */
export function listaSegura(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.startsWith(LISTA)) return LISTA
  try {
    const url = new URL(valor, 'http://painel.local')
    if (url.origin !== 'http://painel.local' || url.pathname !== LISTA) return LISTA
    return `${url.pathname}${url.search}`
  } catch {
    return LISTA
  }
}

/** Link para editar um produto lembrando a lista de onde a pessoa saiu. */
export function linkEdicao(id: string, listaAtual: string) {
  return `${LISTA}/${id}?volta=${encodeURIComponent(listaSegura(listaAtual))}`
}

/** Id da linha do produto na lista: a volta rola ate ela e a destaca. */
export function ancoraProduto(id: string) {
  return `produto-${id}`
}
