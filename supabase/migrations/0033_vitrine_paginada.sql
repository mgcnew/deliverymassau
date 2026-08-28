-- =============================================================================
-- 0033 - Vitrine paginada
-- A home listava TODOS os produtos de TODAS as categorias numa pagina so.
-- Com o catalogo de 8 itens isso passava despercebido; com os 5.024 que
-- entraram em 28/08/2026 a home virou 2,3 MB de HTML, 7 segundos de espera e
-- 172 telas de rolagem - e ainda assim so mostrava os primeiros 1.000, o
-- teto do PostgREST. Ou seja: o cliente baixava o catalogo inteiro e mesmo
-- assim nao alcancava a maior parte dos produtos.
--
-- Esta funcao devolve so o comeco de cada categoria, com o total ao lado -
-- e o total e que permite a tela dizer "ver todos os 4.218" e mandar para a
-- pagina da categoria, que pagina de verdade.
--
-- Sem SECURITY DEFINER de proposito: roda com a permissao de quem chamou,
-- entao a RLS de products continua valendo igual ao resto da loja.
-- =============================================================================

create or replace function public.get_showcase(p_por_categoria integer default 12)
returns jsonb
language sql
stable
set search_path = public
as $$
  with ranqueados as (
    select p.id, p.name, p.slug, p.short_description, p.image_path, p.unit_type,
           p.sold_by_weight, p.price, p.original_price, p.is_available, p.category_id,
           p.weight_step, p.min_weight,
           row_number() over (
             partition by p.category_id
             -- Mesma ordem da vitrine antiga: disponivel primeiro, depois a
             -- ordem manual da equipe, depois alfabetica.
             order by p.is_available desc, p.sort_order, p.name
           ) as posicao,
           count(*) over (partition by p.category_id) as total_da_categoria
      from public.products p
     where p.is_active
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id, 'name', name, 'slug', slug, 'short_description', short_description,
        'image_path', image_path, 'unit_type', unit_type, 'sold_by_weight', sold_by_weight,
        'price', price, 'original_price', original_price, 'is_available', is_available,
        'category_id', category_id, 'weight_step', weight_step, 'min_weight', min_weight,
        'total_da_categoria', total_da_categoria
      )
      order by category_id, posicao
    ),
    '[]'::jsonb
  )
  from ranqueados
  where posicao <= greatest(p_por_categoria, 1);
$$;

comment on function public.get_showcase(integer) is
  'Primeiros produtos de cada categoria + total da categoria, para a home da loja.';

revoke all on function public.get_showcase(integer) from public;
grant execute on function public.get_showcase(integer) to anon, authenticated;

-- A pagina de categoria ordena por (is_available desc, sort_order, name) dentro
-- de uma categoria. O indice existente (category_id, is_active, sort_order) nao
-- cobre essa ordenacao; sem isto, cada pagina vira sort de milhares de linhas.
create index if not exists idx_products_vitrine_ordem
  on public.products (category_id, is_available desc, sort_order, name)
  where is_active;
