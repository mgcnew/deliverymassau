import Image from 'next/image'
import Link from 'next/link'

import { BotaoAdicionar } from '@/components/carrinho/botao-adicionar'
import { moeda, precoPorUnidade } from '@/lib/format'
import { urlImagemProduto } from '@/lib/supabase/storage'
import { emPromocao, type ProdutoVitrine } from '@/lib/loja/catalogo'

export function ProdutoCard({ produto }: { produto: ProdutoVitrine }) {
  const imagem = urlImagemProduto(produto.image_path)
  const indisponivel = !produto.is_available
  const oferta = emPromocao(produto)

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <Link href={`/p/${produto.slug}`} className={indisponivel ? 'opacity-60' : ''}>
        <div className="relative aspect-square bg-foreground/[0.04]">
          {imagem ? (
            <Image
              src={imagem}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-3xl">🛒</span>
          )}
          {indisponivel ? (
            <span className="absolute left-2 top-2 rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-white">
              Acabou
            </span>
          ) : oferta ? (
            <span className="absolute left-2 top-2 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-foreground">
              Oferta
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-0.5 p-3 pb-2">
          <p className="line-clamp-2 font-semibold leading-tight">{produto.name}</p>
          {produto.short_description ? (
            <p className="line-clamp-1 text-sm text-muted">{produto.short_description}</p>
          ) : null}
          <p className="pt-1">
            {oferta ? (
              <span className="mr-1.5 text-sm text-muted line-through">
                {moeda(Number(produto.original_price))}
              </span>
            ) : null}
            <span className="font-black text-brand">
              {precoPorUnidade(Number(produto.price), produto.sold_by_weight, produto.unit_type)}
            </span>
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
