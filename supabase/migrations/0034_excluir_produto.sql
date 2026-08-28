-- =============================================================================
-- 0034 - Excluir produto (com desativacao automatica quando ja houve venda)
--
-- Cadastro vindo de sistema antigo traz item que o mercado nem vende mais.
-- Desativar resolve a vitrine, mas deixa o lixo na tela de Produtos para
-- sempre - e essa lista e ferramenta de trabalho do balcao.
--
-- A regra e a que o proprio banco ja impoe: order_items aponta para products
-- com ON DELETE RESTRICT, entao produto que ja saiu em pedido NAO pode ser
-- apagado - apagar reescreveria o historico de vendas e a nota do cliente.
-- Aqui isso vira comportamento explicito em vez de erro na cara do usuario:
--   - nunca vendido  -> apaga de verdade
--   - ja vendido     -> desativa, e a tela diz que foi isso que aconteceu
--
-- O EXCEPTION no fim e rede de seguranca: se um dia outra tabela passar a
-- apontar para products, a exclusao vira desativacao em vez de erro.
-- =============================================================================

insert into public.permissions (code, module, label, description, sort_order) values
  ('produtos.excluir', 'Produtos', 'Excluir produto',
   'Apaga de vez quando o produto nunca foi vendido', 36)
on conflict (code) do nothing;

insert into public.preset_permissions (preset_id, permission_code)
select p.id, 'produtos.excluir'
  from public.permission_presets p
 where p.slug = 'administrador'
on conflict do nothing;

create or replace function public.delete_product(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendas  integer;
  v_nome    text;
  v_imagem  text;
begin
  if not public.has_permission('produtos.excluir') then
    raise exception 'SEM_PERMISSAO' using detail = 'produtos.excluir', errcode = '42501';
  end if;

  select name, image_path into v_nome, v_imagem from public.products where id = p_id;
  if v_nome is null then
    raise exception 'PRODUTO_NAO_ENCONTRADO';
  end if;

  select count(*) into v_vendas from public.order_items where product_id = p_id;

  if v_vendas > 0 then
    update public.products
       set is_active = false, is_available = false
     where id = p_id;

    return jsonb_build_object('acao', 'desativado', 'nome', v_nome, 'vendas', v_vendas);
  end if;

  begin
    delete from public.products where id = p_id;
    -- A imagem volta para quem chamou apagar do Storage: o banco nao alcanca
    -- o bucket, e arquivo orfao fica ocupando espaco para sempre.
    return jsonb_build_object('acao', 'excluido', 'nome', v_nome, 'imagem', v_imagem);
  exception
    when foreign_key_violation then
      update public.products
         set is_active = false, is_available = false
       where id = p_id;
      return jsonb_build_object('acao', 'desativado', 'nome', v_nome, 'vendas', 0);
  end;
end;
$$;

comment on function public.delete_product(uuid) is
  'Apaga o produto quando ele nunca foi vendido; se ja saiu em pedido, apenas desativa.';

revoke all on function public.delete_product(uuid) from public;
grant execute on function public.delete_product(uuid) to authenticated;
