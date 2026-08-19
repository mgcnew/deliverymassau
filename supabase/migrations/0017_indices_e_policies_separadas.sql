-- =============================================================================
-- 0017 - Refino apontado pelos advisors do Supabase
--
-- (1) Indices cobrindo as chaves estrangeiras que sao realmente consultadas.
--     As colunas de autoria (actor_id, separated_by, cancelled_by...) ficaram
--     de fora de proposito: elas so seriam varridas num DELETE de funcionario,
--     que nao acontece (a equipe usa desativacao logica), e o indice custaria
--     escrita em todo pedido.
--
-- (2) Policy "for all" tambem vale para SELECT: cada leitura avaliava duas
--     policies. Separando a escrita, sobra uma por leitura.
-- =============================================================================

create index if not exists idx_order_items_produto on public.order_items (product_id);
create index if not exists idx_orders_zona on public.orders (zone_id);
create index if not exists idx_profiles_preset on public.profiles (preset_id);
create index if not exists idx_preset_permissions_codigo on public.preset_permissions (permission_code);
create index if not exists idx_user_permissions_codigo on public.user_permissions (permission_code);
create index if not exists idx_customer_addresses_zona on public.customer_addresses (zone_id);

drop policy if exists categories_write on public.categories;
create policy categories_insert on public.categories
  for insert to authenticated with check ((select public.has_permission('categorias.gerenciar')));
create policy categories_update on public.categories
  for update to authenticated
  using ((select public.has_permission('categorias.gerenciar')))
  with check ((select public.has_permission('categorias.gerenciar')));
create policy categories_delete on public.categories
  for delete to authenticated using ((select public.has_permission('categorias.gerenciar')));

drop policy if exists zones_write on public.delivery_zones;
create policy zones_insert on public.delivery_zones
  for insert to authenticated with check ((select public.has_permission('config.taxa_entrega')));
create policy zones_update on public.delivery_zones
  for update to authenticated
  using ((select public.has_permission('config.taxa_entrega')))
  with check ((select public.has_permission('config.taxa_entrega')));
create policy zones_delete on public.delivery_zones
  for delete to authenticated using ((select public.has_permission('config.taxa_entrega')));

drop policy if exists zone_bairros_write on public.zone_neighborhoods;
create policy zone_bairros_insert on public.zone_neighborhoods
  for insert to authenticated with check ((select public.has_permission('config.taxa_entrega')));
create policy zone_bairros_update on public.zone_neighborhoods
  for update to authenticated
  using ((select public.has_permission('config.taxa_entrega')))
  with check ((select public.has_permission('config.taxa_entrega')));
create policy zone_bairros_delete on public.zone_neighborhoods
  for delete to authenticated using ((select public.has_permission('config.taxa_entrega')));

drop policy if exists presets_write on public.permission_presets;
create policy presets_insert on public.permission_presets
  for insert to authenticated with check ((select public.has_permission('equipe.alterar_permissoes')));
create policy presets_update on public.permission_presets
  for update to authenticated
  using ((select public.has_permission('equipe.alterar_permissoes')))
  with check ((select public.has_permission('equipe.alterar_permissoes')));

drop policy if exists preset_permissions_write on public.preset_permissions;
create policy preset_permissions_insert on public.preset_permissions
  for insert to authenticated with check ((select public.has_permission('equipe.alterar_permissoes')));
create policy preset_permissions_delete on public.preset_permissions
  for delete to authenticated using ((select public.has_permission('equipe.alterar_permissoes')));
