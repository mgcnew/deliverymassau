-- =============================================================================
-- 0035 - Pagina do pedido do cliente atualiza sozinha
--
-- O painel ja recebia em tempo real (postgres_changes em orders), mas a
-- pagina /pedido/[token] nao escutava nada: o cliente so via "Separando" ou
-- "Saiu para entrega" recarregando. E postgres_changes nao serve pra ele: o
-- cliente e anonimo, e a RLS de orders (corretamente) nao deixa anonimo ler
-- pedido - o Realtime aplica a mesma RLS e nao entregaria evento nenhum.
--
-- Aqui o proprio banco avisa: toda mudanca no pedido manda um broadcast no
-- topico "pedido:<public_token>", e a pagina do cliente, ao receber, busca de
-- novo pelo RPC de sempre (get_order_by_token).
--
-- Seguranca:
--   - o topico usa o mesmo token do link: quem consegue escutar ja podia
--     abrir a pagina do pedido. Canal publico (private = false), sem RLS.
--   - o aviso vai VAZIO. Nenhum dado do pedido passa pelo Realtime; o que
--     aparece na tela continua vindo do RPC.
--
-- Pesagem e falta de item mexem em order_items, que recalcula os totais com
-- um UPDATE em orders (recalc_order_totals) - por isso o gatilho so em orders
-- ja cobre status, peso, item em falta e cancelamento.
-- =============================================================================

create or replace function public.trg_orders_aviso_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send('{}'::jsonb, 'pedido_atualizado', 'pedido:' || new.public_token, false);
  return null;
exception when others then
  -- Aviso ao vivo e conforto, nao regra: se o Realtime falhar, a mudanca no
  -- pedido tem que valer do mesmo jeito (a pagina ainda atualiza pelo
  -- intervalo e ao voltar para a tela).
  return null;
end;
$$;

revoke all on function public.trg_orders_aviso_cliente() from public;

create trigger trg_orders_aviso_cliente
  after update on public.orders
  for each row
  when (old is distinct from new)
  execute function public.trg_orders_aviso_cliente();
