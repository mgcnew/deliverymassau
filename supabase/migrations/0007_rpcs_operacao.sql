-- =============================================================================
-- 0007 - RPCs de operacao interna (separacao, status, entregas)
-- Toda escrita operacional passa por funcao com checagem de permissao.
-- =============================================================================

create or replace function public.assert_permission(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission(p_code) then
    raise exception 'SEM_PERMISSAO' using detail = p_code, errcode = '42501';
  end if;
end;
$$;

create or replace function public.start_separation(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_permission('pedidos.separar');
  update public.orders
     set status = 'separando', separated_by = auth.uid()
   where id = p_order_id and status = 'recebido';
  if not found then raise exception 'PEDIDO_NAO_ESTA_RECEBIDO'; end if;
end;
$$;

create or replace function public.set_item_weight(p_item_id uuid, p_weight numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_sold boolean; v_status public.order_status;
begin
  perform public.assert_permission('pedidos.ajustar_peso');

  select i.sold_by_weight, o.status into v_sold, v_status
    from public.order_items i join public.orders o on o.id = i.order_id
   where i.id = p_item_id;

  if not found then raise exception 'ITEM_NAO_ENCONTRADO'; end if;
  if v_status <> 'separando' then raise exception 'PEDIDO_NAO_ESTA_EM_SEPARACAO'; end if;
  if not v_sold then raise exception 'ITEM_NAO_E_POR_PESO'; end if;
  if p_weight is null or p_weight <= 0 then raise exception 'PESO_INVALIDO'; end if;

  update public.order_items
     set weighed_quantity = p_weight,
         item_status      = 'separado',
         separated_by     = auth.uid(),
         separated_at     = now()
   where id = p_item_id;
end;
$$;

create or replace function public.set_item_status(p_item_id uuid, p_status public.order_item_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status public.order_status;
begin
  if p_status = 'indisponivel' then
    perform public.assert_permission('pedidos.marcar_indisponivel');
  else
    perform public.assert_permission('pedidos.separar');
  end if;

  select o.status into v_status
    from public.order_items i join public.orders o on o.id = i.order_id
   where i.id = p_item_id;
  if not found then raise exception 'ITEM_NAO_ENCONTRADO'; end if;
  if v_status <> 'separando' then raise exception 'PEDIDO_NAO_ESTA_EM_SEPARACAO'; end if;

  update public.order_items
     set item_status  = p_status,
         separated_by = auth.uid(),
         separated_at = now()
   where id = p_item_id;
end;
$$;

create or replace function public.finish_separation(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_permission('pedidos.separar');
  if exists (select 1 from public.order_items
              where order_id = p_order_id and item_status = 'pendente') then
    raise exception 'ITENS_PENDENTES';
  end if;
  update public.orders set status = 'aguardando_entregador'
   where id = p_order_id and status = 'separando';
  if not found then raise exception 'PEDIDO_NAO_ESTA_EM_SEPARACAO'; end if;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_permission('pedidos.cancelar');
  if coalesce(btrim(p_reason), '') = '' then raise exception 'MOTIVO_OBRIGATORIO'; end if;
  update public.orders
     set status = 'cancelado', cancel_reason = p_reason, cancelled_by = auth.uid()
   where id = p_order_id and status <> 'entregue' and status <> 'cancelado';
  if not found then raise exception 'PEDIDO_NAO_PODE_SER_CANCELADO'; end if;
end;
$$;

-- Entregas ---------------------------------------------------------------------
create or replace function public.claim_delivery(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_rows integer;
begin
  perform public.assert_permission('entregas.assumir');

  update public.orders
     set delivery_person_id = auth.uid(), assigned_at = now()
   where id = p_order_id
     and delivery_person_id is null
     and status = 'aguardando_entregador';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'ENTREGA_JA_ASSUMIDA'; end if;

  insert into public.delivery_assignments (order_id, delivery_person_id)
  values (p_order_id, auth.uid());
end;
$$;

create or replace function public.release_delivery(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.has_permission('entregas.atribuir')
          or exists (select 1 from public.orders
                      where id = p_order_id and delivery_person_id = auth.uid())) then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;

  update public.orders
     set delivery_person_id = null, assigned_at = null
   where id = p_order_id and status = 'aguardando_entregador';
  if not found then raise exception 'ENTREGA_JA_INICIADA'; end if;

  update public.delivery_assignments
     set released_at = now(), released_by = auth.uid()
   where order_id = p_order_id and released_at is null;
end;
$$;

create or replace function public.start_delivery(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_permission('entregas.iniciar');
  update public.orders set status = 'saiu_para_entrega'
   where id = p_order_id
     and status = 'aguardando_entregador'
     and delivery_person_id = auth.uid();
  if not found then raise exception 'ENTREGA_NAO_DISPONIVEL'; end if;
end;
$$;

create or replace function public.finish_delivery(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_permission('entregas.finalizar');
  update public.orders set status = 'entregue'
   where id = p_order_id
     and status = 'saiu_para_entrega'
     and (delivery_person_id = auth.uid() or public.has_permission('entregas.ver_todas'));
  if not found then raise exception 'ENTREGA_NAO_DISPONIVEL'; end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'assert_permission(text)',
    'start_separation(uuid)',
    'set_item_weight(uuid, numeric)',
    'set_item_status(uuid, public.order_item_status)',
    'finish_separation(uuid)',
    'cancel_order(uuid, text)',
    'claim_delivery(uuid)',
    'release_delivery(uuid)',
    'start_delivery(uuid)',
    'finish_delivery(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
