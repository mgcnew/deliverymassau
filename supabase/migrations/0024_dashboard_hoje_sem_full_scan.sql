-- =============================================================================
-- 0024 - dashboard_hoje sem varredura completa da tabela orders
-- A versao anterior usava "count(*) filter (where ...)" num SELECT sem
-- WHERE, o que obriga o Postgres a ler TODA a tabela orders em toda
-- chamada (a tela mais visitada do painel). Funciona bem com poucos
-- pedidos, mas piora a cada mes de historico acumulado, mesmo com os
-- indices certos ja existindo (idx_orders_data, idx_orders_operacional) --
-- eles so ajudam se a consulta tiver um WHERE de verdade.
-- Divide em duas consultas, cada uma com WHERE que casa com um indice:
-- uma por data (numeros de "hoje") e outra por status (contadores
-- operacionais, que valem pro pedido atual independente de quando foi
-- feito).
-- =============================================================================

create or replace function public.dashboard_hoje()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz         text;
  v_inicio     timestamptz;
  v_pedidos    integer;
  v_entregues  integer;
  v_cancelados integer;
  v_receita    numeric(12,2);
  v_em_aberto      integer;
  v_novos          integer;
  v_em_separacao   integer;
  v_aguardando     integer;
  v_saiu           integer;
  v_resultado  jsonb;
begin
  if not public.has_permission('dashboard.ver') then
    raise exception 'SEM_PERMISSAO' using detail = 'dashboard.ver', errcode = '42501';
  end if;

  select timezone into v_tz from public.settings where id = 1;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');

  v_inicio := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;

  -- Usa idx_orders_data (created_at desc): so le os pedidos de hoje, nunca
  -- o historico inteiro.
  select count(*),
         count(*) filter (where status = 'entregue'),
         coalesce(sum(total) filter (where status = 'entregue'), 0),
         count(*) filter (where status = 'cancelado')
    into v_pedidos, v_entregues, v_receita, v_cancelados
    from public.orders
   where created_at >= v_inicio;

  -- Usa idx_orders_operacional (status, created_at desc): pedidos em
  -- aberto sao sempre um punhado, nao importa o tamanho do historico.
  select count(*),
         count(*) filter (where status = 'recebido'),
         count(*) filter (where status = 'separando'),
         count(*) filter (where status = 'aguardando_entregador'),
         count(*) filter (where status = 'saiu_para_entrega')
    into v_em_aberto, v_novos, v_em_separacao, v_aguardando, v_saiu
    from public.orders
   where status in ('recebido', 'separando', 'aguardando_entregador', 'saiu_para_entrega');

  select jsonb_build_object(
    'fuso',                  v_tz,
    'inicio_do_dia',         v_inicio,
    'pedidos_hoje',          v_pedidos,
    'entregues_hoje',        v_entregues,
    'cancelados_hoje',       v_cancelados,
    'faturamento_hoje',      v_receita,
    'ticket_medio',          case when v_entregues > 0 then round(v_receita / v_entregues, 2) else 0 end,
    'em_aberto',             v_em_aberto,
    'novos',                 v_novos,
    'em_separacao',          v_em_separacao,
    'aguardando_entregador', v_aguardando,
    'saiu_para_entrega',     v_saiu
  )
    into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.dashboard_hoje() from public;
grant execute on function public.dashboard_hoje() to authenticated;
