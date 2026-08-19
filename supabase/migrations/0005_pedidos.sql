-- =============================================================================
-- 0005 - Pedidos, itens, historico de status e atribuicao de entrega
-- O banco e a fonte de verdade: totais, transicoes e historico sao do Postgres.
-- =============================================================================

-- Numero amigavel do pedido (#1047). UUID continua sendo a chave interna.
create sequence public.order_number_seq start with 1000 increment by 1;

create table public.orders (
  id                       uuid primary key default gen_random_uuid(),
  order_number             integer not null unique default nextval('public.order_number_seq'),
  public_token             text not null unique default (
                             replace(gen_random_uuid()::text, '-', '') ||
                             replace(gen_random_uuid()::text, '-', '')
                           ),
  fulfillment              public.fulfillment_type not null default 'entrega',

  customer_id              uuid not null references public.customers(id) on delete restrict,
  -- snapshot: o pedido nao muda quando o cadastro do cliente muda
  customer_name            text not null,
  customer_phone           text not null,
  address_cep              text,
  address_street           text,
  address_number           text,
  address_district         text,
  address_complement       text,
  address_reference        text,

  zone_id                  uuid references public.delivery_zones(id) on delete set null,
  zone_name                text,
  delivery_fee             numeric(12,2) not null default 0 check (delivery_fee >= 0),

  items_subtotal_estimated numeric(12,2) not null default 0,
  items_subtotal_final     numeric(12,2) not null default 0,
  total                    numeric(12,2) not null default 0,

  status                   public.order_status not null default 'recebido',
  payment_method           public.payment_method not null,
  needs_change             boolean not null default false,
  change_for               numeric(12,2),
  change_amount            numeric(12,2) generated always as (
                             case when needs_change and change_for is not null
                                  then greatest(change_for - total, 0) end
                           ) stored,
  customer_note            text,

  separated_by             uuid references public.profiles(id) on delete set null,
  separation_started_at    timestamptz,
  separation_finished_at   timestamptz,

  delivery_person_id       uuid references public.profiles(id) on delete set null,
  assigned_at              timestamptz,
  dispatched_at            timestamptz,
  delivered_at             timestamptz,

  cancelled_at             timestamptz,
  cancelled_by             uuid references public.profiles(id) on delete set null,
  cancel_reason            text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint orders_troco_metodo_ck
    check (not needs_change or payment_method = 'dinheiro'),
  constraint orders_troco_valor_ck
    check (not needs_change or change_for is not null),
  constraint orders_endereco_ck
    check (fulfillment = 'retirada' or (
      address_street is not null and address_number is not null and address_district is not null
    ))
);
alter table public.orders enable row level security;

comment on column public.orders.change_amount is
  'Troco estimado sobre o TOTAL ATUAL. Se a pesagem elevar o total acima do change_for, vira 0 e a operacao e avisada na tela - de proposito nao existe constraint change_for >= total, senao a pesagem ficaria bloqueada.';

create index idx_orders_operacional on public.orders (status, created_at desc);
create index idx_orders_entregador on public.orders (delivery_person_id, status);
create index idx_orders_cliente on public.orders (customer_id, created_at desc);
create index idx_orders_data on public.orders (created_at desc);

-- Itens ------------------------------------------------------------------------
create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  product_id         uuid references public.products(id) on delete restrict,
  -- snapshot do produto no momento do pedido
  product_name       text not null,
  unit_type          public.unit_type not null,
  sold_by_weight     boolean not null default false,
  unit_price         numeric(12,2) not null check (unit_price > 0),

  requested_quantity numeric(10,3) not null check (requested_quantity > 0),
  weighed_quantity   numeric(10,3) check (weighed_quantity > 0),

  estimated_total    numeric(12,2) not null default 0,
  final_total        numeric(12,2) not null default 0,

  item_status        public.order_item_status not null default 'pendente',
  note               text,
  separated_by       uuid references public.profiles(id) on delete set null,
  separated_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint order_items_peso_ck check (sold_by_weight or weighed_quantity is null)
);
alter table public.order_items enable row level security;
create index idx_order_items_pedido on public.order_items (order_id);
create trigger trg_order_items_updated_at before update on public.order_items
  for each row execute function public.set_updated_at();

comment on column public.order_items.requested_quantity is
  'Quantidade/peso pedido pelo cliente. NUNCA sobrescrito pela pesagem.';
comment on column public.order_items.weighed_quantity is
  'Peso real da balanca, informado na separacao. Só para produtos por peso.';

-- Historico de status -----------------------------------------------------------
create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  changed_by  uuid references public.profiles(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.order_status_history enable row level security;
create index idx_order_status_history_pedido on public.order_status_history (order_id, created_at);

-- Historico de quem assumiu/liberou a entrega -----------------------------------
create table public.delivery_assignments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  delivery_person_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at        timestamptz not null default now(),
  released_at        timestamptz,
  released_by        uuid references public.profiles(id) on delete set null
);
alter table public.delivery_assignments enable row level security;
create index idx_delivery_assignments_pedido on public.delivery_assignments (order_id, assigned_at desc);
create index idx_delivery_assignments_pessoa on public.delivery_assignments (delivery_person_id, assigned_at desc);

-- =============================================================================
-- Calculo de totais (produtos por peso)
-- =============================================================================
create or replace function public.trg_order_item_totais()
returns trigger
language plpgsql
as $$
begin
  new.estimated_total := round(new.requested_quantity * new.unit_price, 2);

  if new.item_status = 'indisponivel' then
    new.final_total := 0;
  else
    new.final_total := round(coalesce(new.weighed_quantity, new.requested_quantity) * new.unit_price, 2);
  end if;

  return new;
end;
$$;

create trigger trg_order_item_totais
  before insert or update on public.order_items
  for each row execute function public.trg_order_item_totais();

create or replace function public.recalc_order_totals(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.orders o
     set items_subtotal_estimated = coalesce(t.est, 0),
         items_subtotal_final     = coalesce(t.fin, 0)
    from (
      select sum(estimated_total) as est, sum(final_total) as fin
        from public.order_items where order_id = p_order_id
    ) t
   where o.id = p_order_id;
$$;

create or replace function public.trg_order_items_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_order_totals(coalesce(new.order_id, old.order_id));
  return null;
end;
$$;

create trigger trg_order_items_recalc
  after insert or update or delete on public.order_items
  for each row execute function public.trg_order_items_recalc();

-- total sempre = subtotal final + taxa (unico lugar onde total e escrito)
create or replace function public.trg_orders_total()
returns trigger
language plpgsql
as $$
begin
  new.total := round(new.items_subtotal_final + new.delivery_fee, 2);
  return new;
end;
$$;

create trigger trg_orders_total
  before insert or update on public.orders
  for each row execute function public.trg_orders_total();

-- =============================================================================
-- Fluxo de status
-- =============================================================================
create or replace function public.order_status_can_move(
  p_from public.order_status,
  p_to   public.order_status
)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'recebido'              then p_to in ('separando', 'cancelado')
    when 'separando'             then p_to in ('aguardando_entregador', 'cancelado')
    when 'aguardando_entregador' then p_to in ('saiu_para_entrega', 'separando', 'cancelado')
    when 'saiu_para_entrega'     then p_to in ('entregue', 'cancelado')
    else false
  end;
$$;

create or replace function public.trg_orders_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not public.order_status_can_move(old.status, new.status) then
      raise exception 'Transicao de status invalida: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    if new.status = 'separando' and new.separation_started_at is null then
      new.separation_started_at := now();
    end if;
    if new.status = 'aguardando_entregador' then
      new.separation_finished_at := coalesce(new.separation_finished_at, now());
    end if;
    if new.status = 'saiu_para_entrega' then
      if new.delivery_person_id is null then
        raise exception 'Defina o entregador antes de sair para entrega.' using errcode = 'check_violation';
      end if;
      new.dispatched_at := coalesce(new.dispatched_at, now());
    end if;
    if new.status = 'entregue' then
      new.delivered_at := coalesce(new.delivered_at, now());
    end if;
    if new.status = 'cancelado' then
      if coalesce(btrim(new.cancel_reason), '') = '' then
        raise exception 'Informe o motivo do cancelamento.' using errcode = 'check_violation';
      end if;
      new.cancelled_at := coalesce(new.cancelled_at, now());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_orders_status
  before update on public.orders
  for each row execute function public.trg_orders_status();

-- Historico automatico: e impossivel mudar status sem registrar
create or replace function public.trg_orders_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
    values (new.id, old.status, new.status, auth.uid(),
            case when new.status = 'cancelado' then new.cancel_reason end);

    if new.status = 'entregue' then
      update public.customers c
         set orders_count  = c.orders_count + 1,
             total_spent   = c.total_spent + new.total,
             last_order_at = now()
       where c.id = new.customer_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_orders_history
  after insert or update on public.orders
  for each row execute function public.trg_orders_history();

create trigger trg_audit_orders after update on public.orders
  for each row execute function public.trg_audit_row();
create trigger trg_audit_order_items after update on public.order_items
  for each row execute function public.trg_audit_row();
