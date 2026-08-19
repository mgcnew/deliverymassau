-- =============================================================================
-- 0011 - Fecha a superficie da API
-- Por padrao o Postgres concede EXECUTE de toda funcao ao papel PUBLIC, e
-- anon/authenticated herdam dele. Aqui revogamos de PUBLIC e devolvemos apenas
-- as funcoes que sao API de verdade. Triggers continuam funcionando: o Postgres
-- checa EXECUTE na criacao do trigger, nao a cada disparo.
-- Resultado: anon so enxerga get_public_settings, create_public_order,
-- get_order_by_token e resolve_delivery_fee.
-- =============================================================================

revoke all on all functions in schema public from public;

grant execute on function public.get_public_settings()               to anon, authenticated;
grant execute on function public.create_public_order(jsonb)          to anon, authenticated;
grant execute on function public.get_order_by_token(text)            to anon, authenticated;
grant execute on function public.resolve_delivery_fee(text, text)    to anon, authenticated;

grant execute on function public.has_permission(text, uuid)          to authenticated;
grant execute on function public.is_staff(uuid)                      to authenticated;
grant execute on function public.my_permissions()                    to authenticated;

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
