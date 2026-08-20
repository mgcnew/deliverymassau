import Image from 'next/image'
import { notFound } from 'next/navigation'

import { LinkVoltar } from '@/components/ui/link-voltar'

import { BotaoAdicionar } from '@/components/carrinho/botao-adicionar'
import { Card } from '@/components/ui/card'
import { moeda, precoPorUnidade, UNIT_LABEL } from '@/lib/format'
import { getCategorias, getProdutoPorSlug } from '@/lib/loja/catalogo'
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

  const categorias = await getCategorias()
  const categoria = categorias.find((c) => c.id === produto.category_id)
  const imagem = urlImagemProduto(produto.image_path)
  const preco = Number(produto.price)
  const pesoMinimo = Number(produto.min_weight ?? 0.1)

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <LinkVoltar href={categoria ? `/c/${categoria.slug}` : '/loja'}>
        {categoria?.name ?? 'Voltar'}
      </LinkVoltar>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-black/[0.04]">
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

          <p className="text-3xl font-black text-brand">
            {precoPorUnidade(preco, produto.sold_by_weight, produto.unit_type)}
          </p>

          {produto.is_available ? (
            <p className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-900">
              Disponivel agora
            </p>
          ) : (
            <p className="inline-block rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-900">
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
        <Card className="space-y-1 bg-amber-50">
          <p className="font-bold">Como funciona a venda por peso</p>
          <p className="text-sm">
            Voce escolhe o peso aproximado e nos usamos ele para estimar o valor. Na separacao a
            peca vai para a balanca e o valor final e recalculado pelo peso real. Exemplo: 1,000 kg
            pedido, 1,087 kg separado a {moeda(preco)}/kg fica {moeda(Math.round(1.087 * preco * 100) / 100)}.
          </p>
        </Card>
      ) : null}
    </main>
  )
}
