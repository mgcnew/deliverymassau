import { notFound } from 'next/navigation'

import { CampoBusca } from '@/components/loja/busca'
import { CategoriasChips } from '@/components/loja/categorias-chips'
import { Paginacao, paginaValida } from '@/components/loja/paginacao'
import { GradeProdutos } from '@/components/loja/produto-card'
import { Empty } from '@/components/ui/card'
import { getCategoriaPorSlug, getCategorias, getProdutosPaginados } from '@/lib/loja/catalogo'

/** Quatro telas de rolagem no celular: o suficiente para valer a espera. */
const POR_PAGINA = 48

export async function generateMetadata({ params }: PageProps<'/c/[slug]'>) {
  const { slug } = await params
  const categoria = await getCategoriaPorSlug(slug)
  return { title: categoria ? `${categoria.name} | Mercado Massa 24h` : 'Mercado Massa 24h' }
}

export default async function CategoriaPage({ params, searchParams }: PageProps<'/c/[slug]'>) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const categoria = await getCategoriaPorSlug(slug)
  if (!categoria) notFound()

  const pagina = paginaValida(query.p)

  const [categorias, { itens, total }] = await Promise.all([
    getCategorias(),
    getProdutosPaginados({ categoriaId: categoria.id, pagina, porPagina: POR_PAGINA }),
  ])

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <CampoBusca />
      <CategoriasChips categorias={categorias} ativa={categoria.slug} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-black">{categoria.name}</h1>
        {total > 0 ? (
          <span className="text-sm text-muted">
            {total.toLocaleString('pt-BR')} {total === 1 ? 'produto' : 'produtos'}
          </span>
        ) : null}
      </div>

      {itens.length === 0 ? (
        <Empty>
          {pagina > 1
            ? 'Esta pagina nao existe mais. Volte para o comeco da categoria.'
            : 'Nenhum produto nesta categoria por enquanto.'}
        </Empty>
      ) : (
        <>
          <GradeProdutos produtos={itens} />
          <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} base={`/c/${slug}`} />
        </>
      )}
    </main>
  )
}
