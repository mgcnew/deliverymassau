-- =============================================================================
-- 0055 - Conferencia a dois: cada tela mostra o total da loja, e nao o seu
--
-- Duas pessoas bipando a mesma conferencia ja funcionava no banco: a leitura e
-- gravada por (conferencia, produto), entao o mesmo item lido nos dois
-- aparelhos vira uma linha so e a viragem enxerga a soma. O que faltava era a
-- tela dizer isso.
--
-- Cada aparelho conta o que ELE bipou - as leituras moram no localStorage, e
-- so se juntam as do outro quando a pagina recarrega. Andando pela loja, os
-- dois viam numeros menores que o real e nenhum sinal de que havia mais
-- alguem trabalhando junto. Pior: o aviso de "leituras ainda no aparelho",
-- que e o que protege a viragem de apagar do catalogo justamente o que acabou
-- de ser bipado, so enxerga o aparelho de quem esta aplicando. O outro podia
-- estar sem sinal no fundo da loja com duzentas leituras presas.
--
-- Este resumo e a metade que faltava: o total que esta no servidor e quem o
-- colocou la, com a hora da ultima leitura de cada um. Com isso a tela mostra
-- o numero que a viragem vai usar, e quem aplica ve o nome de quem mais esta
-- na loja antes de decidir.
--
-- security definer por causa do nome: ver o nome de outra pessoa da equipe
-- exige equipe.ver, que um balconista nao tem - e nem devia ter so para
-- conferir estoque. O que vaza aqui e estreito e do proprio trabalho em
-- curso: quem esta bipando esta conferencia junto comigo.
-- =============================================================================

create or replace function public.resumo_conferencia(p_conferencia uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_resumo jsonb;
begin
  if not public.has_permission('produtos.ver') then
    raise exception 'SEM_PERMISSAO' using detail = 'produtos.ver', errcode = '42501';
  end if;

  select jsonb_build_object(
    'conferidos', (select count(*) from public.stock_take_items
                    where stock_take_id = p_conferencia),
    'acabaram',   (select count(*) from public.stock_take_items
                    where stock_take_id = p_conferencia and quantity = 0),
    'desconhecidos', (select count(*) from public.stock_take_unknown
                       where stock_take_id = p_conferencia),
    -- Quem bipou, do mais recente para o mais antigo. 'ultima' e o que diz se
    -- a pessoa ainda esta na loja ou se o aparelho dela parou de mandar.
    'quem', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id',         t.quem,
                 'nome',       coalesce(t.nome, 'Alguem da equipe'),
                 'eu',         t.quem = auth.uid(),
                 'conferidos', t.conferidos,
                 'ultima',     t.ultima
               )
               order by t.ultima desc)
        from (
          select i.scanned_by        as quem,
                 p.name              as nome,
                 count(*)::int       as conferidos,
                 max(i.scanned_at)   as ultima
            from public.stock_take_items i
            left join public.profiles p on p.id = i.scanned_by
           where i.stock_take_id = p_conferencia
             and i.scanned_by is not null
           group by i.scanned_by, p.name
        ) t
    ), '[]'::jsonb)
  ) into v_resumo;

  return v_resumo;
end;
$$;

revoke all on function public.resumo_conferencia(uuid) from public;
grant execute on function public.resumo_conferencia(uuid) to authenticated;

comment on function public.resumo_conferencia is
  'O que o servidor tem desta conferencia e quem bipou. Para a tela mostrar o total dos dois aparelhos.';
