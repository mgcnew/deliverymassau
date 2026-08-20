import { CampoBusca } from '@/components/loja/busca'
import { CategoriasChips } from '@/components/loja/categorias-chips'
import { GradeProdutos } from '@/components/loja/produto-card'
import { RolarParaHash } from '@/components/loja/rolar-para-hash'
import { Empty } from '@/components/ui/card'
import { moeda } from '@/lib/format'
import { getBairrosAtendidos, getCategorias, getProdutos } from '@/lib/loja/catalogo'

export default async function VitrinePage() {
  const [categorias, produtos, bairros] = await Promise.all([
    getCategorias(),
    getProdutos(),
    getBairrosAtendidos(),
  ])

  const porCategoria = categorias
    .map((c) => ({ categoria: c, itens: produtos.filter((p) => p.category_id === c.id) }))
    .filter((grupo) => grupo.itens.length > 0)

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <RolarParaHash />
      <CampoBusca />
      <CategoriasChips categorias={categorias} />

      {porCategoria.length === 0 ? (
        <Empty>Ainda nao ha produtos no catalogo.</Empty>
      ) : (
        porCategoria.map(({ categoria, itens }) => (
          <section key={categoria.id} id={`cat-${categoria.slug}`} className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-black">{categoria.name}</h2>
            <GradeProdutos produtos={itens} />
          </section>
        ))
      )}

      {bairros.length > 0 ? (
        <section className="space-y-2 pt-2">
          <h2 className="text-lg font-black">Onde entregamos</h2>
          <ul className="flex flex-wrap gap-2">
            {bairros.map((b) => (
              <li
                key={b.bairro}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm"
              >
                <span className="font-semibold">{b.bairro}</span>
                <span className="text-muted"> - {moeda(b.taxa)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
