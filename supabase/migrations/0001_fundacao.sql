-- =============================================================================
-- 0001 - Fundacao: extensoes, enums centralizados e funcoes utilitarias
-- Mercado Massa 24h - Delivery
-- =============================================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Enums centralizados (nunca usar strings soltas no codigo)
create type public.unit_type as enum ('unidade', 'pacote', 'caixa', 'kg', 'g');

create type public.order_status as enum (
  'recebido',
  'separando',
  'aguardando_entregador',
  'saiu_para_entrega',
  'entregue',
  'cancelado'
);

create type public.order_item_status as enum ('pendente', 'separado', 'indisponivel');

create type public.payment_method as enum ('pix', 'dinheiro', 'debito', 'credito');

create type public.zone_match_type as enum ('bairro', 'regiao', 'raio');

-- Preparado para retirada no balcao no futuro; v1 usa somente 'entrega'
create type public.fulfillment_type as enum ('entrega', 'retirada');

-- updated_at automatico
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Normalizacao de texto: minusculo, sem acento, sem pontuacao, espaco unico.
-- IMMUTABLE de proposito: usada em coluna gerada e indice unico.
create or replace function public.normalize_text(p_text text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(
      regexp_replace(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_text, ''))),
        '[^a-z0-9]+', ' ', 'g'
      )
    ),
    ''
  );
$$;

-- Telefone: somente digitos (chave de deduplicacao de clientes)
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
$$;

comment on function public.normalize_text is 'Chave de comparacao de bairros/nomes: minusculo, sem acento, sem pontuacao.';
comment on function public.normalize_phone is 'Telefone somente digitos (DDD + numero). Chave natural do cliente.';
