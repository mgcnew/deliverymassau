-- =============================================================================
-- 0004 - Configuracoes do delivery, formas de pagamento e auditoria
-- =============================================================================

create table public.settings (
  id                      smallint primary key default 1 check (id = 1),
  market_name             text not null default 'Mercado Massa 24h',
  market_phone            text,
  market_logo_path        text,
  market_address          text,
  timezone                text not null default 'America/Sao_Paulo',
  delivery_enabled        boolean not null default true,
  delivery_closed_message text not null default 'Delivery temporariamente indisponivel.',
  min_order_value         numeric(12,2) not null default 30.00 check (min_order_value >= 0),
  weight_tolerance_pct    numeric(5,2) not null default 30.00,
  pix_key                 text,
  pix_receiver_name       text,
  updated_by              uuid references public.profiles(id) on delete set null,
  updated_at              timestamptz not null default now()
);
alter table public.settings enable row level security;
create trigger trg_settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (id) values (1);

comment on column public.settings.timezone is
  'Fuso usado nas agregacoes de "hoje" do dashboard. Critico num mercado 24h.';
comment on column public.settings.weight_tolerance_pct is
  'Divergencia entre peso solicitado e pesado que dispara confirmacao extra na separacao.';

create table public.payment_methods (
  code       public.payment_method primary key,
  label      text not null,
  is_active  boolean not null default true,
  sort_order integer not null default 0
);
alter table public.payment_methods enable row level security;

insert into public.payment_methods (code, label, sort_order) values
  ('pix',      'PIX',              1),
  ('dinheiro', 'Dinheiro',         2),
  ('debito',   'Cartao de debito', 3),
  ('credito',  'Cartao de credito',4);

-- Auditoria -------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  record_id  text,
  action     text not null,
  actor_id   uuid references public.profiles(id) on delete set null,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index idx_audit_log_registro on public.audit_log (table_name, record_id, created_at desc);
create index idx_audit_log_data on public.audit_log (created_at desc);

create or replace function public.log_audit(
  p_table  text,
  p_record text,
  p_action text,
  p_before jsonb default null,
  p_after  jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (table_name, record_id, action, actor_id, before, after)
  values (p_table, p_record, p_action, auth.uid(), p_before, p_after);
$$;

-- Trigger generico de auditoria (usado nas tabelas criticas)
create or replace function public.trg_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_after  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_record text;
begin
  v_record := coalesce(
    coalesce(v_after, v_before) ->> 'id',
    coalesce(v_after, v_before) ->> 'user_id',
    coalesce(v_after, v_before) ->> 'order_id'
  );
  insert into public.audit_log (table_name, record_id, action, actor_id, before, after)
  values (tg_table_name, v_record, lower(tg_op), auth.uid(), v_before, v_after);
  return null;
end;
$$;

create trigger trg_audit_settings after update on public.settings
  for each row execute function public.trg_audit_row();
create trigger trg_audit_payment_methods after update on public.payment_methods
  for each row execute function public.trg_audit_row();
create trigger trg_audit_delivery_zones after insert or update or delete on public.delivery_zones
  for each row execute function public.trg_audit_row();
create trigger trg_audit_user_permissions after insert or update or delete on public.user_permissions
  for each row execute function public.trg_audit_row();
create trigger trg_audit_profiles after update on public.profiles
  for each row execute function public.trg_audit_row();
