import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardTitle, Empty } from '@/components/ui/card'
import { LinhaCategoria } from './linha-categoria'
import { NovaCategoria } from './nova-categoria'

export const metadata = { title: 'Categorias | Mercado Massa 24h' }

export default async function CategoriasPage() {
  const staff = await requirePermission(PERMISSIONS.produtosVer)
  const podeGerenciar = staff.permissions.has(PERMISSIONS.categoriasGerenciar)
  const supabase = await createClient()

  // A contagem vem do banco agregada, e nao de baixar products para contar
  // aqui: sao 5 mil linhas, o PostgREST corta a resposta num teto e a soma
  // sairia menor que a verdade. Aqui isso importa mais que em outras telas -
  // e este numero que decide se a categoria pode ser excluida.
  const { data: categorias } = await supabase
    .from('categories')
    .select('id, name, is_active, sort_order, products(count)')
    .order('sort_order')
    .order('name')

  const lista = (categorias ?? []) as Array<{
    id: string
    name: string
    is_active: boolean
    sort_order: number
    products: Array<{ count: number }> | null
  }>
  const contagem = new Map(lista.map((c) => [c.id, c.products?.[0]?.count ?? 0]))

  return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-black">Categorias</h1>

      {podeGerenciar ? (
        <Card>
          <CardTitle>Nova categoria</CardTitle>
          <NovaCategoria />
        </Card>
      ) : null}

      <Card>
        <CardTitle>{lista.length} categorias</CardTitle>
        {lista.length === 0 ? (
          <Empty>Nenhuma categoria cadastrada.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {lista.map((c, i) => (
              <LinhaCategoria
                key={c.id}
                id={c.id}
                nome={c.name}
                ativa={c.is_active}
                produtos={contagem.get(c.id) ?? 0}
                primeira={i === 0}
                ultima={i === lista.length - 1}
                podeGerenciar={podeGerenciar}
              />
            ))}
          </ul>
        )}
      </Card>

      <p className="text-sm text-muted">
        Categoria desativada some do portal do cliente, mas os produtos continuam cadastrados.
      </p>
    </div>
  )
}
