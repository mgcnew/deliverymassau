-- =============================================================================
-- 0043 - Mais pedidos primeiro
-- A vitrine e as paginas de categoria ordenavam por sort_order e nome - que
-- ninguem preenche para 5 mil produtos, entao na pratica era alfabetica:
-- Bebidas abria com "51 ICE", Limpeza com uma fileira de agua sanitaria. Os
-- primeiros itens de cada categoria sao os unicos que a maioria ve.
--
-- Agora o que o bairro mais pede vem na frente:
-- - product_popularity guarda so a POSICAO de cada produto no ranking de
--   pedidos dos ultimos 90 dias (nao a contagem - a vitrine ja revela a
--   ordem, os numeros de venda ficam so no painel). Mora fora de products
--   de proposito: products tem auditoria, e cada pedido reescrevendo
--   posicoes encheria o log.
-- - O ranking e refeito quando entra item de pedido, sai item (edicao) ou um
--   pedido e cancelado. So as linhas que mudaram sao gravadas.
-- - Produto sem venda fica depois, na ordem de antes (sort_order, nome).
-- =============================================================================

create table if not exists public.product_popularity (
  product_id uuid primary key references public.products (id) on delete cascade,
  posicao integer not null
);

comment on table public.product_popularity is
  'Posicao de cada produto no ranking de pedidos dos ultimos 90 dias (1 = mais pedido).';

alter table public.product_popularity enable row level security;

-- Leitura livre (a loja ordena por ela); escrita so pela funcao abaixo.
drop policy if exists product_popularity_select on public.product_popularity;
create policy product_popularity_select on public.product_popularity
  for select to anon, authenticated using (true);

create or replace function public.recalcular_popularidade()
returns void
language sql
security definer
set search_path = public
as $$
  with contagem as (
    select i.product_id, count(distinct i.order_id) as pedidos
      from public.order_items i
      join public.orders o on o.id = i.order_id
     where o.created_at > now() - interval '90 days'
       and o.status <> 'cancelado'
       and i.product_id is not null
     group by i.product_id
  ),
  ranking as (
    select product_id, row_number() over (order by pedidos desc, product_id)::integer as posicao
      from contagem
  ),
  saiu as (
    delete from public.product_popularity pp
     where not exists (select 1 from ranking r where r.product_id = pp.product_id)
  )
  insert into public.product_popularity (product_id, posicao)
  select product_id, posicao from ranking
  on conflict (product_id) do update
     set posicao = excluded.posicao
   where public.product_popularity.posicao is distinct from excluded.posicao;
$$;

revoke all on function public.recalcular_popularidade() from public, anon, authenticated;

create or replace function public.trg_recalcular_popularidade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalcular_popularidade();
  return null;
end;
$$;

revoke all on function public.trg_recalcular_popularidade() from public, anon, authenticated;

-- Por comando, nao por linha: um pedido com 30 itens refaz o ranking uma vez.
drop trigger if exists trg_order_items_popularidade on public.order_items;
create trigger trg_order_items_popularidade
  after insert or delete on public.order_items
  for each statement execute function public.trg_recalcular_popularidade();

drop trigger if exists trg_orders_popularidade on public.orders;
create trigger trg_orders_popularidade
  after update of status on public.orders
  for each row
  when (new.status = 'cancelado' and old.status is distinct from new.status)
  execute function public.trg_recalcular_popularidade();

-- Pagina de uma categoria: disponivel primeiro, depois os mais pedidos,
-- depois a ordem de antes. Sem SECURITY DEFINER: a RLS de products vale
-- igual ao resto da loja.
create or replace function public.get_categoria_pagina(
  p_categoria uuid,
  p_limite integer default 48,
  p_offset integer default 0
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'total', (
      select count(*) from public.products
       where category_id = p_categoria and is_active
    ),
    'itens', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', x.id, 'name', x.name, 'slug', x.slug, 'short_description', x.short_description,
                 'image_path', x.image_path, 'unit_type', x.unit_type, 'sold_by_weight', x.sold_by_weight,
                 'price', x.price, 'original_price', x.original_price, 'is_available', x.is_available,
                 'category_id', x.category_id, 'weight_step', x.weight_step, 'min_weight', x.min_weight
               )
               order by x.ordem
             )
        from (
          select p.*,
                 row_number() over (
                   order by p.is_available desc, pp.posicao nulls last, p.sort_order, p.name
                 ) as ordem
            from public.products p
            left join public.product_popularity pp on pp.product_id = p.id
           where p.category_id = p_categoria and p.is_active
           order by ordem
           limit greatest(p_limite, 1)
          offset greatest(p_offset, 0)
        ) x
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_categoria_pagina(uuid, integer, integer) from public;
grant execute on function public.get_categoria_pagina(uuid, integer, integer) to anon, authenticated;

-- Capa de cada categoria na home: a foto do produto com foto mais pedido
-- (ou, sem vendas, o primeiro com foto na ordem da categoria).
create or replace function public.get_capas_categorias()
returns table (category_id uuid, image_path text, total bigint)
language sql
stable
set search_path = public
as $$
  select distinct on (p.category_id)
         p.category_id,
         p.image_path,
         count(*) over (partition by p.category_id) as total
    from public.products p
    left join public.product_popularity pp on pp.product_id = p.id
   where p.is_active
   order by p.category_id,
            (p.image_path is null),
            p.is_available desc,
            pp.posicao nulls last,
            p.sort_order,
            p.name;
$$;

revoke all on function public.get_capas_categorias() from public;
grant execute on function public.get_capas_categorias() to anon, authenticated;

select public.recalcular_popularidade();
