-- =============================================================================
-- 0016 - Indicadores do dia e upload da logo
-- O "hoje" e calculado no fuso do mercado (settings.timezone), nao no do
-- servidor: num delivery 24h isso decide de que dia e o pedido feito 00h10.
-- =============================================================================

create or replace function public.dashboard_hoje()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz        text;
  v_inicio    timestamptz;
  v_entregues integer;
  v_receita   numeric(12,2);
  v_resultado jsonb;
begin
  if not public.has_permission('dashboard.ver') then
    raise exception 'SEM_PERMISSAO' using detail = 'dashboard.ver', errcode = '42501';
  end if;

  select timezone into v_tz from public.settings where id = 1;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');

  v_inicio := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;

  select count(*) filter (where o.status = 'entregue' and o.created_at >= v_inicio),
         coalesce(sum(o.total) filter (where o.status = 'entregue' and o.created_at >= v_inicio), 0)
    into v_entregues, v_receita
    from public.orders o;

  select jsonb_build_object(
    'fuso',                  v_tz,
    'inicio_do_dia',         v_inicio,
    'pedidos_hoje',          count(*) filter (where created_at >= v_inicio),
    'entregues_hoje',        v_entregues,
    'cancelados_hoje',       count(*) filter (where created_at >= v_inicio and status = 'cancelado'),
    'faturamento_hoje',      v_receita,
    'ticket_medio',          case when v_entregues > 0 then round(v_receita / v_entregues, 2) else 0 end,
    'em_aberto',             count(*) filter (where status in ('recebido','separando','aguardando_entregador','saiu_para_entrega')),
    'novos',                 count(*) filter (where status = 'recebido'),
    'em_separacao',          count(*) filter (where status = 'separando'),
    'aguardando_entregador', count(*) filter (where status = 'aguardando_entregador'),
    'saiu_para_entrega',     count(*) filter (where status = 'saiu_para_entrega')
  )
    into v_resultado
    from public.orders;

  return v_resultado;
end;
$$;

revoke all on function public.dashboard_hoje() from public;
grant execute on function public.dashboard_hoje() to authenticated;

drop policy if exists "produtos_imagens_upload" on storage.objects;
create policy "produtos_imagens_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'produtos'
    and ((select public.has_permission('produtos.criar'))
         or (select public.has_permission('produtos.editar'))
         or (select public.has_permission('config.mercado')))
  );
