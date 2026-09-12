-- =============================================================================
-- 0051 - A ordem de "mais pedidos" passa a valer na busca, e foto vem antes
--
-- 0043 colocou o que o bairro mais pede na frente, mas so na pagina de
-- categoria. A BUSCA continuava alfabetica - e busca e onde a intencao e mais
-- alta: quem digita "leite" ja decidiu que quer leite, e merece ver primeiro o
-- leite que a loja vende, nao o primeiro da ordem alfabetica. Esta migration
-- junta as duas listagens numa funcao so, para nao existir de novo uma
-- ordenacao que vale em um lugar e nao no outro.
--
-- E entra um criterio novo, para valer ENQUANTO nao ha venda: produto com
-- foto antes de produto sem foto. Hoje o ranking mal aparece (14 produtos
-- vendidos em 4.796 ativos), entao a ordem real e alfabetica - e ela abre
-- "Casa e utilidades" com uma parede de cards vazios, porque 351 dos 514
-- itens da categoria estao sem foto. O criterio se apaga sozinho: conforme
-- as vendas chegam, a popularidade decide antes dele, e conforme as fotos
-- entram, ele deixa de separar qualquer coisa.
--
-- A ordem completa, de fora para dentro:
--   1. disponivel antes de esgotado
--   2. mais pedidos nos ultimos 90 dias (product_popularity)
--   3. com foto antes de sem foto
--   4. sort_order, depois nome
--
-- Popularidade ANTES de foto de proposito: produto que o bairro compra de
-- verdade vale mais que produto bonito que ninguem levou.
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
  with alvo as (
    select p.id, p.name, p.slug, p.short_description, p.image_path, p.unit_type,
           p.sold_by_weight, p.price, p.original_price, p.is_available,
           p.category_id, p.weight_step, p.min_weight,
           row_number() over (
             order by p.is_available desc,
                      pp.posicao nulls last,
                      (p.image_path is not null) desc,
                      p.sort_order,
                      p.name
           ) as ordem
      from public.products p
      left join public.product_popularity pp on pp.product_id = p.id
     where p.is_active
       and (p_categoria is null or p.category_id = p_categoria)
       -- normalize_text devolve nulo para vazio: sem busca, sem filtro. E
       -- como ele reduz tudo que nao e letra ou numero a espaco, um "%"
       -- digitado pelo cliente nao vira curinga.
       and (
         public.normalize_text(p_busca) is null
         or p.name_normalized like '%' || public.normalize_text(p_busca) || '%'
       )
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

revoke all on function public.get_vitrine_pagina(uuid, text, integer, integer) from public;
grant execute on function public.get_vitrine_pagina(uuid, text, integer, integer) to anon, authenticated;

comment on function public.get_vitrine_pagina is
  'Uma pagina da vitrine por categoria e/ou busca: disponivel, mais pedidos, com foto, nome.';

-- get_categoria_pagina vira casca da funcao nova.
--
-- Nao da para simplesmente apagar: o banco recebe esta migration antes de o
-- codigo novo subir, e a loja que esta no ar agora chama esta funcao pelo
-- nome. Apagando, a pagina de categoria quebraria na janela entre uma coisa
-- e outra. Como casca, ela continua respondendo E ja responde com a ordem
-- nova. Depois do deploy ela fica sem ninguem chamando e pode sair.
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
  select public.get_vitrine_pagina(p_categoria, null, p_limite, p_offset);
$$;

comment on function public.get_categoria_pagina is
  'Obsoleta: casca de get_vitrine_pagina, mantida para a loja no ar durante o deploy.';
