import Link from 'next/link'

import { BotaoAdicionar } from '@/components/carrinho/botao-adicionar'
import { precoPorUnidade } from '@/lib/format'
import { urlImagemProduto } from '@/lib/supabase/storage'
import type { ProdutoVitrine } from '@/lib/loja/catalogo'

export function ProdutoCard({ produto }: { produto: ProdutoVitrine }) {
  const imagem = urlImagemProduto(produto.image_path)
  const indisponivel = !produto.is_available

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <Link href={`/p/${produto.slug}`} className={indisponivel ? 'opacity-60' : ''}>
        <div className="relative aspect-square bg-black/[0.04]">
          {imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagem} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-3xl">🛒</span>
          )}
          {indisponivel ? (
            <span className="absolute left-2 top-2 rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-white">
              Acabou
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-0.5 p-3 pb-2">
          <p className="line-clamp-2 font-semibold leading-tight">{produto.name}</p>
          {produto.short_description ? (
            <p className="line-clamp-1 text-sm text-muted">{produto.short_description}</p>
          ) : null}
          <p className="pt-1 font-black text-brand">
            {precoPorUnidade(Number(produto.price), produto.sold_by_weight, produto.unit_type)}
          </p>
        </div>
      </Link>

      <div className="mt-auto p-3 pt-0">
        <BotaoAdicionar produto={produto} />
      </div>
    </article>
  )
}

export function GradeProdutos({ produtos }: { produtos: ProdutoVitrine[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {produtos.map((p) => (
        <ProdutoCard key={p.id} produto={p} />
      ))}
    </div>
  )
}
