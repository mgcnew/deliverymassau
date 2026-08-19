-- =============================================================================
-- 0013 - Correcoes encontradas no teste de permissoes granulares
--
-- (1) products tem indice sobre normalize_text(name) e zone_neighborhoods tem
--     coluna gerada com a mesma funcao. Reavaliar a expressao exige EXECUTE
--     para o papel que escreve. Sem o grant, QUALQUER update de produto morria
--     com "permission denied for function normalize_text".
--
-- (2) As guardas de campo comparam a permissao de auth.uid(). Sem usuario
--     logado (service_role, manutencao pelo SQL editor) elas travavam ate o
--     administrador do banco. Para o anon nao ha risco: a RLS ja nega a escrita
--     antes de o trigger rodar.
-- =============================================================================

grant execute on function public.normalize_text(text) to authenticated;
grant execute on function public.normalize_phone(text) to authenticated;

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

  if (new.market_name, new.market_phone, new.market_logo_path, new.market_address, new.timezone)
     is distinct from
     (old.market_name, old.market_phone, old.market_logo_path, old.market_address, old.timezone)
     and not public.has_permission('config.mercado') then
    raise exception 'SEM_PERMISSAO' using detail = 'config.mercado', errcode = '42501';
  end if;

  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.trg_products_campos_sensiveis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.has_permission('produtos.editar') then
    if new.is_active is distinct from old.is_active
       and not public.has_permission('produtos.desativar') then
      raise exception 'SEM_PERMISSAO' using detail = 'produtos.desativar', errcode = '42501';
    end if;

    if (new.name, new.category_id, new.price, new.unit_type, new.sold_by_weight,
        new.short_description, new.image_path, new.slug, new.sort_order,
        new.weight_step, new.min_weight)
       is distinct from
       (old.name, old.category_id, old.price, old.unit_type, old.sold_by_weight,
        old.short_description, old.image_path, old.slug, old.sort_order,
        old.weight_step, old.min_weight) then
      raise exception 'SEM_PERMISSAO' using detail = 'produtos.editar', errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.trg_profiles_campos_sensiveis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (new.preset_id is distinct from old.preset_id
      or new.is_active is distinct from old.is_active)
     and not (public.has_permission('equipe.editar')
              or public.has_permission('equipe.alterar_permissoes')) then
    raise exception 'SEM_PERMISSAO' using detail = 'equipe.editar', errcode = '42501';
  end if;
  return new;
end;
$$;
