-- =============================================================================
-- 0045 - Aplica a nova classificacao (depois de reclassificacao_0044 carregada)
-- =============================================================================

do $$
declare
  faltando integer;
begin
  -- Trava de seguranca: sem a planilha inteira carregada, nao mexe em nada.
  select count(*) into faltando
    from public.products p
   where p.is_active
     and not exists (select 1 from public.reclassificacao_0044 r where r.product_id = p.id);
  if faltando > 0 then
    raise exception 'reclassificacao_0044 incompleta: % produtos ativos sem destino', faltando;
  end if;
end $$;

-- Nome, ordem e visibilidade de cada categoria.
update public.categories c
   set name = v.nome, sort_order = v.ordem, is_active = true
  from (values
    ('hortifruti', 'Hortifrúti', 1),
    ('acougue', 'Açougue', 2),
    ('padaria', 'Padaria', 3),
    ('frios', 'Frios e laticínios', 4),
    ('matinais', 'Café da manhã', 5),
    ('arroz-feijao-e-graos', 'Arroz, feijão e grãos', 6),
    ('massas-e-instantaneos', 'Massas e instantâneos', 7),
    ('oleos-e-temperos', 'Óleos e temperos', 8),
    ('molhos-e-conservas', 'Molhos e conservas', 9),
    ('farinhas-acucar-e-confeitaria', 'Farinhas, açúcar e confeitaria', 10),
    ('congelados', 'Congelados', 11),
    ('bebidas', 'Bebidas', 12),
    ('biscoitos-e-snacks', 'Biscoitos e salgadinhos', 13),
    ('doces-e-chocolates', 'Doces e chocolates', 14),
    ('higiene', 'Higiene e beleza', 15),
    ('bebe', 'Bebê', 16),
    ('limpeza', 'Limpeza', 17),
    ('bazar-e-utilidades', 'Casa e utilidades', 18),
    ('pet', 'Pet', 19),
    ('cigarro', 'Tabacaria', 20)
  ) as v(slug, nome, ordem)
 where c.slug = v.slug;

-- Cada produto na categoria da planilha.
update public.products p
   set category_id = c.id
  from public.reclassificacao_0044 r
  join public.categories c on c.slug = r.slug_novo
 where r.product_id = p.id
   and not r.desativar
   and p.category_id is distinct from c.id;

-- Itens de caixa que vieram na importacao ("CANCELAR COMPRA", chips...):
-- saem da loja, continuam no cadastro.
update public.products p
   set is_active = false
  from public.reclassificacao_0044 r
 where r.product_id = p.id and r.desativar and p.is_active;

-- Categorias que deixaram de existir: desligadas (vazias), nao apagadas.
update public.categories
   set is_active = false
 where slug in ('mercearia', 'salgadinhos', 'medicamentos')
   and not exists (
     select 1 from public.products p
      where p.category_id = categories.id and p.is_active
   );
