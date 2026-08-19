-- =============================================================================
-- 0003 - Catalogo, clientes e area/taxa de entrega
-- =============================================================================

-- Categorias ------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> ''),
  slug       text not null unique,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create trigger trg_categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create index idx_categories_listagem on public.categories (is_active, sort_order);

-- Produtos --------------------------------------------------------------------
-- price: preco por UNIDADE ou preco por KG quando sold_by_weight = true.
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null references public.categories(id) on delete restrict,
  name              text not null check (btrim(name) <> ''),
  slug              text not null unique,
  short_description text,
  image_path        text,
  unit_type         public.unit_type not null default 'unidade',
  sold_by_weight    boolean not null default false,
  price             numeric(12,2) not null check (price > 0),
  weight_step       numeric(10,3) default 0.100,
  min_weight        numeric(10,3) default 0.100,
  is_active         boolean not null default true,
  is_available      boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint products_peso_unidade_ck
    check (not sold_by_weight or unit_type in ('kg', 'g')),
  constraint products_peso_passo_ck
    check (not sold_by_weight or (weight_step > 0 and min_weight > 0))
);
alter table public.products enable row level security;
create trigger trg_products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create index idx_products_catalogo on public.products (category_id, is_active, sort_order);
create index idx_products_disponibilidade on public.products (is_active, is_available);
create index idx_products_busca on public.products
  using gin (public.normalize_text(name) extensions.gin_trgm_ops);

comment on column public.products.price is
  'Preco por unidade OU preco por kg quando sold_by_weight = true.';
comment on column public.products.is_active is
  'Inativo nao aparece no catalogo. Diferente de is_available (acabou o estoque).';

-- Zonas de entrega -------------------------------------------------------------
create table public.delivery_zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> ''),
  match_type public.zone_match_type not null default 'bairro',
  fee        numeric(12,2) not null check (fee >= 0),
  -- reservado para evolucao por raio/distancia (nao usado na v1)
  center_lat double precision,
  center_lng double precision,
  radius_km  numeric(6,2),
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.delivery_zones enable row level security;
create trigger trg_delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();

create table public.zone_neighborhoods (
  id              uuid primary key default gen_random_uuid(),
  zone_id         uuid not null references public.delivery_zones(id) on delete cascade,
  name            text not null check (btrim(name) <> ''),
  name_normalized text generated always as (public.normalize_text(name)) stored,
  created_at      timestamptz not null default now()
);
alter table public.zone_neighborhoods enable row level security;
create unique index uq_zone_neighborhoods_normalizado on public.zone_neighborhoods (name_normalized);
create index idx_zone_neighborhoods_zone on public.zone_neighborhoods (zone_id);

-- Fonte UNICA do calculo da taxa. Trocar bairro por raio = trocar so esta funcao.
create or replace function public.resolve_delivery_fee(
  p_district text,
  p_cep      text default null
)
returns table (zone_id uuid, zone_name text, fee numeric, served boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select z.id, z.name, z.fee, true
      from public.zone_neighborhoods n
      join public.delivery_zones z on z.id = n.zone_id
     where n.name_normalized = public.normalize_text(p_district)
       and z.is_active
     order by z.fee
     limit 1;

  if not found then
    return query select null::uuid, null::text, null::numeric, false;
  end if;
end;
$$;

grant execute on function public.resolve_delivery_fee(text, text) to anon, authenticated;

-- Clientes ---------------------------------------------------------------------
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  phone          text not null unique,
  name           text not null,
  orders_count   integer not null default 0,
  total_spent    numeric(12,2) not null default 0,
  first_order_at timestamptz,
  last_order_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint customers_phone_ck check (phone ~ '^[0-9]{10,13}$')
);
alter table public.customers enable row level security;
create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

comment on column public.customers.phone is 'Somente digitos. Chave natural do cliente (normalize_phone).';

create table public.customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  cep         text,
  street      text not null,
  number      text not null,
  district    text not null,
  complement  text,
  reference   text,
  zone_id     uuid references public.delivery_zones(id) on delete set null,
  is_default  boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.customer_addresses enable row level security;
create index idx_customer_addresses_cliente on public.customer_addresses (customer_id, created_at desc);
