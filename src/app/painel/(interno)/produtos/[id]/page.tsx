import { LinkVoltar } from '@/components/ui/link-voltar'
import { notFound } from 'next/navigation'

import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardTitle } from '@/components/ui/card'
import { urlImagemProduto } from '@/lib/supabase/storage'
import type { UnitType } from '@/lib/types'
import { ProdutoForm } from '../produto-form'
import { EstadoProduto } from './estado-produto'

export const metadata = { title: 'Produto | Mercado Massa 24h' }

export default async function ProdutoPage({ params }: PageProps<'/painel/produtos/[id]'>) {
  const { id } = await params
  const staff = await requirePermission(PERMISSIONS.produtosVer)
  const supabase = await createClient()

  const [{ data: produto }, { data: categorias }] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).maybeSingle(),
    supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order'),
  ])

  if (!produto) notFound()

  return (
    <div className="w-full space-y-4">
      <div>
        <LinkVoltar href="/painel/produtos">Produtos</LinkVoltar>
        <h1 className="text-2xl font-black">{produto.name}</h1>
      </div>

      <Card>
        <CardTitle>Estado</CardTitle>
        <EstadoProduto
          id={produto.id}
          ativo={produto.is_active}
          disponivel={produto.is_available}
          podeDesativar={staff.permissions.has(PERMISSIONS.produtosDesativar)}
          podeAlterarDisponibilidade={staff.permissions.has(
            PERMISSIONS.produtosAlterarDisponibilidade,
          )}
        />
      </Card>

      <Card>
        <CardTitle>Cadastro</CardTitle>
        <ProdutoForm
          categorias={categorias ?? []}
          somenteLeitura={!staff.permissions.has(PERMISSIONS.produtosEditar)}
          valores={{
            id: produto.id,
            name: produto.name,
            category_id: produto.category_id,
            short_description: produto.short_description ?? '',
            unit_type: produto.unit_type as UnitType,
            sold_by_weight: produto.sold_by_weight,
            price: Number(produto.price).toFixed(2).replace('.', ','),
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
