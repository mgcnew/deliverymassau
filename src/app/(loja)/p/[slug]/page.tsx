import Image from 'next/image'
import { notFound } from 'next/navigation'

import { LinkVoltar } from '@/components/ui/link-voltar'

import { BotaoAdicionar } from '@/components/carrinho/botao-adicionar'
import { GradeProdutos } from '@/components/loja/produto-card'
import { Card } from '@/components/ui/card'
import { moeda, precoPorUnidade, UNIT_LABEL } from '@/lib/format'
import {
  emPromocao,
  getCategorias,
  getProdutoPorSlug,
  getProdutos,
  getProdutosEmPromocao,
} from '@/lib/loja/catalogo'
import { urlImagemProduto } from '@/lib/supabase/storage'

export async function generateMetadata({ params }: PageProps<'/p/[slug]'>) {
  const { slug } = await params
  const produto = await getProdutoPorSlug(slug)
  return { title: produto ? `${produto.name} | Mercado Massa 24h` : 'Mercado Massa 24h' }
}

export default async function ProdutoPage({ params }: PageProps<'/p/[slug]'>) {
  const { slug } = await params
  const produto = await getProdutoPorSlug(slug)
  if (!produto) notFound()

  const [categorias, produtosPromocao, produtosCategoria] = await Promise.all([
    getCategorias(),
    getProdutosEmPromocao({ excluirId: produto.id, limite: 6 }),
    getProdutos({ categoriaId: produto.category_id, limite: 10 }),
  ])
  const categoria = categorias.find((c) => c.id === produto.category_id)
  const imagem = urlImagemProduto(produto.image_path)
  const preco = Number(produto.price)
  const pesoMinimo = Number(produto.min_weight ?? 0.1)
  const oferta = emPromocao(produto)

  // "Voce tambem pode gostar": produtos em promocao primeiro, depois o
  // resto da mesma categoria -- sem repetir o proprio produto nem os que
  // ja entraram pela promocao.
  const sugestoes = [
    ...produtosPromocao,
    ...produtosCategoria.filter(
      (p) => p.id !== produto.id && p.is_available && !produtosPromocao.some((pp) => pp.id === p.id),
    ),
  ].slice(0, 8)

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <LinkVoltar href={categoria ? `/c/${categoria.slug}` : '/loja'}>
        {categoria?.name ?? 'Voltar'}
      </LinkVoltar>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-foreground/[0.04]">
          {imagem ? (
            <Image
              src={imagem}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              priority
              className="object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-5xl">🛒</span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-black leading-tight">{produto.name}</h1>
            {produto.short_description ? (
              <p className="text-muted">{produto.short_description}</p>
            ) : null}
          </div>

          {oferta ? (
            <p className="flex items-center gap-2">
              <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-foreground">
                Oferta
              </span>
              <span className="text-lg text-muted line-through">
                {moeda(Number(produto.original_price))}
              </span>
            </p>
          ) : null}
          <p className="text-3xl font-black text-brand">
            {precoPorUnidade(preco, produto.sold_by_weight, produto.unit_type)}
          </p>

          {produto.is_available ? (
            <p className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200">
              Disponivel agora
            </p>
          ) : (
            <p className="inline-block rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-900 dark:bg-rose-900/50 dark:text-rose-200">
              Acabou por enquanto
            </p>
          )}

          <p className="text-sm text-muted">
            Vendido por {UNIT_LABEL[produto.unit_type]}
            {produto.sold_by_weight ? ` - pedido minimo de ${(pesoMinimo * 1000).toFixed(0)} g` : ''}.
          </p>

          <BotaoAdicionar produto={produto} tamanho="lg" />
        </div>
      </div>

      {produto.sold_by_weight ? (
        <Card className="space-y-1 bg-amber-50 dark:bg-amber-900/20">
          <p className="font-bold">Como funciona a venda por peso</p>
          <p className="text-sm">
            Voce escolhe o peso aproximado e nos usamos ele para estimar o valor. Na separacao a
            peca vai para a balanca e o valor final e recalculado pelo peso real. Exemplo: 1,000 kg
            pedido, 1,087 kg separado a {moeda(preco)}/kg fica {moeda(Math.round(1.087 * preco * 100) / 100)}.
          </p>
        </Card>
      ) : null}

      {sugestoes.length > 0 ? (
        <section className="space-y-3 pt-2">
          <h2 className="text-xl font-black">Voce tambem pode gostar</h2>
          <GradeProdutos produtos={sugestoes} />
        </section>
      ) : null}
    </main>
  )
}
