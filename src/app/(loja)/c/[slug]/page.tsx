import { notFound } from 'next/navigation'

import { CampoBusca } from '@/components/loja/busca'
import { CategoriasChips } from '@/components/loja/categorias-chips'
import { GradeProdutos } from '@/components/loja/produto-card'
import { Empty } from '@/components/ui/card'
import { getCategoriaPorSlug, getCategorias, getProdutos } from '@/lib/loja/catalogo'

export async function generateMetadata({ params }: PageProps<'/c/[slug]'>) {
  const { slug } = await params
  const categoria = await getCategoriaPorSlug(slug)
  return { title: categoria ? `${categoria.name} | Mercado Massa 24h` : 'Mercado Massa 24h' }
}

export default async function CategoriaPage({ params }: PageProps<'/c/[slug]'>) {
  const { slug } = await params
  const categoria = await getCategoriaPorSlug(slug)
  if (!categoria) notFound()

  const [categorias, produtos] = await Promise.all([
    getCategorias(),
    getProdutos({ categoriaId: categoria.id }),
  ])

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <CampoBusca />
      <CategoriasChips categorias={categorias} ativa={categoria.slug} />

      <h1 className="text-2xl font-black">{categoria.name}</h1>
      {produtos.length === 0 ? (
        <Empty>Nenhum produto nesta categoria por enquanto.</Empty>
      ) : (
        <GradeProdutos produtos={produtos} />
      )}
    </main>
  )
}
