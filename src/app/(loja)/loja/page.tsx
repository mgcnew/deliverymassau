import Link from 'next/link'

import { BairrosAtendidos, FaixasDeEntrega } from '@/components/loja/bairros-atendidos'
import { CampoBusca } from '@/components/loja/busca'
import { CategoriasChips } from '@/components/loja/categorias-chips'
import { GradeProdutos } from '@/components/loja/produto-card'
import { RolarParaHash } from '@/components/loja/rolar-para-hash'
import { Empty } from '@/components/ui/card'
import { modoEfetivo } from '@/lib/entrega/cotar'
import {
  getBairrosAtendidos,
  getCategorias,
  getConfiguracaoPublica,
  getProdutosEmPromocao,
  getVitrine,
} from '@/lib/loja/catalogo'

/**
 * Quantos produtos cada categoria mostra na home antes do "ver todos".
 * Doze = duas linhas no computador, seis no celular: da pra sentir o que a
 * categoria tem sem transformar a home num catalogo inteiro.
 */
const POR_CATEGORIA = 12

export default async function VitrinePage() {
  const [categorias, vitrine, ofertas, bairros, config] = await Promise.all([
    getCategorias(),
    getVitrine(POR_CATEGORIA),
    getProdutosEmPromocao({ limite: POR_CATEGORIA }),
    getBairrosAtendidos(),
    getConfiguracaoPublica(),
  ])

  const secoes = categorias
    .map((categoria) => ({ categoria, grupo: vitrine.get(categoria.id) }))
    .filter((s): s is { categoria: (typeof categorias)[number]; grupo: NonNullable<typeof s.grupo> } =>
      Boolean(s.grupo?.itens.length),
    )

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <RolarParaHash />
      <CampoBusca />
      <CategoriasChips categorias={categorias} />

      {ofertas.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-black text-brand-ink">🔥 Ofertas</h2>
          <GradeProdutos produtos={ofertas} />
        </section>
      ) : null}

      {secoes.length === 0 ? (
        <Empty>Ainda nao ha produtos no catalogo.</Empty>
      ) : (
        secoes.map(({ categoria, grupo }) => (
          <section key={categoria.id} id={`cat-${categoria.slug}`} className="scroll-mt-24 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-black">{categoria.name}</h2>
              {grupo.total > grupo.itens.length ? (
                <span className="text-sm text-muted">
                  {grupo.total.toLocaleString('pt-BR')} produtos
                </span>
              ) : null}
            </div>

            <GradeProdutos produtos={grupo.itens} />

            {/* So aparece quando ha mais do que cabe aqui - senao viraria um
                botao que leva a mesma lista que a pessoa acabou de ver. */}
            {grupo.total > grupo.itens.length ? (
              <Link
                href={`/c/${categoria.slug}`}
                className="flex h-12 items-center justify-center rounded-xl border border-line bg-surface font-bold"
              >
                Ver todos os {grupo.total.toLocaleString('pt-BR')} de {categoria.name}
              </Link>
            ) : null}
          </section>
        ))
      )}

      {modoEfetivo(config?.delivery_fee_mode) === 'distancia' ? (
        <FaixasDeEntrega faixas={(config?.delivery_bands ?? []).map((f) => ({ up_to_km: Number(f.up_to_km), fee: Number(f.fee) }))} />
      ) : (
        <BairrosAtendidos bairros={bairros} />
      )}
    </main>
  )
}
