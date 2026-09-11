-- =============================================================================
-- 0041 - Taxa de entrega por distancia (km), com faixas
--
-- O contratante quer cobrar pela distancia, nao pelo bairro. Os km vem do
-- Google (Routes API, rota de carro), chamado pelo SERVIDOR do app - a chave
-- nunca vai ao navegador.
--
--   - settings.delivery_fee_mode: 'bairro' (como sempre foi) ou 'distancia'.
--     Comeca em 'bairro': nada muda ate o admin trocar nas configuracoes.
--   - delivery_distance_bands: faixas editaveis ("ate 2 km -> R$ 5"). Alem
--     da ultima faixa, fora da area.
--   - settings.market_lat/lng: ponto de saida exato (opcional). Sem ele, a
--     rota sai do endereco do mercado.
--   - delivery_quotes: a cotacao que o servidor calcula quando o cliente
--     confirma o endereco. So o service_role escreve (RLS sem politica). O
--     pedido traz o id e create_public_order confere validade (30 min) e
--     endereco - ninguem forja taxa pelo navegador.
--
-- Termos do Google: distancia e tempo de rota nao podem ser guardados para
-- reuso. A cotacao guarda so a NOSSA taxa e o nome da faixa, nunca os km.
-- Tambem serve de contador de chamadas (limite diario e por aparelho).
--
-- Se o Google falhar (sem chave, fora do ar, endereco impreciso), o servidor
-- cai na taxa por bairro, quando o bairro esta cadastrado (origem 'bairro').
-- =============================================================================

alter table public.settings
  add column if not exists delivery_fee_mode text not null default 'bairro'
    check (delivery_fee_mode in ('bairro', 'distancia')),
  add column if not exists market_lat double precision
    check (market_lat is null or market_lat between -90 and 90),
  add column if not exists market_lng double precision
    check (market_lng is null or market_lng between -180 and 180);

comment on column public.settings.delivery_fee_mode is
  'Como a taxa de entrega e calculada: por bairro (zonas) ou por distancia (faixas de km).';

create table if not exists public.delivery_distance_bands (
  id        uuid primary key default gen_random_uuid(),
  up_to_km  numeric(6,2) not null unique check (up_to_km > 0 and up_to_km <= 100),
  fee       numeric(10,2) not null check (fee >= 0)
);

comment on table public.delivery_distance_bands is
  'Faixas da taxa por distancia: ate up_to_km (rota de carro) cobra fee. Alem da ultima, fora da area.';

alter table public.delivery_distance_bands enable row level security;

create policy delivery_distance_bands_select on public.delivery_distance_bands
  for select to authenticated using ((select public.has_permission('config.acessar')));
create policy delivery_distance_bands_insert on public.delivery_distance_bands
  for insert to authenticated with check ((select public.has_permission('config.taxa_entrega')));
create policy delivery_distance_bands_update on public.delivery_distance_bands
  for update to authenticated
  using ((select public.has_permission('config.taxa_entrega')))
  with check ((select public.has_permission('config.taxa_entrega')));
create policy delivery_distance_bands_delete on public.delivery_distance_bands
  for delete to authenticated using ((select public.has_permission('config.taxa_entrega')));

create trigger trg_audit_delivery_distance_bands after insert or update or delete on public.delivery_distance_bands
  for each row execute function public.trg_audit_row();

-- Endereco comparavel: o mesmo endereco escrito com acento, caixa ou espaco
-- diferente tem a mesma chave.
create or replace function public.chave_endereco(p_street text, p_number text, p_district text, p_cep text)
returns text
language sql
stable
set search_path = public
as $$
  select public.normalize_text(coalesce(p_street, '')) || '|' ||
         public.normalize_text(coalesce(p_number, '')) || '|' ||
         public.normalize_text(coalesce(p_district, '')) || '|' ||
         regexp_replace(coalesce(p_cep, ''), '\D', '', 'g');
$$;

revoke all on function public.chave_endereco(text, text, text, text) from public, anon, authenticated;
grant execute on function public.chave_endereco(text, text, text, text) to service_role;

create table if not exists public.delivery_quotes (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '30 minutes',
  address_key      text not null,
  origem           text not null check (origem in ('distancia', 'bairro', 'fora', 'falha')),
  fee              numeric(10,2) check (fee is null or fee >= 0),
  zone_id          uuid references public.delivery_zones(id) on delete set null,
  zone_name        text,
  consultou_google boolean not null default false,
  ip_hash          text
);

comment on table public.delivery_quotes is
  'Cotacoes de entrega por distancia. Escrita so pelo servidor (service_role). Guarda a taxa e a faixa, nunca os km (termos do Google).';

create index if not exists delivery_quotes_endereco_idx on public.delivery_quotes (address_key, expires_at desc);
create index if not exists delivery_quotes_criacao_idx on public.delivery_quotes (created_at desc);

-- RLS ligada e nenhuma politica: anon e authenticated nao leem nem escrevem.
alter table public.delivery_quotes enable row level security;

-- Funcoes do servidor (so service_role) -------------------------------------

-- Grava a cotacao e devolve o id que vai no pedido. Aproveita para apagar as
-- de mais de 7 dias: ninguem mais vai usa-las e o contador so olha 24 h.
create or replace function public.registrar_cotacao(
  p_street text, p_number text, p_district text, p_cep text,
  p_origem text, p_fee numeric, p_zone_id uuid, p_zone_name text,
  p_consultou_google boolean, p_ip_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  delete from public.delivery_quotes where created_at < now() - interval '7 days';

  insert into public.delivery_quotes
    (address_key, origem, fee, zone_id, zone_name, consultou_google, ip_hash)
  values
    (public.chave_endereco(p_street, p_number, p_district, p_cep),
     p_origem, p_fee, p_zone_id, p_zone_name, p_consultou_google, p_ip_hash)
  returning id into v_id;
  return v_id;
end;
$$;

-- Cotacao ainda boa para o mesmo endereco: o cliente que volta uma etapa no
-- checkout nao gera nova chamada ao Google. Precisa sobrar tempo para ele
-- terminar o pedido (5 min).
create or replace function public.cotacao_vigente(p_street text, p_number text, p_district text, p_cep text)
returns table (id uuid, origem text, fee numeric, zone_name text)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.origem, q.fee, q.zone_name
    from public.delivery_quotes q
   where q.address_key = public.chave_endereco(p_street, p_number, p_district, p_cep)
     and q.expires_at > now() + interval '5 minutes'
     and q.origem in ('distancia', 'bairro', 'fora')
   order by q.created_at desc
   limit 1;
$$;

-- Quantas chamadas ao Google nas ultimas 24 h (todas) e na ultima hora (deste
-- aparelho): o servidor para de chamar antes de passar dos limites.
create or replace function public.uso_google(p_ip_hash text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'dia', count(*) filter (where created_at > now() - interval '24 hours'),
    'ip_hora', count(*) filter (where ip_hash = p_ip_hash and created_at > now() - interval '1 hour')
  )
  from public.delivery_quotes
  where consultou_google and created_at > now() - interval '24 hours';
$$;

revoke all on function public.registrar_cotacao(text, text, text, text, text, numeric, uuid, text, boolean, text) from public, anon, authenticated;
revoke all on function public.cotacao_vigente(text, text, text, text) from public, anon, authenticated;
revoke all on function public.uso_google(text) from public, anon, authenticated;
grant execute on function public.registrar_cotacao(text, text, text, text, text, numeric, uuid, text, boolean, text) to service_role;
grant execute on function public.cotacao_vigente(text, text, text, text) to service_role;
grant execute on function public.uso_google(text) to service_role;

-- Trava de campos das configuracoes: modo e ponto de saida sao da taxa.
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

  if (new.delivery_fee_mode, new.market_lat, new.market_lng)
     is distinct from (old.delivery_fee_mode, old.market_lat, old.market_lng)
     and not public.has_permission('config.taxa_entrega') then
    raise exception 'SEM_PERMISSAO' using detail = 'config.taxa_entrega', errcode = '42501';
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

-- Configuracoes publicas: a loja precisa saber o modo (o checkout pede a
-- cotacao ao servidor em vez de olhar a lista de bairros) e as faixas
-- (mostradas na vitrine no lugar dos bairros).
create or replace function public.get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'market_name',             s.market_name,
    'market_phone',            s.market_phone,
    'market_logo_path',        s.market_logo_path,
    'market_address',          s.market_address,
    'delivery_enabled',        (e.estado ->> 'aberto')::boolean,
    'delivery',                e.estado,
    'delivery_hours', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'weekday', h.weekday, 'mode', h.mode,
               'opens_at', to_char(h.opens_at, 'HH24:MI'), 'closes_at', to_char(h.closes_at, 'HH24:MI')
             ) order by h.weekday), '[]'::jsonb)
        from public.delivery_hours h
    ),
    'delivery_fee_mode',       s.delivery_fee_mode,
    'delivery_bands', (
      select coalesce(jsonb_agg(jsonb_build_object('up_to_km', b.up_to_km, 'fee', b.fee)
                                order by b.up_to_km), '[]'::jsonb)
        from public.delivery_distance_bands b
    ),
    'delivery_closed_message', s.delivery_closed_message,
    'min_order_value',         s.min_order_value,
    'pix_key',                 s.pix_key,
    'pix_receiver_name',       s.pix_receiver_name,
    'payment_methods', (
      select coalesce(jsonb_agg(jsonb_build_object('code', pm.code, 'label', pm.label, 'brands', pm.brands)
                                order by pm.sort_order), '[]'::jsonb)
        from public.payment_methods pm
       where pm.is_active
         and (pm.code <> 'voucher' or cardinality(pm.brands) > 0)
    )
  )
  from public.settings s
  cross join lateral (select public.delivery_estado() as estado) e
  where s.id = 1;
$$;

-- Criacao do pedido: igual a 0039, mais o caminho da taxa por distancia.
create or replace function public.create_public_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings   public.settings%rowtype;
  v_phone      text;
  v_name       text;
  v_district   text;
  v_payment    public.payment_method;
  v_brand      text := nullif(btrim(coalesce(p_payload ->> 'payment_brand', '')), '');
  v_needs_ch   boolean := coalesce((p_payload ->> 'needs_change')::boolean, false);
  v_change_for numeric(12,2);
  v_zone       record;
  v_subtotal   numeric(12,2) := 0;
  v_total      numeric(12,2);
  v_expected   numeric(12,2);
  v_customer   uuid;
  v_blocked    boolean;
  v_code       text := lpad(floor(random() * 10000)::int::text, 4, '0');
  v_order      public.orders%rowtype;
  v_items      jsonb := coalesce(p_payload -> 'items', '[]'::jsonb);
  v_check      record;
  v_quote      public.delivery_quotes%rowtype;
begin
  select * into v_settings from public.settings where id = 1;

  -- Aberto/fechado pela regra unica (horario + manual), nao mais pela chave.
  if not (public.delivery_estado() ->> 'aberto')::boolean then
    raise exception 'DELIVERY_FECHADO' using detail = v_settings.delivery_closed_message;
  end if;

  -- Cliente ------------------------------------------------------------------
  v_name  := btrim(coalesce(p_payload -> 'customer' ->> 'name', ''));
  v_phone := public.normalize_phone(p_payload -> 'customer' ->> 'phone');
  if v_name = '' then raise exception 'NOME_OBRIGATORIO'; end if;
  if v_phone is null or v_phone !~ '^[0-9]{10,13}$' then raise exception 'TELEFONE_INVALIDO'; end if;

  select is_blocked into v_blocked from public.customers where phone = v_phone;
  if v_blocked then
    raise exception 'CLIENTE_BLOQUEADO';
  end if;

  -- Itens: precos e disponibilidade SEMPRE do banco ---------------------------
  if jsonb_array_length(v_items) = 0 then raise exception 'CARRINHO_VAZIO'; end if;

  select
      count(*) filter (where p.id is null or not p.is_active)                         as invalidos,
      count(*) filter (where p.id is not null and not p.is_available)                 as indisponiveis,
      string_agg(p.name, ', ') filter (where p.id is not null and not p.is_available) as nomes,
      count(*) filter (where i.quantity is null or i.quantity <= 0)                   as qtd_invalida,
      coalesce(sum(round(i.quantity * p.price, 2)), 0)                                as subtotal
    into v_check
    from jsonb_to_recordset(v_items) as i(product_id uuid, quantity numeric, note text)
    left join public.products p on p.id = i.product_id;

  if v_check.invalidos > 0 then raise exception 'PRODUTO_INEXISTENTE'; end if;
  if v_check.qtd_invalida > 0 then raise exception 'QUANTIDADE_INVALIDA'; end if;
  if v_check.indisponiveis > 0 then
    raise exception 'PRODUTO_INDISPONIVEL' using detail = v_check.nomes;
  end if;

  v_subtotal := v_check.subtotal;

  -- Pedido minimo: SEM a taxa de entrega --------------------------------------
  if v_subtotal < v_settings.min_order_value then
    raise exception 'PEDIDO_MINIMO'
      using detail = jsonb_build_object('faltam', v_settings.min_order_value - v_subtotal,
                                        'minimo', v_settings.min_order_value)::text;
  end if;

  -- Area de entrega -----------------------------------------------------------
  v_district := btrim(coalesce(p_payload -> 'address' ->> 'district', ''));

  if v_settings.delivery_fee_mode = 'distancia' then
    -- Taxa por km: calculada pelo servidor (Google) e gravada numa cotacao
    -- que so ele escreve. Aqui so se confere que ela existe, vale e e deste
    -- endereco - o navegador nunca decide a taxa.
    select * into v_quote
      from public.delivery_quotes
     where id = nullif(p_payload ->> 'delivery_quote', '')::uuid;
    if not found or v_quote.expires_at < now() then
      raise exception 'COTACAO_EXPIRADA';
    end if;
    if v_quote.fee is null or v_quote.origem not in ('distancia', 'bairro') then
      raise exception 'FORA_DA_AREA' using detail = v_district;
    end if;
    if v_quote.address_key <> public.chave_endereco(
         p_payload -> 'address' ->> 'street', p_payload -> 'address' ->> 'number',
         v_district, p_payload -> 'address' ->> 'cep') then
      raise exception 'COTACAO_ENDERECO';
    end if;
    select v_quote.zone_id as zone_id, v_quote.zone_name as zone_name, v_quote.fee as fee, true as served
      into v_zone;
  else
    select * into v_zone from public.resolve_delivery_fee(v_district);
    if not v_zone.served then
      raise exception 'FORA_DA_AREA' using detail = v_district;
    end if;
  end if;

  v_total := round(v_subtotal + v_zone.fee, 2);

  -- Preco mudou entre o carrinho e a confirmacao? -----------------------------
  v_expected := (p_payload ->> 'expected_total')::numeric;
  if v_expected is not null and v_expected <> v_total then
    raise exception 'PRECO_ALTERADO'
      using detail = jsonb_build_object('total_atual', v_total, 'total_informado', v_expected)::text;
  end if;

  -- Pagamento, bandeira e troco -----------------------------------------------
  v_payment := (p_payload ->> 'payment_method')::public.payment_method;
  if not exists (select 1 from public.payment_methods where code = v_payment and is_active) then
    raise exception 'PAGAMENTO_INDISPONIVEL';
  end if;

  if v_payment = 'voucher' then
    if v_brand is null or not exists (
      select 1 from public.payment_methods where code = 'voucher' and v_brand = any(brands)
    ) then
      raise exception 'BANDEIRA_INVALIDA';
    end if;
  else
    -- Cartao: a lista de bandeiras e so informativa, nada e gravado.
    v_brand := null;
  end if;

  if v_needs_ch then
    if v_payment <> 'dinheiro' then raise exception 'TROCO_SO_DINHEIRO'; end if;
    v_change_for := (p_payload ->> 'change_for')::numeric;
    if v_change_for is null or v_change_for < v_total then
      raise exception 'TROCO_INSUFICIENTE'
        using detail = jsonb_build_object('total', v_total)::text;
    end if;
  end if;

  -- Cliente (deduplicado pelo telefone) ---------------------------------------
  insert into public.customers (phone, name, first_order_at, last_order_at)
  values (v_phone, v_name, now(), now())
  on conflict (phone) do update
     set name = excluded.name, last_order_at = now()
  returning id into v_customer;

  insert into public.customer_addresses
    (customer_id, cep, street, number, district, complement, reference, zone_id)
  values (
    v_customer,
    nullif(btrim(coalesce(p_payload -> 'address' ->> 'cep', '')), ''),
    btrim(coalesce(p_payload -> 'address' ->> 'street', '')),
    btrim(coalesce(p_payload -> 'address' ->> 'number', '')),
    v_district,
    nullif(btrim(coalesce(p_payload -> 'address' ->> 'complement', '')), ''),
    nullif(btrim(coalesce(p_payload -> 'address' ->> 'reference', '')), ''),
    v_zone.zone_id
  );

  -- Pedido --------------------------------------------------------------------
  insert into public.orders (
    customer_id, customer_name, customer_phone,
    address_cep, address_street, address_number, address_district,
    address_complement, address_reference,
    zone_id, zone_name, delivery_fee,
    payment_method, payment_brand, needs_change, change_for, customer_note,
    delivery_code
  ) values (
    v_customer, v_name, v_phone,
    nullif(btrim(coalesce(p_payload -> 'address' ->> 'cep', '')), ''),
    btrim(coalesce(p_payload -> 'address' ->> 'street', '')),
    btrim(coalesce(p_payload -> 'address' ->> 'number', '')),
    v_district,
    nullif(btrim(coalesce(p_payload -> 'address' ->> 'complement', '')), ''),
    nullif(btrim(coalesce(p_payload -> 'address' ->> 'reference', '')), ''),
    v_zone.zone_id, v_zone.zone_name, v_zone.fee,
    v_payment, v_brand, v_needs_ch, v_change_for,
    nullif(btrim(coalesce(p_payload ->> 'note', '')), ''),
    v_code
  )
  returning * into v_order;

  insert into public.order_items (
    order_id, product_id, product_name, unit_type, sold_by_weight,
    unit_price, requested_quantity, note
  )
  select v_order.id, p.id, p.name, p.unit_type, p.sold_by_weight,
         p.price, i.quantity, nullif(btrim(coalesce(i.note, '')), '')
    from jsonb_to_recordset(v_items) as i(product_id uuid, quantity numeric, note text)
    join public.products p on p.id = i.product_id;

  select * into v_order from public.orders where id = v_order.id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'public_token', v_order.public_token,
    'total',        v_order.total,
    'delivery_fee', v_order.delivery_fee,
    'change_amount',v_order.change_amount
  );
end;
$$;
