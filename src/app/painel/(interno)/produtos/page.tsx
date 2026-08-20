import Image from 'next/image'
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

const POR_PAGINA = 30

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
  const pagina = Math.max(1, Number(params.p) || 1)

  const supabase = await createClient()

  // Sem limite aqui, um CSV de algumas centenas de linhas (Fase A) faria a
  // pagina inteira baixar e renderizar tudo de uma vez. Pagina de 30 em 30,
  // com contagem total pra mostrar "pagina X de Y" e habilitar/desabilitar
  // os botoes de navegar.
  let query = supabase
    .from('products')
    .select('id, name, price, unit_type, sold_by_weight, is_active, is_available, image_path, category_id', {
      count: 'exact',
    })
    .order('sort_order')
    .order('name')
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

  if (filtro === 'disponiveis') query = query.eq('is_available', true).eq('is_active', true)
  if (filtro === 'indisponiveis') query = query.eq('is_available', false)
  if (busca) query = query.ilike('name', `%${busca}%`)
  if (categoria) query = query.eq('category_id', categoria)

  const [{ data: produtos, count: total }, { data: categorias }] = await Promise.all([
    query,
    supabase.from('categories').select('id, name').order('sort_order'),
  ])

  const totalPaginas = Math.max(1, Math.ceil((total ?? 0) / POR_PAGINA))

  const nomeCategoria = new Map((categorias ?? []).map((c) => [c.id, c.name]))
  const link = (patch: Record<string, string>) => {
    const sp = new URLSearchParams({
      f: filtro,
      ...(busca ? { q: busca } : {}),
      ...(categoria ? { c: categoria } : {}),
      ...patch,
    })
    return `/painel/produtos?${sp.toString()}`
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Produtos</h1>
        <div className="flex gap-2">
          <ButtonLink href="/painel/categorias" variant="secondary">
            Categorias
          </ButtonLink>
          {staff.permissions.has(PERMISSIONS.produtosCriar) ? (
            <>
              <ButtonLink href="/painel/produtos/importar" variant="secondary">
                Importar
              </ButtonLink>
              <ButtonLink href="/painel/produtos/novo">Novo</ButtonLink>
            </>
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
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base"
        />
        <button className="h-12 shrink-0 rounded-xl border border-line bg-surface px-4 font-semibold">
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={link({ f: f.valor, p: '1' })}
            className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-bold ${
              filtro === f.valor ? 'bg-brand text-brand-foreground' : 'bg-surface border border-line'
            }`}
          >
            {f.label}
          </Link>
        ))}
        <Link
          href={link({ c: '', p: '1' })}
          className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-bold ${
            categoria ? 'bg-surface border border-line' : 'bg-foreground/10'
          }`}
        >
          Todas as categorias
        </Link>
        {(categorias ?? []).map((c) => (
          <Link
            key={c.id}
            href={link({ c: c.id, p: '1' })}
            className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-bold ${
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
                    <Image
                      src={img}
                      alt=""
                      width={56}
                      height={56}
                      className="size-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="size-14 shrink-0 rounded-xl bg-foreground/5" />
                  )}

                  <Link href={`/painel/produtos/${p.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {p.name}
                      {!p.is_active ? (
                        <span className="ml-2 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-bold">
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

      {totalPaginas > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Link
            href={link({ p: String(pagina - 1) })}
            aria-disabled={pagina <= 1}
            className={`flex h-11 items-center rounded-xl border border-line bg-surface px-4 font-semibold ${
              pagina <= 1 ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            Anterior
          </Link>
          <p className="text-sm text-muted">
            Pagina {pagina} de {totalPaginas} - {total} {total === 1 ? 'produto' : 'produtos'}
          </p>
          <Link
            href={link({ p: String(pagina + 1) })}
            aria-disabled={pagina >= totalPaginas}
            className={`flex h-11 items-center rounded-xl border border-line bg-surface px-4 font-semibold ${
              pagina >= totalPaginas ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            Proxima
          </Link>
        </div>
      ) : null}

      <p className="text-sm text-muted">
        <strong>Acabou</strong> tira o produto do carrinho na hora, sem apagar o cadastro.
        <strong> Inativo</strong> some do catalogo por completo.
      </p>
    </div>
  )
}
