import { CampoBusca } from '@/components/loja/busca'
import { CategoriasChips } from '@/components/loja/categorias-chips'
import { Paginacao, paginaValida } from '@/components/loja/paginacao'
import { GradeProdutos } from '@/components/loja/produto-card'
import { Empty } from '@/components/ui/card'
import { getCategorias, getProdutosPaginados } from '@/lib/loja/catalogo'

export const metadata = { title: 'Busca | Mercado Massa 24h' }

const POR_PAGINA = 48

export default async function BuscaPage({ searchParams }: PageProps<'/busca'>) {
  const params = await searchParams
  const termo = typeof params.q === 'string' ? params.q.trim() : ''
  const pagina = paginaValida(params.p)

  const [categorias, resultado] = await Promise.all([
    getCategorias(),
    // Busca ampla em catalogo grande devolve centenas de itens ("leite" pega
    // tudo que menciona leite): sem paginar, a tela de resultado tinha o
    // mesmo problema da home.
    termo
      ? getProdutosPaginados({ busca: termo, pagina, porPagina: POR_PAGINA })
      : Promise.resolve({ itens: [], total: 0 }),
  ])

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <CampoBusca inicial={termo} />
      <CategoriasChips categorias={categorias} />

      <h1 className="text-xl font-black">
        {termo ? `Resultados para "${termo}"` : 'Digite o que voce procura'}
        {termo && resultado.total > 0 ? (
          <span className="ml-2 text-sm font-semibold text-muted">
            {resultado.total.toLocaleString('pt-BR')}{' '}
            {resultado.total === 1 ? 'produto' : 'produtos'}
          </span>
        ) : null}
      </h1>

      {termo && resultado.itens.length === 0 ? (
        <Empty>Nada encontrado. Tente outro nome.</Empty>
      ) : (
        <>
          <GradeProdutos produtos={resultado.itens} />
          <Paginacao
            pagina={pagina}
            total={resultado.total}
            porPagina={POR_PAGINA}
            base={`/busca?q=${encodeURIComponent(termo)}`}
          />
        </>
      )}
    </main>
  )
}
