import Link from 'next/link'

import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ButtonLink } from '@/components/ui/button'
import { Card, Empty } from '@/components/ui/card'
import { precoPorUnidade } from '@/lib/format'
import { urlImagemProduto } from '@/lib/supabase/storage'
import type { UnitType } from '@/lib/types'
import { BotaoDisponibilidade } from './disponibilidade'

export const metadata = { title: 'Produtos | Mercado Massa 24h' }

const FILTROS = [
  { valor: 'disponiveis', label: 'Disponiveis' },
  { valor: 'indisponiveis', label: 'Indisponiveis' },
  { valor: 'todos', label: 'Todos' },
] as const

export default async function ProdutosPage({ searchParams }: PageProps<'/painel/produtos'>) {
  const staff = await requirePermission(PERMISSIONS.produtosVer)
  const params = await searchParams

  const filtro = typeof params.f === 'string' ? params.f : 'disponiveis'
  const busca = typeof params.q === 'string' ? params.q.trim() : ''
  const categoria = typeof params.c === 'string' ? params.c : ''

  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('id, name, price, unit_type, sold_by_weight, is_active, is_available, image_path, category_id')
    .order('sort_order')
    .order('name')

  if (filtro === 'disponiveis') query = query.eq('is_available', true).eq('is_active', true)
  if (filtro === 'indisponiveis') query = query.eq('is_available', false)
  if (busca) query = query.ilike('name', `%${busca}%`)
  if (categoria) query = query.eq('category_id', categoria)

  const [{ data: produtos }, { data: categorias }] = await Promise.all([
    query,
    supabase.from('categories').select('id, name').order('sort_order'),
  ])

  const nomeCategoria = new Map((categorias ?? []).map((c) => [c.id, c.name]))
  const link = (patch: Record<string, string>) => {
    const sp = new URLSearchParams({ f: filtro, ...(busca ? { q: busca } : {}), ...(categoria ? { c: categoria } : {}), ...patch })
    return `/painel/produtos?${sp.toString()}`
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Produtos</h1>
        <div className="flex gap-2">
          <ButtonLink href="/painel/categorias" variant="secondary">
            Categorias
          </ButtonLink>
          {staff.permissions.has(PERMISSIONS.produtosCriar) ? (
            <ButtonLink href="/painel/produtos/novo">Novo</ButtonLink>
          ) : null}
        </div>
      </div>

      <form className="flex gap-2 lg:max-w-xl" action="/painel/produtos">
        <input type="hidden" name="f" value={filtro} />
        {categoria ? <input type="hidden" name="c" value={categoria} /> : null}
        <input
          name="q"
          defaultValue={busca}
          placeholder="Buscar produto"
          className="h-12 flex-1 rounded-xl border border-line bg-surface px-3 text-base"
        />
        <button className="h-12 rounded-xl border border-line bg-surface px-4 font-semibold">
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={link({ f: f.valor })}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              filtro === f.valor ? 'bg-brand text-brand-foreground' : 'bg-surface border border-line'
            }`}
          >
            {f.label}
          </Link>
        ))}
        <Link
          href={link({ c: '' })}
          className={`rounded-full px-4 py-2 text-sm font-bold ${
            categoria ? 'bg-surface border border-line' : 'bg-foreground/10'
          }`}
        >
          Todas as categorias
        </Link>
        {(categorias ?? []).map((c) => (
          <Link
            key={c.id}
            href={link({ c: c.id })}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              categoria === c.id ? 'bg-brand text-brand-foreground' : 'bg-surface border border-line'
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <Card>
        {!produtos?.length ? (
          <Empty>Nenhum produto neste filtro.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {produtos.map((p) => {
              const img = urlImagemProduto(p.image_path)
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="size-14 shrink-0 rounded-xl bg-black/5" />
                  )}

                  <Link href={`/painel/produtos/${p.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {p.name}
                      {!p.is_active ? (
                        <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold">
                          inativo
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {precoPorUnidade(Number(p.price), p.sold_by_weight, p.unit_type as UnitType)}
                      {' - '}
                      {nomeCategoria.get(p.category_id) ?? 'sem categoria'}
                    </p>
                  </Link>

                  <BotaoDisponibilidade
                    id={p.id}
                    disponivel={p.is_available}
                    podeAlterar={staff.permissions.has(PERMISSIONS.produtosAlterarDisponibilidade)}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <p className="text-sm text-muted">
        <strong>Acabou</strong> tira o produto do carrinho na hora, sem apagar o cadastro.
        <strong> Inativo</strong> some do catalogo por completo.
      </p>
    </div>
  )
}
