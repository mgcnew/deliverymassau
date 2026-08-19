-- =============================================================================
-- 0015 - Cidade do mercado
-- Sem cidade, Google Maps e Waze navegam so com rua e bairro e erram bastante.
-- Tambem entra no cabecalho da impressao.
-- =============================================================================

alter table public.settings add column if not exists market_city text;

comment on column public.settings.market_city is
  'Cidade/UF usada para montar os links de Google Maps e Waze e o cabecalho da impressao. Sem ela o app navega so com rua e bairro.';

-- Recria a guarda incluindo a coluna nova em config.mercado
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

  if (new.delivery_enabled, new.delivery_closed_message)
     is distinct from (old.delivery_enabled, old.delivery_closed_message)
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
