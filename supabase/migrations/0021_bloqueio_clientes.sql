-- =============================================================================
-- 0021 - Bloqueio de cliente
-- Permite impedir um cliente especifico de fazer novos pedidos, sem afetar
-- o historico dele nem pedidos ja em andamento.
-- =============================================================================

alter table public.customers
  add column is_blocked     boolean not null default false,
  add column blocked_at     timestamptz,
  add column blocked_reason text;

-- Permissao nova -------------------------------------------------------------
insert into public.permissions (code, module, label, description, sort_order) values
  ('clientes.bloquear', 'Clientes', 'Bloquear cliente', 'Impede novos pedidos desse cliente', 51)
on conflict (code) do nothing;

-- Administrador ja tem tudo por preset (cross join), mas o preset so roda
-- insert automatico pra codigos novos se o admin recriar o vinculo -- entao
-- concede explicitamente pra quem ja existe.
insert into public.preset_permissions (preset_id, permission_code)
select p.id, 'clientes.bloquear'
  from public.permission_presets p
 where p.slug = 'administrador'
on conflict do nothing;

-- RLS: so quem tem a permissao pode alterar o bloqueio ------------------------
create policy customers_update on public.customers
  for update to authenticated
  using ((select public.has_permission('clientes.bloquear')))
  with check ((select public.has_permission('clientes.bloquear')));

-- Barra pedido novo de cliente bloqueado --------------------------------------
-- Copia identica de public.create_public_order (0006_rpcs_publicas.sql) com
-- duas linhas adicionadas: declaracao de v_blocked e a checagem logo apos
-- validar o telefone.
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
  v_needs_ch   boolean := coalesce((p_payload ->> 'needs_change')::boolean, false);
  v_change_for numeric(12,2);
  v_zone       record;
  v_subtotal   numeric(12,2) := 0;
  v_total      numeric(12,2);
  v_expected   numeric(12,2);
  v_customer   uuid;
  v_blocked    boolean;
  v_order      public.orders%rowtype;
  v_items      jsonb := coalesce(p_payload -> 'items', '[]'::jsonb);
  v_check      record;
begin
  select * into v_settings from public.settings where id = 1;

  if not v_settings.delivery_enabled then
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
  select * into v_zone from public.resolve_delivery_fee(v_district);
  if not v_zone.served then
    raise exception 'FORA_DA_AREA' using detail = v_district;
  end if;

  v_total := round(v_subtotal + v_zone.fee, 2);

  -- Preco mudou entre o carrinho e a confirmacao? -----------------------------
  v_expected := (p_payload ->> 'expected_total')::numeric;
  if v_expected is not null and v_expected <> v_total then
    raise exception 'PRECO_ALTERADO'
      using detail = jsonb_build_object('total_atual', v_total, 'total_informado', v_expected)::text;
  end if;

  -- Pagamento e troco ---------------------------------------------------------
  v_payment := (p_payload ->> 'payment_method')::public.payment_method;
  if not exists (select 1 from public.payment_methods where code = v_payment and is_active) then
    raise exception 'PAGAMENTO_INDISPONIVEL';
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
    payment_method, needs_change, change_for, customer_note
  ) values (
    v_customer, v_name, v_phone,
    nullif(btrim(coalesce(p_payload -> 'address' ->> 'cep', '')), ''),
    btrim(coalesce(p_payload -> 'address' ->> 'street', '')),
    btrim(coalesce(p_payload -> 'address' ->> 'number', '')),
    v_district,
    nullif(btrim(coalesce(p_payload -> 'address' ->> 'complement', '')), ''),
    nullif(btrim(coalesce(p_payload -> 'address' ->> 'reference', '')), ''),
    v_zone.zone_id, v_zone.zone_name, v_zone.fee,
    v_payment, v_needs_ch, v_change_for,
    nullif(btrim(coalesce(p_payload ->> 'note', '')), '')
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

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;
