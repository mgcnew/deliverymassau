-- =============================================================================
-- 0025 - Indices para FKs sem cobertura (achado do linter de performance)
-- Todas apontam pra profiles(id) on delete set null: sem indice, apagar um
-- profile obriga o Postgres a varrer cada uma dessas tabelas inteira pra
-- achar as linhas que precisam virar null. Hoje profile nao se apaga (so
-- desativa), mas o indice e barato e evita a surpresa se isso mudar.
-- =============================================================================

create index if not exists idx_audit_log_actor on public.audit_log (actor_id);
create index if not exists idx_delivery_assignments_liberado_por on public.delivery_assignments (released_by);
create index if not exists idx_order_items_separado_por on public.order_items (separated_by);
create index if not exists idx_order_status_history_alterado_por on public.order_status_history (changed_by);
create index if not exists idx_orders_cancelado_por on public.orders (cancelled_by);
create index if not exists idx_orders_separado_por on public.orders (separated_by);
create index if not exists idx_profiles_criado_por on public.profiles (created_by);
create index if not exists idx_settings_atualizado_por on public.settings (updated_by);
create index if not exists idx_user_permissions_concedido_por on public.user_permissions (granted_by);
