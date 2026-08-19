-- =============================================================================
-- 0008 - Row Level Security
-- Regra: sem policy = sem acesso. O cliente publico so enxerga catalogo ativo.
-- has_permission e SECURITY DEFINER, por isso nao ha recursao aqui.
-- =============================================================================

-- Catalogo de permissoes e presets ---------------------------------------------
create policy permissions_select on public.permissions
  for select to authenticated using ((select public.is_staff()));

create policy presets_select on public.permission_presets
  for select to authenticated using ((select public.is_staff()));
create policy presets_write on public.permission_presets
  for all to authenticated
  using ((select public.has_permission('equipe.alterar_permissoes')))
  with check ((select public.has_permission('equipe.alterar_permissoes')));

create policy preset_permissions_select on public.preset_permissions
  for select to authenticated using ((select public.is_staff()));
create policy preset_permissions_write on public.preset_permissions
  for all to authenticated
  using ((select public.has_permission('equipe.alterar_permissoes')))
  with check ((select public.has_permission('equipe.alterar_permissoes')));

-- Equipe ------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.has_permission('equipe.ver')));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ((select public.has_permission('equipe.cadastrar')));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.has_permission('equipe.editar')))
  with check (id = (select auth.uid()) or (select public.has_permission('equipe.editar')));

-- Ninguem muda preset/ativacao de si mesmo sem permissao de equipe
create or replace function public.trg_profiles_campos_sensiveis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.preset_id is distinct from old.preset_id
      or new.is_active is distinct from old.is_active)
     and not (public.has_permission('equipe.editar')
              or public.has_permission('equipe.alterar_permissoes')) then
    raise exception 'SEM_PERMISSAO' using detail = 'equipe.editar', errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_campos_sensiveis
  before update on public.profiles
  for each row execute function public.trg_profiles_campos_sensiveis();

-- Overrides: leitura sim, escrita somente pela RPC set_user_permissions
create policy user_permissions_select on public.user_permissions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_permission('equipe.ver')));

-- Catalogo ----------------------------------------------------------------------
create policy categories_select_anon on public.categories
  for select to anon using (is_active);
create policy categories_select_staff on public.categories
  for select to authenticated
  using (is_active or (select public.has_permission('produtos.ver'))
                   or (select public.has_permission('categorias.gerenciar')));
create policy categories_write on public.categories
  for all to authenticated
  using ((select public.has_permission('categorias.gerenciar')))
  with check ((select public.has_permission('categorias.gerenciar')));

create policy products_select_anon on public.products
  for select to anon using (is_active);
create policy products_select_staff on public.products
  for select to authenticated
  using (is_active or (select public.has_permission('produtos.ver')));
create policy products_insert on public.products
  for insert to authenticated
  with check ((select public.has_permission('produtos.criar')));
create policy products_update on public.products
  for update to authenticated
  using ((select public.has_permission('produtos.editar'))
      or (select public.has_permission('produtos.desativar'))
      or (select public.has_permission('produtos.alterar_disponibilidade')))
  with check (true);

-- Quem so pode alterar disponibilidade nao mexe em preco, nome, categoria...
create or replace function public.trg_products_campos_sensiveis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger trg_products_campos_sensiveis
  before update on public.products
  for each row execute function public.trg_products_campos_sensiveis();

-- Zonas de entrega ---------------------------------------------------------------
create policy zones_select_anon on public.delivery_zones
  for select to anon using (is_active);
create policy zones_select_staff on public.delivery_zones
  for select to authenticated using ((select public.is_staff()));
create policy zones_write on public.delivery_zones
  for all to authenticated
  using ((select public.has_permission('config.taxa_entrega')))
  with check ((select public.has_permission('config.taxa_entrega')));

create policy zone_bairros_select_anon on public.zone_neighborhoods
  for select to anon
  using (exists (select 1 from public.delivery_zones z where z.id = zone_id and z.is_active));
create policy zone_bairros_select_staff on public.zone_neighborhoods
  for select to authenticated using ((select public.is_staff()));
create policy zone_bairros_write on public.zone_neighborhoods
  for all to authenticated
  using ((select public.has_permission('config.taxa_entrega')))
  with check ((select public.has_permission('config.taxa_entrega')));

-- Clientes -------------------------------------------------------------------------
create policy customers_select on public.customers
  for select to authenticated using ((select public.has_permission('clientes.ver')));
create policy customer_addresses_select on public.customer_addresses
  for select to authenticated using ((select public.has_permission('clientes.ver')));

-- Pedidos ---------------------------------------------------------------------------
-- Balconista ve tudo; entregador sem pedidos.ver ve a fila livre e as proprias entregas.
create policy orders_select on public.orders
  for select to authenticated
  using (
    (select public.has_permission('pedidos.ver'))
    or (
      (select public.has_permission('entregas.ver'))
      and (
        delivery_person_id = (select auth.uid())
        or (status = 'aguardando_entregador' and delivery_person_id is null)
        or (select public.has_permission('entregas.ver_todas'))
      )
    )
  );

create policy orders_update on public.orders
  for update to authenticated
  using ((select public.has_permission('pedidos.editar')))
  with check ((select public.has_permission('pedidos.editar')));

create policy order_items_select on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy order_items_update on public.order_items
  for update to authenticated
  using ((select public.has_permission('pedidos.editar')))
  with check ((select public.has_permission('pedidos.editar')));

create policy order_history_select on public.order_status_history
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy delivery_assignments_select on public.delivery_assignments
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- Configuracoes ----------------------------------------------------------------------
create policy settings_select on public.settings
  for select to authenticated using ((select public.is_staff()));
create policy settings_update on public.settings
  for update to authenticated
  using ((select public.has_permission('config.acessar')))
  with check ((select public.has_permission('config.acessar')));

-- Cada bloco de configuracao exige sua propria permissao (nao basta config.acessar)
create or replace function public.trg_settings_permissoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger trg_settings_permissoes
  before update on public.settings
  for each row execute function public.trg_settings_permissoes();

create policy payment_methods_select_anon on public.payment_methods
  for select to anon using (is_active);
create policy payment_methods_select_staff on public.payment_methods
  for select to authenticated using ((select public.is_staff()));
create policy payment_methods_update on public.payment_methods
  for update to authenticated
  using ((select public.has_permission('config.pagamentos')))
  with check ((select public.has_permission('config.pagamentos')));

-- Auditoria: somente leitura, para quem administra ------------------------------------
create policy audit_log_select on public.audit_log
  for select to authenticated using ((select public.has_permission('config.acessar')));

-- Realtime -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.order_status_history;
