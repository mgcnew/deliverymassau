-- =============================================================================
-- 0050 - Busca de cliente sem acento
--
-- Mesma correcao de 0049, do outro lado do balcao - e aqui o problema nasce
-- invertido. Nome de produto veio do PDV em caixa alta e sem acento; nome de
-- cliente e digitado pelo proprio cliente no checkout, entao "João",
-- "Conceição" e "Cláudio" entram acentuados de verdade.
--
-- Com ilike no nome cru, quem procura "Joao" no balcao nao acha o João que
-- esta ligando. E ninguem digita acento com pressa, com o telefone no ombro.
--
-- Sem indice de proposito: sao 6 clientes hoje, a consulta ja limita a 100 e
-- ordena por ultima compra. Varrer alguns milhares de nomes curtos custa
-- menos que manter um GIN trigrama atualizado a cada pedido. Se um dia a
-- busca doer, o indice e uma linha - o mesmo criterio de 0031, que so entrou
-- quando a importacao comecou a estourar o tempo limite.
-- =============================================================================

alter table public.customers
  add column name_normalized text generated always as (public.normalize_text(name)) stored;

comment on column public.customers.name_normalized is
  'Nome sem acento/caixa/pontuacao. E por aqui que a busca de clientes compara.';
