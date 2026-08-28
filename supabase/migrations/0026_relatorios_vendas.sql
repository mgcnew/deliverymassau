-- =============================================================================
-- 0026 - Relatorios de vendas
-- O dashboard responde "como esta o dia agora". Este relatorio responde
-- "como foi o periodo" - faturamento, produtos que giram, bairros que
-- pedem, formas de pagamento e horario de movimento.
--
-- Tudo em UMA funcao: a tela precisa das sete secoes juntas, e cada uma
-- delas em RPC separada seriam sete idas de rede para montar uma pagina so.
--
-- Duas regras que valem para todos os numeros daqui:
--   1. O dia e o do fuso do mercado (settings.timezone), igual ao
--      dashboard_hoje() - num delivery 24h o pedido das 00h10 e de hoje,
--      nao de ontem no UTC do servidor.
--   2. Dinheiro so conta pedido ENTREGUE. Pedido em andamento ainda pode
--      mudar de valor na pesagem ou ser cancelado; contar como receita
--      seria prometer faturamento que ainda nao existe.
-- =============================================================================

-- Permissao nova --------------------------------------------------------------
insert into public.permissions (code, module, label, description, sort_order) values
  ('relatorios.ver', 'Relatorios', 'Ver relatorios', 'Faturamento e desempenho por periodo', 11)
on conflict (code) do nothing;

-- Administrador ja tem tudo por preset, mas o vinculo so nasce junto com o
-- codigo: concede explicitamente pro preset que ja existe (mesmo caminho da
-- 0021).
insert into public.preset_permissions (preset_id, permission_code)
select p.id, 'relatorios.ver'
  from public.permission_presets p
 where p.slug = 'administrador'
on conflict do nothing;

-- Relatorio -------------------------------------------------------------------
create or replace function public.relatorio_vendas(p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz          text;
  v_de          timestamptz;
  v_ate         timestamptz;
  v_dias        integer;
  v_de_ant      timestamptz;

  v_pedidos     integer;
  v_entregues   integer;
  v_cancelados  integer;
  v_andamento   integer;
  v_faturamento numeric(12,2);
  v_taxas       numeric(12,2);
  v_retiradas   integer;

  v_itens       integer;
  v_em_falta    integer;
  v_pecas       numeric(12,3);

  v_ped_ant     integer;
  v_fat_ant     numeric(12,2);

  v_por_dia     jsonb;
  v_produtos    jsonb;
  v_bairros     jsonb;
  v_pagamentos  jsonb;
  v_horas       jsonb;
begin
  if not public.has_permission('relatorios.ver') then
    raise exception 'SEM_PERMISSAO' using detail = 'relatorios.ver', errcode = '42501';
  end if;

  if p_inicio is null or p_fim is null then
    raise exception 'PERIODO_INVALIDO' using detail = 'informe inicio e fim';
  end if;

  if p_fim < p_inicio then
    raise exception 'PERIODO_INVALIDO' using detail = 'o fim e anterior ao inicio';
  end if;

  v_dias := (p_fim - p_inicio) + 1;

  -- Teto de um ano: acima disso a serie diaria vira um grafico ilegivel e a
  -- consulta deixa de ser barata. Periodo maior = relatorio de outro tipo.
  if v_dias > 366 then
    raise exception 'PERIODO_LONGO' using detail = 'no maximo 366 dias';
  end if;

  select timezone into v_tz from public.settings where id = 1;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');

  v_de     := (p_inicio::timestamp) at time zone v_tz;
  v_ate    := ((p_fim + 1)::timestamp) at time zone v_tz;
  -- Periodo anterior do MESMO tamanho, colado no inicio deste.
  v_de_ant := v_de - (v_ate - v_de);

  -- Resumo. WHERE por created_at casa com idx_orders_data: le so o periodo,
  -- nunca a tabela inteira.
  select count(*),
         count(*) filter (where status = 'entregue'),
         count(*) filter (where status = 'cancelado'),
         count(*) filter (where status in ('recebido','separando','aguardando_entregador','saiu_para_entrega')),
         coalesce(sum(total)        filter (where status = 'entregue'), 0),
         coalesce(sum(delivery_fee) filter (where status = 'entregue'), 0),
         count(*) filter (where status = 'entregue' and fulfillment = 'retirada')
    into v_pedidos, v_entregues, v_cancelados, v_andamento, v_faturamento, v_taxas, v_retiradas
    from public.orders
   where created_at >= v_de and created_at < v_ate;

  -- Itens: quantas linhas sairam e quantas faltaram (ruptura de estoque).
  select count(*) filter (where oi.item_status <> 'indisponivel'),
         count(*) filter (where oi.item_status =  'indisponivel'),
         coalesce(sum(coalesce(oi.weighed_quantity, oi.requested_quantity))
                  filter (where oi.item_status <> 'indisponivel'), 0)
    into v_itens, v_em_falta, v_pecas
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where o.created_at >= v_de and o.created_at < v_ate
     and o.status = 'entregue';

  select count(*) filter (where status = 'entregue'),
         coalesce(sum(total) filter (where status = 'entregue'), 0)
    into v_ped_ant, v_fat_ant
    from public.orders
   where created_at >= v_de_ant and created_at < v_de;

  -- Serie diaria. generate_series garante que dia sem venda apareca com
  -- zero: sem isso o grafico "pula" o dia fechado e engana a leitura.
  select coalesce(jsonb_agg(jsonb_build_object(
           'dia',         to_char(d.dia, 'YYYY-MM-DD'),
           'pedidos',     coalesce(s.pedidos, 0),
           'entregues',   coalesce(s.entregues, 0),
           'faturamento', coalesce(s.faturamento, 0)
         ) order by d.dia), '[]'::jsonb)
    into v_por_dia
    from generate_series(p_inicio, p_fim, interval '1 day') as d(dia)
    left join (
      select (created_at at time zone v_tz)::date as dia,
             count(*)                                                   as pedidos,
             count(*) filter (where status = 'entregue')                as entregues,
             coalesce(sum(total) filter (where status = 'entregue'), 0) as faturamento
        from public.orders
       where created_at >= v_de and created_at < v_ate
       group by 1
    ) s on s.dia = d.dia::date;

  -- Produtos mais vendidos. Agrupa pelo NOME gravado no item (snapshot do
  -- pedido), nao pelo produto atual: renomear ou excluir um produto nao
  -- pode reescrever o passado.
  select coalesce(jsonb_agg(jsonb_build_object(
           'nome',        t.nome,
           'unidade',     t.unit_type,
           'por_peso',    t.sold_by_weight,
           'quantidade',  t.quantidade,
           'pedidos',     t.pedidos,
           'faturamento', t.faturamento
         ) order by t.faturamento desc), '[]'::jsonb)
    into v_produtos
    from (
      select oi.product_name   as nome,
             oi.unit_type      as unit_type,
             oi.sold_by_weight as sold_by_weight,
             sum(coalesce(oi.weighed_quantity, oi.requested_quantity)) as quantidade,
             count(distinct oi.order_id)                               as pedidos,
             sum(oi.final_total)                                       as faturamento
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
       where o.created_at >= v_de and o.created_at < v_ate
         and o.status = 'entregue'
         and oi.item_status <> 'indisponivel'
       group by oi.product_name, oi.unit_type, oi.sold_by_weight
       order by sum(oi.final_total) desc
       limit 20
    ) t;

  -- Bairros. So entrega: retirada no balcao nao tem bairro nem taxa.
  select coalesce(jsonb_agg(jsonb_build_object(
           'bairro',      t.bairro,
           'zona',        t.zona,
           'pedidos',     t.pedidos,
           'faturamento', t.faturamento,
           'taxas',       t.taxas
         ) order by t.faturamento desc), '[]'::jsonb)
    into v_bairros
    from (
      select coalesce(nullif(btrim(address_district), ''), 'Sem bairro') as bairro,
             coalesce(nullif(btrim(zone_name), ''), '-')                as zona,
             count(*)                as pedidos,
             sum(total)              as faturamento,
             sum(delivery_fee)       as taxas
        from public.orders
       where created_at >= v_de and created_at < v_ate
         and status = 'entregue'
         and fulfillment = 'entrega'
       group by 1, 2
       order by sum(total) desc
       limit 15
    ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
           'metodo',      t.metodo,
           'pedidos',     t.pedidos,
           'faturamento', t.faturamento
         ) order by t.faturamento desc), '[]'::jsonb)
    into v_pagamentos
    from (
      select payment_method::text as metodo,
             count(*)             as pedidos,
             sum(total)           as faturamento
        from public.orders
       where created_at >= v_de and created_at < v_ate
         and status = 'entregue'
       group by 1
    ) t;

  -- Movimento por hora: e o numero que decide escala de equipe num 24h.
  -- Conta pelo horario em que o pedido ENTROU, no fuso do mercado.
  select coalesce(jsonb_agg(jsonb_build_object(
           'hora',        h.hora,
           'pedidos',     coalesce(s.pedidos, 0),
           'faturamento', coalesce(s.faturamento, 0)
         ) order by h.hora), '[]'::jsonb)
    into v_horas
    from generate_series(0, 23) as h(hora)
    left join (
      select extract(hour from created_at at time zone v_tz)::int      as hora,
             count(*)                                                  as pedidos,
             coalesce(sum(total) filter (where status = 'entregue'), 0) as faturamento
        from public.orders
       where created_at >= v_de and created_at < v_ate
       group by 1
    ) s on s.hora = h.hora;

  return jsonb_build_object(
    'fuso',   v_tz,
    'inicio', to_char(p_inicio, 'YYYY-MM-DD'),
    'fim',    to_char(p_fim, 'YYYY-MM-DD'),
    'dias',   v_dias,

    'resumo', jsonb_build_object(
      'pedidos',        v_pedidos,
      'entregues',      v_entregues,
      'cancelados',     v_cancelados,
      'em_andamento',   v_andamento,
      'faturamento',    v_faturamento,
      'ticket_medio',   case when v_entregues > 0 then round(v_faturamento / v_entregues, 2) else 0 end,
      'taxas',          v_taxas,
      'itens',          v_itens,
      'itens_em_falta', v_em_falta,
      'pecas',          v_pecas,
      'retiradas',      v_retiradas,
      'media_diaria',   round(v_faturamento / v_dias, 2)
    ),

    -- Variacao fica NULL quando o periodo anterior nao teve nada: dividir
    -- por zero viraria "+infinito%" na tela.
    'anterior', jsonb_build_object(
      'inicio',      to_char(p_inicio - v_dias, 'YYYY-MM-DD'),
      'fim',         to_char(p_inicio - 1, 'YYYY-MM-DD'),
      'entregues',   v_ped_ant,
      'faturamento', v_fat_ant,
      'variacao_faturamento',
        case when v_fat_ant > 0 then round((v_faturamento - v_fat_ant) / v_fat_ant * 100, 1) end,
      'variacao_pedidos',
        case when v_ped_ant > 0 then round((v_entregues - v_ped_ant)::numeric / v_ped_ant * 100, 1) end
    ),

    'por_dia',    v_por_dia,
    'produtos',   v_produtos,
    'bairros',    v_bairros,
    'pagamentos', v_pagamentos,
    'horas',      v_horas
  );
end;
$$;

comment on function public.relatorio_vendas(date, date) is
  'Relatorio de vendas do periodo [p_inicio, p_fim] no fuso de settings.timezone. Dinheiro conta somente pedido entregue.';

revoke all on function public.relatorio_vendas(date, date) from public;
grant execute on function public.relatorio_vendas(date, date) to authenticated;
