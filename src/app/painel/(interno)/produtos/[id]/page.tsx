import { LinkVoltar } from '@/components/ui/link-voltar'
import { notFound } from 'next/navigation'

import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { urlImagemProduto } from '@/lib/supabase/storage'
import type { UnitType } from '@/lib/types'
import { listaSegura } from '@/lib/produtos/volta'
import { ProdutoForm } from '../produto-form'
import { EstadoProduto } from './estado-produto'

export const metadata = { title: 'Produto | Mercado Massa 24h' }

export default async function ProdutoPage({
  params,
  searchParams,
}: PageProps<'/painel/produtos/[id]'>) {
  const [{ id }, { aba, volta }] = await Promise.all([params, searchParams])
  // A lista de onde a pessoa veio (categoria, pagina...): o voltar e o
  // salvar retornam a ela.
  const lista = listaSegura(volta)
  const staff = await requirePermission(PERMISSIONS.produtosVer)
  const supabase = await createClient()

  const [{ data: produto }, { data: categorias }, { count: vendas }] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).maybeSingle(),
    supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order'),
    // head: so o contador, sem trazer os itens - produto campeao de vendas
    // pode ter centenas de linhas e nenhuma delas e usada aqui.
    supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id),
  ])

  if (!produto) notFound()

  return (
    <div className="w-full space-y-4">
      <div>
        <LinkVoltar href={lista}>Produtos</LinkVoltar>
        <h1 className="text-2xl font-black">{produto.name}</h1>
      </div>

      <Card>
        <ProdutoForm
          categorias={categorias ?? []}
          somenteLeitura={!staff.permissions.has(PERMISSIONS.produtosEditar)}
          volta={lista}
          // Em abas: preco, dados e foto sao do formulario; Estado (ativo,
          // disponivel, excluir) salva na hora e entra como aba extra.
          emAbas={{
            inicial: typeof aba === 'string' ? aba : '',
            extras: [
              {
                id: 'estado',
                rotulo: 'Estado',
                conteudo: (
                  <EstadoProduto
                    id={produto.id}
                    ativo={produto.is_active}
                    disponivel={produto.is_available}
                    sempreTem={produto.always_stocked}
                    podeDesativar={staff.permissions.has(PERMISSIONS.produtosDesativar)}
                    podeAlterarDisponibilidade={staff.permissions.has(
                      PERMISSIONS.produtosAlterarDisponibilidade,
                    )}
                    podeEditar={staff.permissions.has(PERMISSIONS.produtosEditar)}
                    podeExcluir={staff.permissions.has(PERMISSIONS.produtosExcluir)}
                    jaVendeu={(vendas ?? 0) > 0}
                  />
                ),
              },
            ],
          }}
          valores={{
            id: produto.id,
            name: produto.name,
            category_id: produto.category_id,
            short_description: produto.short_description ?? '',
            unit_type: produto.unit_type as UnitType,
            sold_by_weight: produto.sold_by_weight,
            price: Number(produto.price).toFixed(2).replace('.', ','),
            original_price: produto.original_price
              ? Number(produto.original_price).toFixed(2).replace('.', ',')
              : '',
            weight_step_g: Math.round(Number(produto.weight_step ?? 0.1) * 1000),
            min_weight_g: Math.round(Number(produto.min_weight ?? 0.1) * 1000),
            sort_order: produto.sort_order,
            imagemUrl: urlImagemProduto(produto.image_path),
            barcode: produto.barcode ?? '',
          }}
        />
      </Card>
    </div>
  )
}
