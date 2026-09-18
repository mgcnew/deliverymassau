import Image from 'next/image'
import Link from 'next/link'

import { BairrosAtendidos, FaixasDeEntrega } from '@/components/loja/bairros-atendidos'
import { CampoBusca } from '@/components/loja/busca'
import { FileiraProdutos } from '@/components/loja/produto-card'
import { Empty } from '@/components/ui/card'
import { modoEfetivo } from '@/lib/entrega/cotar'
import {
  getBairrosAtendidos,
  getCapasCategorias,
  getCategorias,
  getConfiguracaoPublica,
  getMaisPedidos,
  getProdutosEmPromocao,
} from '@/lib/loja/catalogo'
import { IconeCategoria } from '@/lib/loja/icones-categoria'
import { urlImagemProduto } from '@/lib/supabase/storage'

/**
 * Home da loja: uma porta de entrada, nao o catalogo inteiro.
 *
 * Antes eram as 18 categorias empilhadas com 12 produtos cada - 38 telas de
 * rolagem no celular - e as pilulas so rolavam a pagina ate a secao. Agora,
 * como nos apps de mercado: busca, as categorias todas a vista (cada uma
 * abre a sua pagina) e duas fileiras curtas com o que vale olhar primeiro.
 */

/** Mais pedidos so aparece com amostra que valha: com 2 itens parece vazio. */
const MINIMO_MAIS_PEDIDOS = 4

export default async function VitrinePage() {
  const [categorias, capas, maisPedidos, ofertas, bairros, config] = await Promise.all([
    getCategorias(),
    getCapasCategorias(),
    getMaisPedidos(12),
    getProdutosEmPromocao({ limite: 12 }),
    getBairrosAtendidos(),
    getConfiguracaoPublica(),
  ])

  // Categoria sem nenhum produto ativo nao entra: seria uma porta para o vazio.
  const comProdutos = categorias.filter((c) => (capas.get(c.id)?.total ?? 0) > 0)

  return (
    <main className="mx-auto w-full max-w-5xl space-y-7 p-4">
      <CampoBusca />

      {/*
        Oferta antes de categoria, de proposito: categoria e navegacao, oferta
        e mercadoria. Quem chega pelo link do WhatsApp esta a um passo da
        compra, e enterrar a promocao embaixo de sete cards de corredor
        desperdica justamente o que tem mais chance de virar pedido. O card
        ja traz o botao de adicionar, entao da para comprar sem abrir o
        produto.

        A fileira e de rolagem lateral, nao um carrossel que gira sozinho:
        slide que se move troca o alvo do dedo na hora do toque, e quase
        ninguem chega ao segundo.

        Sem oferta cadastrada a secao inteira some - nao fica titulo orfao no
        topo da loja.
      */}
      {ofertas.length > 0 ? (
        <FileiraProdutos id="titulo-ofertas" titulo="Ofertas" produtos={ofertas} />
      ) : null}

      {comProdutos.length === 0 ? (
        <Empty>Ainda nao ha produtos no catalogo.</Empty>
      ) : (
        <section aria-labelledby="titulo-categorias" className="space-y-3">
          <h2 id="titulo-categorias" className="text-xl font-black">
            Categorias
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {comProdutos.map((c) => {
              const capa = capas.get(c.id)
              const imagem = urlImagemProduto(capa?.imagem ?? null)
              const total = capa?.total ?? 0
              return (
                <li key={c.id}>
                  <Link
                    href={`/c/${c.slug}`}
                    className="flex h-full items-center gap-2 rounded-2xl border border-line bg-surface p-2 hover:border-foreground/30"
                  >
                    {/* Foto de um produto de verdade da categoria (o mais
                        pedido que tem foto): reconhece-se o corredor pelo que
                        tem nele, nao por um desenho generico. */}
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-white">
                      {imagem ? (
                        <Image src={imagem} alt="" fill sizes="48px" className="object-contain p-1" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-muted">
                          <IconeCategoria slug={c.slug} size={26} strokeWidth={1.75} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-3 hyphens-auto break-words text-sm font-bold leading-tight">{c.name}</span>
                      <span className="block text-xs text-muted">
                        {total.toLocaleString('pt-BR')} {total === 1 ? 'produto' : 'produtos'}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {maisPedidos.length >= MINIMO_MAIS_PEDIDOS ? (
        <FileiraProdutos id="titulo-mais-pedidos" titulo="Mais pedidos no bairro" produtos={maisPedidos} />
      ) : null}

      {modoEfetivo(config?.delivery_fee_mode) === 'distancia' ? (
        <FaixasDeEntrega faixas={(config?.delivery_bands ?? []).map((f) => ({ up_to_km: Number(f.up_to_km), fee: Number(f.fee) }))} />
      ) : (
        <BairrosAtendidos bairros={bairros} />
      )}
    </main>
  )
}
