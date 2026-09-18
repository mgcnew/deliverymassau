-- =============================================================================
-- 0057 - Publicar a conferencia aos poucos, sem encerrar
--
-- O dono quer botar a loja no ar antes de terminar de andar o mercado inteiro:
-- bipa leite e wafer, publica, ja comeca a vender, e continua bipando nos dias
-- seguintes. Hoje isso nao existe, e "aplicar" nao serve para isso: a
-- aplicacao PODA - ela desliga todo produto ativo que nao foi bipado. Aplicar
-- no meio do caminho tiraria da vitrine tudo que ainda nao passou pelo leitor.
--
-- Entao sao duas operacoes diferentes, e nao a mesma repetida:
--
--   publicar_parcial_conferencia  aditiva. Liga o que foi bipado e nao mexe em
--                                 mais nada. Repetivel, conferencia segue
--                                 aberta.
--   aplicar_conferencia           a de sempre, intacta: encerra e poda o que
--                                 nao foi encontrado.
--
-- Nota sobre o desenho antigo: conferencia_efeito tem o estado 'ja_fora' e a
-- coluna `volta` ("estava inativo e volta"), que a tela de previa chega a
-- exibir - mas nenhum dos dois pode acontecer, porque aquela funcao filtra
-- `where p.is_active` e produto inativo nunca entra. Alguem desenhou a
-- reativacao e ela ficou inalcancavel. Esta migration nao mexe naquela funcao
-- (a poda esta correta como esta); implementa a reativacao onde ela faz
-- sentido, numa acao propria.
--
-- Nao ha "desfazer" para a parcial, de proposito: ela so acrescenta, entao o
-- pior caso e um produto a mais na vitrine, que se desliga na ficha. Guardar
-- estado anterior de cada parcial atrapalharia o desfazer do encerramento,
-- que depende de uma unica foto do antes.
-- =============================================================================

create or replace function public.publicar_parcial_conferencia(p_conferencia uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status     public.stock_take_status;
  v_conferidos integer;
  v_publicados integer;
begin
  if not public.has_permission('conferencia.aplicar') then
    raise exception 'SEM_PERMISSAO' using detail = 'conferencia.aplicar', errcode = '42501';
  end if;

  select status into v_status from public.stock_takes where id = p_conferencia;
  if v_status is null then raise exception 'CONFERENCIA_NAO_ENCONTRADA'; end if;
  if v_status <> 'aberta' then raise exception 'CONFERENCIA_NAO_ABERTA'; end if;

  select count(*) into v_conferidos
    from public.stock_take_items where stock_take_id = p_conferencia;
  if v_conferidos = 0 then raise exception 'CONFERENCIA_VAZIA'; end if;

  -- So o que foi bipado. Quantidade zero significa "vi, mas acabou": entra no
  -- catalogo como esgotado, e nao fica de fora - assim ele ja aparece quando
  -- a reposicao chegar, sem precisar bipar de novo.
  with lidos as (
    select i.product_id,
           (i.quantity is null or i.quantity > 0) as na_prateleira
      from public.stock_take_items i
     where i.stock_take_id = p_conferencia
  ),
  mudou as (
    update public.products p
       set is_active    = true,
           is_available = l.na_prateleira
      from lidos l
     where p.id = l.product_id
       and (p.is_active, p.is_available) is distinct from (true, l.na_prateleira)
    returning p.id
  )
  select count(*) into v_publicados from mudou;

  return jsonb_build_object(
    'conferidos', v_conferidos,
    'publicados', v_publicados,
    'ja_estavam', v_conferidos - v_publicados
  );
end;
$$;

revoke all on function public.publicar_parcial_conferencia(uuid) from public;
grant execute on function public.publicar_parcial_conferencia(uuid) to authenticated;

comment on function public.publicar_parcial_conferencia(uuid) is
  'Liga na vitrine o que ja foi bipado, sem encerrar a conferencia e sem podar o resto.';
