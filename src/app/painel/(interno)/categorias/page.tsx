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

  const [{ data: categorias }, { data: produtos }] = await Promise.all([
    supabase.from('categories').select('id, name, is_active, sort_order').order('sort_order').order('name'),
    supabase.from('products').select('category_id'),
  ])

  const contagem = new Map<string, number>()
  for (const p of produtos ?? []) {
    contagem.set(p.category_id, (contagem.get(p.category_id) ?? 0) + 1)
  }

  const lista = categorias ?? []

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
