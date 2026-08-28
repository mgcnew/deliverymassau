-- =============================================================================
-- 0031 - Indice do nome normalizado (produtos e categorias)
-- A importacao casa produto por normalize_text(name) - uma linha da planilha
-- de cada vez. Sem indice, cada linha varria a tabela inteira aplicando a
-- funcao em todo registro: com 5 mil produtos no catalogo e 1.800 linhas na
-- planilha, sao 9 milhoes de comparacoes por importacao.
--
-- Na pratica isso apareceu como "Nao foi possivel processar a planilha":
-- a chamada passava de 8 segundos e estourava o tempo limite da funcao na
-- Vercel antes de o banco responder. O indice transforma cada busca numa
-- consulta direta.
--
-- normalize_text e IMMUTABLE (0001), que e o que permite indexar por ela.
-- =============================================================================

create index if not exists idx_products_nome_normalizado
  on public.products (public.normalize_text(name));

create index if not exists idx_categories_nome_normalizado
  on public.categories (public.normalize_text(name));

comment on index public.idx_products_nome_normalizado is
  'Casamento por nome na importacao de planilha (import_products).';
