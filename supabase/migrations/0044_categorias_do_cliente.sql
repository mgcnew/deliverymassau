-- =============================================================================
-- 0044 - Categorias com o nome que o cliente procura
-- Mesmo depois da reclassificacao de 28/08, "Mercearia" seguia com 1.918
-- produtos e servia de gaveta para tudo: escova de dente, agua sanitaria,
-- cerveja, chinelo, fralda, cigarro. Quem abre a loja procurando arroz nao
-- sabe que ele esta ali; quem procura desodorante menos ainda.
--
-- Agora sao 20 categorias e nenhuma se chama Mercearia:
-- - Mercearia se divide em Arroz, feijao e graos / Massas e instantaneos /
--   Oleos e temperos / Farinhas, acucar e confeitaria (novas); o que nao era
--   mercearia vai para a categoria certa.
-- - Novas: Bebe. Renomeadas: Matinais -> Cafe da manha, Cigarro -> Tabacaria,
--   Bazar -> Casa e utilidades, Biscoitos e snacks -> Biscoitos e salgadinhos
--   (Salgadinhos entra nela), Medicamentos entra em Higiene e beleza.
-- - Frios e laticinios e Congelados voltam a aparecer na loja.
-- - Os nomes ganham acento ("Bebe" sem acento le como verbo).
-- - Os slugs das categorias que ja existiam ficam iguais: links antigos
--   (/c/matinais, /c/cigarro...) continuam abrindo.
--
-- A classificacao produto a produto veio de uma planilha revisada pelo
-- mercado (categorias-proposta.csv) e e carregada em reclassificacao_0044
-- antes do passo final (0045). Tudo reversivel: veja docs/IMPORTACAO_PRODUTOS.md.
-- =============================================================================

-- Foto de antes, para desfazer: categoria e se estava ativo.
create table if not exists public.products_categoria_backup_0044 as
  select id, category_id, is_active from public.products;
alter table public.products_categoria_backup_0044 enable row level security;

create table if not exists public.categories_backup_0044 as
  select * from public.categories;
alter table public.categories_backup_0044 enable row level security;

-- Destino de cada produto (carregado da planilha revisada).
create table if not exists public.reclassificacao_0044 (
  product_id uuid primary key references public.products (id) on delete cascade,
  slug_novo text,
  desativar boolean not null default false
);
alter table public.reclassificacao_0044 enable row level security;

-- Categorias novas nascem desligadas: so aparecem no 0045, junto com os
-- produtos (senao a loja mostraria categoria vazia no meio do caminho).
insert into public.categories (name, slug, sort_order, is_active) values
  ('Arroz, feijão e grãos', 'arroz-feijao-e-graos', 6, false),
  ('Massas e instantâneos', 'massas-e-instantaneos', 7, false),
  ('Óleos e temperos', 'oleos-e-temperos', 8, false),
  ('Farinhas, açúcar e confeitaria', 'farinhas-acucar-e-confeitaria', 10, false),
  ('Bebê', 'bebe', 16, false)
on conflict (slug) do nothing;
