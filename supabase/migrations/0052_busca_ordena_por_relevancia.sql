-- =============================================================================
-- 0052 - Busca ordena por relevancia: inicio de palavra primeiro
--
-- A busca comparava com LIKE '%termo%', que acha o termo em qualquer posicao,
-- inclusive no miolo de outra palavra. Procurar "coca" trazia 38 produtos, dos
-- quais 13 eram PACOCA, MOCOCA e PACOCAO. Num catalogo de 5 mil itens com 48
-- por pagina, esse ruido empurra o certo para fora da primeira tela.
--
-- A correcao obvia seria EXIGIR que o termo comece uma palavra. Custa caro
-- demais: "cafe" deixaria de achar os tres NESCAFE, que sao cafe de verdade.
-- Nao ha como distinguir por regra o acidente (pacoca) do legitimo (nescafe) -
-- os dois sao o termo no meio de outra palavra.
--
-- Entao nao se filtra: ordena-se. Quem comeca palavra vem primeiro, quem casa
-- no miolo vem depois. "coca" continua devolvendo 38, mas as 25 Cocas ocupam a
-- tela e as pacocas vao para o fim; "cafe" devolve os 43 com o Nescafe logo
-- apos os 40. Nada se perde e a primeira tela fica certa.
--
-- A relevancia entra ANTES da popularidade de proposito: casar no miolo de
-- outra palavra costuma ser coincidencia, e uma pacoca campea de vendas nao
-- deve liderar uma busca por "coca".
--
-- Sem busca, a expressao vale true para todo mundo e nao muda nada.
-- =============================================================================

create or replace function public.get_vitrine_pagina(
  p_categoria uuid default null,
  p_busca     text default null,
  p_limite    integer default 48,
  p_offset    integer default 0
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with busca as (
    -- Uma vez so, e nao a cada linha. normalize_text devolve nulo para vazio:
    -- sem busca, sem filtro. Como ele reduz tudo que nao e letra ou numero a
    -- espaco, nao sobra metacaractere de regex nem curinga de LIKE para o
    -- cliente injetar.
    select public.normalize_text(p_busca) as termo
  ),
  alvo as (
    select p.id, p.name, p.slug, p.short_description, p.image_path, p.unit_type,
           p.sold_by_weight, p.price, p.original_price, p.is_available,
           p.category_id, p.weight_step, p.min_weight,
           row_number() over (
             order by p.is_available desc,
                      -- \m = inicio de palavra no regex do Postgres
                      (b.termo is null or p.name_normalized ~ ('\m' || b.termo)) desc,
                      pp.posicao nulls last,
                      (p.image_path is not null) desc,
                      p.sort_order,
                      p.name
           ) as ordem
      from public.products p
      cross join busca b
      left join public.product_popularity pp on pp.product_id = p.id
     where p.is_active
       and (p_categoria is null or p.category_id = p_categoria)
       and (b.termo is null or p.name_normalized like '%' || b.termo || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from alvo),
    'itens', coalesce((
      -- "- 'ordem'" tira a coluna de apoio: sem isso, cada campo do produto
      -- precisaria ser escrito duas vezes e um esquecimento so passaria batido.
      select jsonb_agg(to_jsonb(x) - 'ordem' order by x.ordem)
        from (
          select * from alvo
           order by ordem
           limit greatest(p_limite, 1)
          offset greatest(p_offset, 0)
        ) x
    ), '[]'::jsonb)
  );
$$;

comment on function public.get_vitrine_pagina is
  'Uma pagina da vitrine: disponivel, relevancia da busca, mais pedidos, com foto, nome.';
