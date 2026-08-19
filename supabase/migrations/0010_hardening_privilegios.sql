-- =============================================================================
-- 0010 - Endurecimento: search_path fixo e superficie de RPC minima
-- Por padrao o Supabase concede EXECUTE de todas as funcoes a anon/authenticated.
-- Aqui revogamos tudo e devolvemos apenas o que cada papel realmente precisa.
-- =============================================================================

alter function public.set_updated_at()                    set search_path = public;
alter function public.normalize_text(text)                set search_path = public, extensions;
alter function public.normalize_phone(text)               set search_path = public;
alter function public.trg_order_item_totais()             set search_path = public;
alter function public.trg_orders_total()                  set search_path = public;
alter function public.trg_orders_status()                 set search_path = public;
alter function public.order_status_can_move(public.order_status, public.order_status)
                                                          set search_path = public;

-- Permissoes do usuario logado (para montar o menu do painel)
create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select public.effective_permissions(auth.uid());
$$;

revoke all on all functions in schema public from anon, authenticated;

-- Portal publico
grant execute on function public.get_public_settings()               to anon, authenticated;
grant execute on function public.create_public_order(jsonb)          to anon, authenticated;
grant execute on function public.get_order_by_token(text)            to anon, authenticated;
grant execute on function public.resolve_delivery_fee(text, text)    to anon, authenticated;

-- Necessarias para as policies de RLS avaliarem permissao
grant execute on function public.has_permission(text, uuid)          to authenticated;
grant execute on function public.is_staff(uuid)                      to authenticated;
grant execute on function public.my_permissions()                    to authenticated;

-- Operacao interna
grant execute on function public.set_user_permissions(uuid, uuid, text[]) to authenticated;
grant execute on function public.bootstrap_first_admin(text, text)   to authenticated;
grant execute on function public.start_separation(uuid)              to authenticated;
grant execute on function public.set_item_weight(uuid, numeric)      to authenticated;
grant execute on function public.set_item_status(uuid, public.order_item_status) to authenticated;
grant execute on function public.finish_separation(uuid)             to authenticated;
grant execute on function public.cancel_order(uuid, text)            to authenticated;
grant execute on function public.claim_delivery(uuid)                to authenticated;
grant execute on function public.release_delivery(uuid)              to authenticated;
grant execute on function public.start_delivery(uuid)                to authenticated;
grant execute on function public.finish_delivery(uuid)               to authenticated;
