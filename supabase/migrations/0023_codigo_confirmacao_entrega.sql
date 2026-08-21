-- =============================================================================
-- 0023 - Codigo de confirmacao de entrega
-- PIN de 4 digitos, aleatorio, gerado na criacao do pedido. So o cliente ve
-- (pagina publica de acompanhamento) -- o entregador NUNCA enxerga esse
-- numero em nenhuma tela dele, so digita o que o cliente falar na porta.
-- Reaproveitar o numero do pedido como "codigo" nao funcionaria: o
-- entregador ja ve o numero do pedido no proprio app, entao nao provaria
-- nada.
-- =============================================================================

alter table public.orders
  add column delivery_code text;

-- Cria o pedido publico (mesma funcao de 0021_bloqueio_clientes.sql, com o
-- codigo de entrega sendo gerado e gravado junto).
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
  v_code       text := lpad(floor(random() * 10000)::int::text, 4, '0');
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
    payment_method, needs_change, change_for, customer_note,
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
    v_payment, v_needs_ch, v_change_for,
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

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;

-- Cliente ve o proprio codigo pela pagina publica de acompanhamento ----------
create or replace function public.get_order_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order_number',   o.order_number,
    'status',         o.status,
    'created_at',     o.created_at,
    'customer_name',  o.customer_name,
    'delivery_code',  o.delivery_code,
    'address', jsonb_build_object(
      'street', o.address_street, 'number', o.address_number,
      'district', o.address_district, 'complement', o.address_complement,
      'reference', o.address_reference, 'cep', o.address_cep
    ),
    'items_subtotal_estimated', o.items_subtotal_estimated,
    'items_subtotal_final',     o.items_subtotal_final,
    'delivery_fee',   o.delivery_fee,
    'total',          o.total,
    'payment_method', o.payment_method,
    'needs_change',   o.needs_change,
    'change_for',     o.change_for,
    'change_amount',  o.change_amount,
    'customer_note',  o.customer_note,
    'delivered_at',   o.delivered_at,
    'cancel_reason',  o.cancel_reason,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_name',       i.product_name,
        'unit_type',          i.unit_type,
        'sold_by_weight',     i.sold_by_weight,
        'unit_price',         i.unit_price,
        'requested_quantity', i.requested_quantity,
        'weighed_quantity',   i.weighed_quantity,
        'estimated_total',    i.estimated_total,
        'final_total',        i.final_total,
        'item_status',        i.item_status,
        'note',               i.note
      ) order by i.created_at), '[]'::jsonb)
      from public.order_items i where i.order_id = o.id
    ),
    'history', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'to_status', h.to_status, 'created_at', h.created_at
      ) order by h.created_at), '[]'::jsonb)
      from public.order_status_history h where h.order_id = o.id
    )
  )
  from public.orders o
  where o.public_token = p_token;
$$;

revoke all on function public.get_order_by_token(text) from public;
grant execute on function public.get_order_by_token(text) to anon, authenticated;

-- Exige o codigo pra finalizar a entrega --------------------------------------
-- Assinatura mudou (ganhou p_code) -- se nao apagar a versao antiga de um
-- parametro so, ela continua valendo e da pra finalizar sem codigo nenhum.
drop function if exists public.finish_delivery(uuid);

create or replace function public.finish_delivery(p_order_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  perform public.assert_permission('entregas.finalizar');

  select delivery_code into v_code
    from public.orders
   where id = p_order_id
     and status = 'saiu_para_entrega'
     and (delivery_person_id = auth.uid() or public.has_permission('entregas.ver_todas'));

  if not found then raise exception 'ENTREGA_NAO_DISPONIVEL'; end if;

  if v_code is distinct from btrim(coalesce(p_code, '')) then
    raise exception 'CODIGO_INVALIDO';
  end if;

  update public.orders set status = 'entregue' where id = p_order_id;
end;
$$;

revoke all on function public.finish_delivery(uuid, text) from public;
grant execute on function public.finish_delivery(uuid, text) to authenticated;
