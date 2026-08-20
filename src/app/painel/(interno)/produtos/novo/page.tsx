import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { ProdutoForm } from '../produto-form'

export const metadata = { title: 'Novo produto | Mercado Massa 24h' }

export default async function NovoProdutoPage() {
  await requirePermission(PERMISSIONS.produtosCriar)
  const supabase = await createClient()

  const { data: categorias } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-black">Novo produto</h1>
      <Card>
        <ProdutoForm
          categorias={categorias ?? []}
          somenteLeitura={false}
          valores={{
            name: '',
            category_id: categorias?.[0]?.id ?? '',
            short_description: '',
            unit_type: 'unidade',
            sold_by_weight: false,
            price: '',
            original_price: '',
            weight_step_g: 100,
            min_weight_g: 100,
            sort_order: 0,
            imagemUrl: null,
            barcode: '',
          }}
        />
      </Card>
    </div>
  )
}
