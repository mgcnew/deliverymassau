import Link from 'next/link'

import { BotaoAdicionar } from '@/components/carrinho/botao-adicionar'
import { FotoProduto } from '@/components/loja/foto-produto'
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
        {/*
          4/3 e nao quadrada: a foto continua reconhecivel de relance, mas o
          card encolhe ~15% de altura e cabe mais produto na tela - que e o
          que importa num mercado com centenas de itens. A pagina do produto
          (/p/[slug]) segue com a imagem quadrada, grande, para decidir a compra.
        */}
        <div className="relative aspect-[4/3] overflow-hidden bg-foreground/[0.04]">
          {imagem ? (
            <FotoProduto
              src={imagem}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
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

        <div className="flex flex-col gap-0.5 p-2.5 pb-1.5">
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
            <span className="font-black text-brand-ink">
              {precoPorUnidade(Number(produto.price), produto.sold_by_weight, produto.unit_type)}
            </span>
          </p>
        </div>
      </Link>

      <div className="mt-auto p-2.5 pt-0">
        <BotaoAdicionar produto={produto} />
      </div>
    </article>
  )
}

export function GradeProdutos({ produtos }: { produtos: ProdutoVitrine[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {produtos.map((p) => (
        <ProdutoCard key={p.id} produto={p} />
      ))}
    </div>
  )
}
