-- =============================================================================
-- 0048 - Conferir pelo nome, e nao so pelo codigo de barras
--
-- A conferencia so enxergava produto com codigo (0046), porque o unico jeito
-- de conferir era bipar. Mas 120 produtos ativos nao tem codigo nenhum e
-- nunca terao: pao da padaria, mortadela fatiada, hortifruti, dose de bebida.
-- Sao justamente os que a viragem precisa proteger com "manter os produtos
-- sem codigo de barras" - proteger porque nao havia como conferi-los.
--
-- Com a busca por nome na tela, eles passam a ser conferiveis como qualquer
-- outro. Entao o catalogo local precisa trazer todos, com o codigo podendo
-- vir nulo.
--
-- Cresce pouco: 4.853 -> 4.997 linhas, uns 20 KB a mais no aparelho.
-- =============================================================================

create or replace function public.catalogo_conferencia()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', p.id, 'nome', p.name)
      || case when p.barcode is null or btrim(p.barcode) = ''
              then '{}'::jsonb
              else jsonb_build_object('codigo', p.barcode) end
      || case when p.is_active then '{}'::jsonb else jsonb_build_object('inativo', true) end
      order by p.name
    ),
    '[]'::jsonb
  )
    from public.products p;
$$;

comment on function public.catalogo_conferencia is
  'Catalogo inteiro para a tela de conferencia resolver bipada e busca por nome offline.';
