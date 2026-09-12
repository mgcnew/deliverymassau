import Link from 'next/link'

import { BotaoAdicionarCompacto } from '@/components/carrinho/botao-adicionar'
import { FotoProduto } from '@/components/loja/foto-produto'
import { RolagemHorizontal } from '@/components/ui/rolagem-horizontal'
import { moeda, nomeLegivel, precoPorUnidade } from '@/lib/format'
import { urlImagemProduto } from '@/lib/supabase/storage'
import { emPromocao, getCategorias, type ProdutoVitrine } from '@/lib/loja/catalogo'
import { IconeCategoria } from '@/lib/loja/icones-categoria'

export function ProdutoCard({
  produto,
  categoriaSlug,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw',
}: {
  produto: ProdutoVitrine
  categoriaSlug?: string
  sizes?: string
}) {
  const imagem = urlImagemProduto(produto.image_path)
  const indisponivel = !produto.is_available
  const oferta = emPromocao(produto)
  const nome = nomeLegivel(produto.name)

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      {/*
        4/3 e nao quadrada: a foto continua reconhecivel de relance, mas o
        card encolhe e cabe mais produto na tela - que e o que importa num
        mercado com milhares de itens. A pagina do produto (/p/[slug]) segue
        com a imagem quadrada, grande, para decidir a compra.
      */}
      <div className="relative aspect-[4/3] overflow-hidden bg-foto">
        {/* A foto tambem abre o produto, mas fora da ordem do teclado: o link
            do nome logo abaixo ja leva ao mesmo lugar. */}
        <Link
          href={`/p/${produto.slug}`}
          tabIndex={-1}
          aria-hidden
          className={`absolute inset-0 ${indisponivel ? 'opacity-60' : ''}`}
        >
          {imagem ? (
            <FotoProduto src={imagem} sizes={sizes} />
          ) : (
            <span className="flex size-full items-center justify-center text-foto-ink/35">
              <IconeCategoria slug={categoriaSlug} size={36} strokeWidth={1.5} />
            </span>
          )}
        </Link>

        {indisponivel ? (
          <span className="absolute left-2 top-2 rounded-full bg-foto-ink px-2.5 py-1 text-xs font-bold text-foto">
            Acabou
          </span>
        ) : oferta ? (
          <span className="absolute left-2 top-2 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-foreground">
            Oferta
          </span>
        ) : null}

        <div className="absolute inset-x-2 bottom-2 flex justify-end">
          <BotaoAdicionarCompacto produto={produto} />
        </div>
      </div>

      <Link
        href={`/p/${produto.slug}`}
        className={`flex flex-1 flex-col gap-0.5 p-2.5 ${indisponivel ? 'opacity-60' : ''}`}
      >
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{nome}</p>
        {produto.short_description ? (
          <p className="line-clamp-1 text-xs text-muted">{produto.short_description}</p>
        ) : null}
        <p className="mt-auto pt-1 leading-tight">
          {oferta ? (
            <span className="mr-1.5 text-xs text-muted line-through">
              {moeda(Number(produto.original_price))}
            </span>
          ) : null}
          <span className="font-black text-brand-ink">
            {precoPorUnidade(Number(produto.price), produto.sold_by_weight, produto.unit_type)}
          </span>
        </p>
      </Link>
    </article>
  )
}

/** Slug da categoria de cada produto, para o icone de quem nao tem foto. */
async function slugsPorCategoria() {
  const categorias = await getCategorias()
  return new Map(categorias.map((c) => [c.id, c.slug]))
}

export async function GradeProdutos({ produtos }: { produtos: ProdutoVitrine[] }) {
  const slugs = await slugsPorCategoria()
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {produtos.map((p) => (
        <ProdutoCard key={p.id} produto={p} categoriaSlug={slugs.get(p.category_id)} />
      ))}
    </div>
  )
}

/**
 * Fileira que desliza para o lado (Ofertas, Mais pedidos): mostra uma
 * amostra sem empurrar o resto da pagina para baixo. O pedaco do proximo
 * cartao aparecendo na borda e o convite para arrastar.
 */
export async function FileiraProdutos({
  id,
  titulo,
  produtos,
}: {
  id: string
  titulo: string
  produtos: ProdutoVitrine[]
}) {
  const slugs = await slugsPorCategoria()
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-xl font-black">
        {titulo}
      </h2>
      <RolagemHorizontal className="snap-x snap-mandatory scroll-px-4">
        <ul className="flex w-max gap-3 pb-1">
          {produtos.map((p) => (
            <li key={p.id} className="w-[40vw] max-w-48 shrink-0 snap-start sm:w-44">
              <ProdutoCard produto={p} categoriaSlug={slugs.get(p.category_id)} sizes="(max-width: 640px) 40vw, 192px" />
            </li>
          ))}
        </ul>
      </RolagemHorizontal>
    </section>
  )
}
