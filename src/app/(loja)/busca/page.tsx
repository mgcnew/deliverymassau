import { CampoBusca } from '@/components/loja/busca'
import { CategoriasChips } from '@/components/loja/categorias-chips'
import { GradeProdutos } from '@/components/loja/produto-card'
import { Empty } from '@/components/ui/card'
import { getCategorias, getProdutos } from '@/lib/loja/catalogo'

export const metadata = { title: 'Busca | Mercado Massa 24h' }

export default async function BuscaPage({ searchParams }: PageProps<'/busca'>) {
  const params = await searchParams
  const termo = typeof params.q === 'string' ? params.q.trim() : ''

  const [categorias, produtos] = await Promise.all([
    getCategorias(),
    termo ? getProdutos({ busca: termo }) : Promise.resolve([]),
  ])

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <CampoBusca inicial={termo} />
      <CategoriasChips categorias={categorias} />

      <h1 className="text-xl font-black">
        {termo ? `Resultados para "${termo}"` : 'Digite o que voce procura'}
      </h1>

      {termo && produtos.length === 0 ? (
        <Empty>Nada encontrado. Tente outro nome.</Empty>
      ) : (
        <GradeProdutos produtos={produtos} />
      )}
    </main>
  )
}
