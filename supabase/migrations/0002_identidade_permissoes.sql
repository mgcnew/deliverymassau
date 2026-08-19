-- =============================================================================
-- 0002 - Identidade e permissoes granulares
-- Permissao e DADO, nao codigo. Preset e apenas atalho.
-- =============================================================================

-- Catalogo de permissoes ------------------------------------------------------
create table public.permissions (
  code        text primary key,
  module      text not null,
  label       text not null,
  description text,
  sort_order  integer not null default 0
);
alter table public.permissions enable row level security;

-- Presets (Administrador, Balconista, Motoboy, ...) ---------------------------
create table public.permission_presets (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  is_system   boolean not null default false,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.permission_presets enable row level security;
create trigger trg_permission_presets_updated_at before update on public.permission_presets
  for each row execute function public.set_updated_at();

create table public.preset_permissions (
  preset_id       uuid not null references public.permission_presets(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (preset_id, permission_code)
);
alter table public.preset_permissions enable row level security;

-- Funcionarios ----------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null check (btrim(name) <> ''),
  phone        text,
  preset_id    uuid references public.permission_presets(id) on delete set null,
  is_active    boolean not null default true,
  last_seen_at timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create index idx_profiles_active on public.profiles (is_active) where is_active;

-- Overrides individuais (o que torna o sistema granular de verdade) -----------
create table public.user_permissions (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  granted         boolean not null,
  granted_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  primary key (user_id, permission_code)
);
alter table public.user_permissions enable row level security;
create index idx_user_permissions_user on public.user_permissions (user_id);

comment on column public.user_permissions.granted is
  'true = concedida alem do preset. false = revogada apesar do preset.';

-- Resolucao de permissoes -----------------------------------------------------
-- efetivas = preset UNIAO concedidas MENOS revogadas (somente usuario ativo)
create or replace function public.effective_permissions(p_user_id uuid default auth.uid())
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select codes.permission_code
  from (
    select pp.permission_code
      from public.profiles pr
      join public.preset_permissions pp on pp.preset_id = pr.preset_id
     where pr.id = p_user_id and pr.is_active
    union
    select up.permission_code
      from public.user_permissions up
      join public.profiles pr on pr.id = up.user_id
     where up.user_id = p_user_id and up.granted and pr.is_active
  ) codes
  where not exists (
    select 1
      from public.user_permissions rev
     where rev.user_id = p_user_id
       and rev.permission_code = codes.permission_code
       and rev.granted = false
  );
$$;

create or replace function public.has_permission(p_code text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.effective_permissions(p_user_id) c where c = p_code
  );
$$;

create or replace function public.is_staff(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = p_user_id and is_active
  );
$$;

comment on function public.has_permission is
  'Fonte unica de verdade de permissao. Usada em RLS, RPCs e no app. SECURITY DEFINER para evitar recursao de RLS.';

-- Trava: o sistema nunca pode ficar sem administrador --------------------------
create or replace function public.assert_admin_remains()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles) and not exists (
    select 1 from public.profiles p
     where p.is_active
       and public.has_permission('equipe.cadastrar_admin', p.id)
  ) then
    raise exception 'Operacao bloqueada: o sistema ficaria sem nenhum administrador ativo.'
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.trg_profiles_admin_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE' and (new.is_active is distinct from old.is_active
                            or new.preset_id is distinct from old.preset_id))
     or tg_op = 'DELETE' then
    perform public.assert_admin_remains();
  end if;
  return null;
end;
$$;

create constraint trigger trg_profiles_admin_guard
  after update or delete on public.profiles
  deferrable initially deferred
  for each row execute function public.trg_profiles_admin_guard();

-- Aplicar permissoes de um funcionario ----------------------------------------
-- p_codes = conjunto FINAL desejado. Os overrides sao derivados do preset.
create or replace function public.set_user_permissions(
  p_user_id   uuid,
  p_preset_id uuid,
  p_codes     text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_desired text[] := coalesce(p_codes, '{}');
  v_current text[];
  v_added   text[];
  v_missing text[];
begin
  if not public.has_permission('equipe.alterar_permissoes', v_actor) then
    raise exception 'Sem permissao para alterar permissoes.' using errcode = '42501';
  end if;

  if exists (select 1 from unnest(v_desired) c
              where c not in (select code from public.permissions)) then
    raise exception 'Permissao inexistente no catalogo.' using errcode = '22023';
  end if;

  select coalesce(array_agg(c), '{}') into v_current
    from public.effective_permissions(p_user_id) c;

  -- Regra anti-escalada: ninguem concede o que nao possui
  select coalesce(array_agg(c), '{}') into v_added
    from unnest(v_desired) c where c <> all (v_current);

  select coalesce(array_agg(c), '{}') into v_missing
    from unnest(v_added) c where not public.has_permission(c, v_actor);

  if array_length(v_missing, 1) > 0 then
    raise exception 'Voce nao pode conceder permissoes que nao possui: %',
      array_to_string(v_missing, ', ') using errcode = '42501';
  end if;

  update public.profiles set preset_id = p_preset_id where id = p_user_id;

  delete from public.user_permissions where user_id = p_user_id;

  -- concedidas alem do preset
  insert into public.user_permissions (user_id, permission_code, granted, granted_by)
  select p_user_id, c, true, v_actor
    from unnest(v_desired) c
   where c not in (
     select pp.permission_code from public.preset_permissions pp where pp.preset_id = p_preset_id
   );

  -- revogadas apesar do preset
  insert into public.user_permissions (user_id, permission_code, granted, granted_by)
  select p_user_id, pp.permission_code, false, v_actor
    from public.preset_permissions pp
   where pp.preset_id = p_preset_id
     and pp.permission_code <> all (v_desired);

  perform public.assert_admin_remains();
end;
$$;

revoke all on function public.set_user_permissions(uuid, uuid, text[]) from public;
grant execute on function public.set_user_permissions(uuid, uuid, text[]) to authenticated;

-- Primeiro administrador (uso unico, quando ainda nao existe nenhum perfil) ----
create or replace function public.bootstrap_first_admin(p_name text, p_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_preset uuid;
begin
  if v_uid is null then
    raise exception 'E necessario estar autenticado.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles) then
    raise exception 'Ja existe equipe cadastrada. Use a tela de Equipe.' using errcode = '42501';
  end if;

  select id into v_preset from public.permission_presets where slug = 'administrador';

  insert into public.profiles (id, name, phone, preset_id, is_active)
  values (v_uid, p_name, public.normalize_phone(p_phone), v_preset, true);

  return v_uid;
end;
$$;

revoke all on function public.bootstrap_first_admin(text, text) from public;
grant execute on function public.bootstrap_first_admin(text, text) to authenticated;
