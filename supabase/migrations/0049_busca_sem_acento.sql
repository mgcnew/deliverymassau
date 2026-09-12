-- =============================================================================
-- 0049 - Busca da loja sem acento
--
-- A vitrine procurava com ilike no nome cru. Como o cadastro veio do PDV em
-- caixa alta e praticamente sem acento (UM nome acentuado em 4.796), o
-- cliente que escreve certo e o que nao acha nada:
--
--   "cafe" -> 43 produtos        "café" -> 0
--   "pao"  -> 76 produtos        "pão"  -> 1
--
-- A comparacao passa a ser pelo nome normalizado, que e a mesma chave que a
-- importacao ja usa para casar produto (normalize_text, 0001): minusculo, sem
-- acento, pontuacao virando espaco. Normalizar OS DOIS lados - o que o cliente
-- digita e o que esta cadastrado - resolve os dois sentidos de uma vez, e de
-- quebra faz "sab.dove" achar "SAB.DOVE 500ML".
--
-- Coluna gerada, e nao indice de expressao, porque quem monta a consulta e o
-- PostgREST: ele filtra por coluna, nao sabe escrever normalize_text(name).
-- Mesmo padrao que zone_neighborhoods ja usa desde 0003.
--
-- Efeito colateral bom: o termo normalizado so tem letras, numeros e espaco,
-- entao nao ha como um "%" digitado pelo cliente virar curinga na consulta.
-- =============================================================================

alter table public.products
  add column name_normalized text generated always as (public.normalize_text(name)) stored;

comment on column public.products.name_normalized is
  'Nome sem acento/caixa/pontuacao. E por aqui que a busca da loja compara.';

-- GIN trigrama: e o que faz LIKE '%termo%' nao varrer os 5 mil produtos.
create index idx_products_busca_normalizada
  on public.products using gin (name_normalized extensions.gin_trgm_ops);

-- O trigrama antigo, sobre a expressao, ficou orfao: nada no sistema faz LIKE
-- nem similaridade sobre normalize_text(name) - so igualdade, vinda da
-- importacao, e essa tem o btree proprio de 0031 (que e mais rapido para
-- igualdade de qualquer forma). Manter os dois seria carregar 2 MB repetidos
-- e escrever duas vezes a cada produto salvo.
drop index if exists public.idx_products_busca;
