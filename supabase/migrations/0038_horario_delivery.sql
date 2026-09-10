-- =============================================================================
-- 0038 - Horario de funcionamento do delivery, com abrir/fechar manual
--
-- Antes, uma chave so (settings.delivery_enabled): alguem tinha que lembrar
-- de fechar e de abrir todo dia. Agora:
--
--   - delivery_hours: um horario corrido por dia da semana, ou o dia inteiro
--     (24h), ou fechado. Horario pode passar da meia-noite (18:00 -> 02:00).
--   - O botao manual vira EXCECAO temporaria: "Abrir agora" fora do horario,
--     "Fechar agora" dentro dele. Vale ate a proxima troca do horario e
--     depois o automatico volta sozinho - ninguem esquece o delivery ligado
--     numa madrugada. Com o horario todo em 24h nao ha "proxima troca": o
--     fechamento manual fica ate alguem reabrir.
--   - delivery_estado() e a unica regra: loja, painel e criacao de pedido
--     perguntam a ela, no fuso do mercado (settings.timezone).
--
-- delivery_enabled (a chave antiga) desligado passa a valer como fechado
-- manual sem prazo: o botao da versao anterior do painel, ainda no ar durante
-- o deploy, continua funcionando. Os 7 dias comecam em 24h: o comportamento
-- so muda quando o admin cadastrar o horario.
-- =============================================================================

create table if not exists public.delivery_hours (
  weekday   smallint primary key check (weekday between 0 and 6),  -- 0 = domingo (extract(dow))
  mode      text not null default '24h' check (mode in ('horario', '24h', 'fechado')),
  opens_at  time,
  closes_at time,
  constraint delivery_hours_horario_ck
    check (mode <> 'horario' or (opens_at is not null and closes_at is not null and opens_at <> closes_at))
);

comment on table public.delivery_hours is
  'Horario do delivery por dia da semana (0 = domingo). closes_at menor que opens_at = fecha no dia seguinte.';

insert into public.delivery_hours (weekday, mode)
select d, '24h' from generate_series(0, 6) d
on conflict (weekday) do nothing;

alter table public.delivery_hours enable row level security;

create policy delivery_hours_select on public.delivery_hours
  for select to authenticated using ((select public.has_permission('config.acessar')));
create policy delivery_hours_update on public.delivery_hours
  for update to authenticated
  using ((select public.has_permission('config.delivery_status')))
  with check ((select public.has_permission('config.delivery_status')));

create trigger trg_audit_delivery_hours after update on public.delivery_hours
  for each row execute function public.trg_audit_row();

-- Excecao manual -------------------------------------------------------------
alter table public.settings
  add column if not exists delivery_override text
    check (delivery_override in ('aberto', 'fechado')),
  add column if not exists delivery_override_until timestamptz;

comment on column public.settings.delivery_override is
  'Abrir/fechar manual por cima do horario. Nulo = segue o horario.';
comment on column public.settings.delivery_override_until is
  'Ate quando vale o manual (proxima troca do horario). Nulo com override = ate alguem desfazer.';

-- Abrir/fechar manual continua exigindo config.delivery_status.
create or replace function public.trg_settings_permissoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.min_order_value is distinct from old.min_order_value
     and not public.has_permission('config.pedido_minimo') then
    raise exception 'SEM_PERMISSAO' using detail = 'config.pedido_minimo', errcode = '42501';
  end if;

  if (new.delivery_enabled, new.delivery_closed_message, new.delivery_override, new.delivery_override_until)
     is distinct from
     (old.delivery_enabled, old.delivery_closed_message, old.delivery_override, old.delivery_override_until)
     and not public.has_permission('config.delivery_status') then
    raise exception 'SEM_PERMISSAO' using detail = 'config.delivery_status', errcode = '42501';
  end if;

  if (new.pix_key, new.pix_receiver_name) is distinct from (old.pix_key, old.pix_receiver_name)
     and not public.has_permission('config.pix') then
    raise exception 'SEM_PERMISSAO' using detail = 'config.pix', errcode = '42501';
  end if;

  if (new.market_name, new.market_phone, new.market_logo_path, new.market_address,
      new.market_city, new.timezone)
     is distinct from
     (old.market_name, old.market_phone, old.market_logo_path, old.market_address,
      old.market_city, old.timezone)
     and not public.has_permission('config.mercado') then
    raise exception 'SEM_PERMISSAO' using detail = 'config.mercado', errcode = '42501';
  end if;

  new.updated_by := auth.uid();
  return new;
end;
$$;

-- A regra ---------------------------------------------------------------------
-- Monta os periodos abertos de ontem ate daqui a 8 dias (horario da noite
-- anterior que passa da meia-noite entra, e uma semana inteira a frente
-- sempre tem a proxima abertura), junta os que encostam (24h seguidos viram
-- um periodo so) e responde, com horarios em timestamptz:
--
--   aberto        - pode fazer pedido agora
--   motivo        - 'sempre' (tudo 24h) | 'horario' | 'manual'
--   manual_ate    - ate quando vale o manual (nulo = ate alguem desfazer)
--   fecha_em      - quando deixa de aceitar pedido (nulo = nao fecha)
--   abre_em       - quando volta a aceitar (nulo = sem previsao)
--   troca_horario - proxima troca do horario, ignorando o manual. E o prazo
--                   que o botao manual grava.
create or replace function public.delivery_estado(p_agora timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz        text;
  v_override  text;
  v_ate       timestamptz;
  v_local     timestamp;
  v_inicios   timestamp[] := '{}';
  v_fins      timestamp[] := '{}';
  v_ini       timestamp;
  v_fim       timestamp;
  r           record;
  i           int;
  v_sempre    boolean;
  v_aberto_h  boolean := false;
  v_troca     timestamp;
  v_manual    boolean;
  v_aberto    boolean;
  v_fecha     timestamp;
  v_abre      timestamp;
  v_ref       timestamp;
  v_chave     boolean;
begin
  select coalesce(nullif(timezone, ''), 'America/Sao_Paulo'), delivery_override, delivery_override_until,
         delivery_enabled
    into v_tz, v_override, v_ate, v_chave
    from public.settings where id = 1;

  -- Chave antiga desligada (botao da versao anterior do painel) = fechado
  -- manual sem prazo. O app novo religa a chave ao abrir ou voltar ao horario.
  if not coalesce(v_chave, true) then
    v_override := 'fechado';
    v_ate := null;
  end if;

  v_local := p_agora at time zone v_tz;
  select coalesce(bool_and(mode = '24h'), true) into v_sempre from public.delivery_hours;

  -- Periodos abertos, ja em ordem, juntando os que encostam.
  for r in
    select case when h.mode = '24h' then d::timestamp else d + h.opens_at end as ini,
           case
             when h.mode = '24h' then (d + 1)::timestamp
             when h.closes_at > h.opens_at then d + h.closes_at
             else (d + 1) + h.closes_at
           end as fim
      from generate_series((v_local::date - 1)::timestamp, (v_local::date + 8)::timestamp, interval '1 day') g(dia)
      cross join lateral (select g.dia::date as d) x
      join public.delivery_hours h on h.weekday = extract(dow from x.d)::int
     where h.mode <> 'fechado'
     order by 1
  loop
    if v_ini is null then
      v_ini := r.ini; v_fim := r.fim;
    elsif r.ini <= v_fim then
      v_fim := greatest(v_fim, r.fim);
    else
      v_inicios := v_inicios || v_ini; v_fins := v_fins || v_fim;
      v_ini := r.ini; v_fim := r.fim;
    end if;
  end loop;
  if v_ini is not null then
    v_inicios := v_inicios || v_ini; v_fins := v_fins || v_fim;
  end if;

  -- Pelo horario, agora.
  if v_sempre then
    v_aberto_h := true;
    v_troca := null;
  else
    for i in 1 .. coalesce(array_length(v_inicios, 1), 0) loop
      if v_inicios[i] <= v_local and v_local < v_fins[i] then
        v_aberto_h := true;
        v_troca := v_fins[i];
        exit;
      elsif v_inicios[i] > v_local then
        v_troca := v_inicios[i];
        exit;
      end if;
    end loop;
  end if;

  -- Manual vencido nao conta (fica gravado ate a proxima mudanca, sem efeito).
  v_manual := v_override is not null and (v_ate is null or v_ate > p_agora);
  v_aberto := case when v_manual then v_override = 'aberto' else v_aberto_h end;

  -- Quando o estado final muda de verdade. Com manual, a troca e no fim do
  -- manual e dali em diante segue o horario.
  if v_aberto then
    -- Tudo 24h: nao fecha. Manual aberto sem prazo: ate alguem fechar.
    -- Senao, fecha no fim do periodo aberto em que o estado estiver no
    -- ponto de referencia (agora, ou o fim do manual).
    v_ref := case when v_manual then v_ate at time zone v_tz else v_local end;
    if not v_sempre and v_ref is not null then
      v_fecha := v_ref;  -- horario fechado no fim do manual: fecha ali mesmo
      for i in 1 .. coalesce(array_length(v_inicios, 1), 0) loop
        if v_inicios[i] <= v_ref and v_ref < v_fins[i] then
          v_fecha := v_fins[i];
          exit;
        end if;
      end loop;
    end if;
  else
    if v_manual then
      v_ref := v_ate at time zone v_tz;           -- nulo: fechado ate alguem abrir
    else
      v_ref := v_local;
    end if;
    if v_ref is not null then
      if v_sempre then
        v_abre := v_ref;
      else
        for i in 1 .. coalesce(array_length(v_inicios, 1), 0) loop
          if v_inicios[i] <= v_ref and v_ref < v_fins[i] then
            v_abre := v_ref;
            exit;
          elsif v_inicios[i] > v_ref then
            v_abre := v_inicios[i];
            exit;
          end if;
        end loop;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'aberto',        v_aberto,
    'motivo',        case when v_manual then 'manual' when v_sempre then 'sempre' else 'horario' end,
    'manual_ate',    case when v_manual then v_ate end,
    'fecha_em',      v_fecha at time zone v_tz,
    'abre_em',       v_abre at time zone v_tz,
    'troca_horario', v_troca at time zone v_tz,
    'fuso',          v_tz
  );
end;
$$;

revoke all on function public.delivery_estado(timestamptz) from public, anon, authenticated;
grant execute on function public.delivery_estado(timestamptz) to anon, authenticated;
