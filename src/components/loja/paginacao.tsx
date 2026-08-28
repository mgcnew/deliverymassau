import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Paginacao por link, sem JavaScript.
 *
 * Escolha proposital em vez de "carregar mais": o cliente que abre um
 * produto e volta cai na mesma pagina onde estava, e o link e compartilhavel.
 * Com botao de carregar mais, voltar joga a pessoa de novo no comeco da
 * lista - o pior atrito possivel em catalogo de milhares de itens.
 */
export function Paginacao({
  pagina,
  total,
  porPagina,
  base,
}: {
  pagina: number
  total: number
  porPagina: number
  /** Caminho com as demais buscas ja embutidas, ex.: "/busca?q=arroz". */
  base: string
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  if (paginas <= 1) return null

  // Trava nos limites: na primeira pagina o "anterior" apontava para p=0.
  // Ele fica desabilitado, mas href invalido ainda vaza para o historico e
  // para quem passa o mouse.
  const href = (p: number) =>
    `${base}${base.includes('?') ? '&' : '?'}p=${Math.min(Math.max(p, 1), paginas)}`
  const botao = 'flex h-12 items-center gap-1 rounded-xl border border-line bg-surface px-4 font-bold'
  const inativo = 'pointer-events-none opacity-40'

  const primeiro = (pagina - 1) * porPagina + 1
  const ultimo = Math.min(pagina * porPagina, total)

  return (
    <nav className="space-y-2" aria-label="Paginas de produtos">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={href(pagina - 1)}
          aria-label="Pagina anterior"
          className={`${botao} ${pagina <= 1 ? inativo : ''}`}
          aria-disabled={pagina <= 1}
        >
          <ChevronLeft size={18} aria-hidden />
          Anterior
        </Link>

        <span className="text-sm font-semibold text-muted">
          Pagina {pagina} de {paginas}
        </span>

        <Link
          href={href(pagina + 1)}
          aria-label="Proxima pagina"
          className={`${botao} ${pagina >= paginas ? inativo : ''}`}
          aria-disabled={pagina >= paginas}
        >
          Proxima
          <ChevronRight size={18} aria-hidden />
        </Link>
      </div>

      <p className="text-center text-sm text-muted">
        Mostrando {primeiro}-{ultimo} de {total.toLocaleString('pt-BR')}
      </p>
    </nav>
  )
}

/** Numero da pagina vindo da URL: qualquer coisa invalida vira 1. */
export function paginaValida(valor: unknown, totalDePaginas = Infinity): number {
  const n = Number(typeof valor === 'string' ? valor : 1)
  if (!Number.isInteger(n) || n < 1) return 1
  return Math.min(n, totalDePaginas)
}
