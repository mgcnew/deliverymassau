-- =============================================================================
-- 0028 - Resumo dos pedidos guardados no aparelho do cliente
-- "Meus pedidos" so conhecia o numero e a data (o que estava no localStorage):
-- para saber em que pe estava cada pedido, ou reler o codigo de entrega, era
-- preciso abrir um por um. E quem perdia o link do pedido perdia o codigo.
--
-- Uma chamada resolve a tela inteira. A credencial continua sendo o token do
-- pedido, exatamente como em get_order_by_token: quem tem o link ve; quem nao
-- tem, nao ve. Nada aqui expoe mais do que aquela funcao ja expunha - so
-- devolve menos, o suficiente para a lista.
-- =============================================================================

create or replace function public.get_orders_summary_by_tokens(p_tokens text[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'public_token',  o.public_token,
        'order_number',  o.order_number,
        'status',        o.status,
        'created_at',    o.created_at,
        'total',         o.total,
        'delivery_code', case
                           -- O codigo so vale enquanto ha entrega pela frente.
                           -- Depois de entregue ou cancelado ele nao serve mais
                           -- para nada, e o certo e parar de mostrar.
                           when o.status in ('entregue', 'cancelado') then null
                           else o.delivery_code
                         end,
        'fulfillment',   o.fulfillment
      )
      order by o.created_at desc
    ),
    '[]'::jsonb
  )
  from public.orders o
  -- Teto de 20: a tela mostra os pedidos de um aparelho so, e um array
  -- gigante vindo do navegador nao pode virar varredura na tabela.
  where o.public_token = any (p_tokens[1:20]);
$$;

comment on function public.get_orders_summary_by_tokens(text[]) is
  'Resumo dos pedidos cujos tokens o aparelho guardou. Mesma credencial de get_order_by_token.';

revoke all on function public.get_orders_summary_by_tokens(text[]) from public;
grant execute on function public.get_orders_summary_by_tokens(text[]) to anon, authenticated;
