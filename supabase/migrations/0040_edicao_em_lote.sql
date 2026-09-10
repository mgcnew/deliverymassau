-- =============================================================================
-- 0040 - Edicao de produtos em lote
--
-- O sistema nao conversa com o PDV da loja: todo preco muda duas vezes, la e
-- aqui. A tela "Edicao em lote" junta as alteracoes de muitos produtos (nome,
-- categoria, preco, preco antigo, inativar/reativar, excluir) num rascunho e
-- manda tudo de uma vez para esta funcao.
--
-- Tudo ou nada: ou o lote inteiro entra, ou nada muda. Antes de gravar:
--   - permissao: cada tipo de mudanca exige a sua (editar, desativar,
--     excluir). O preco antigo nao esta na trava de campos da tabela, entao
--     e conferido aqui.
--   - conflito: para cada campo mudado vem o valor que a pessoa VIU. Se o
--     banco estiver diferente (outra pessoa mexeu enquanto ela editava), o
--     lote volta sem gravar, dizendo o que mudou - em vez de sobrescrever.
--   - validacao: preco > 0, preco antigo maior que o preco, nome nao vazio,
--     categoria existente. Tambem volta a lista, sem gravar.
--
-- Excluir reusa delete_product (0034): apaga o que nunca vendeu, desativa o
-- que ja vendeu. As imagens dos apagados voltam para o app tirar do Storage.
--
-- SECURITY INVOKER: os updates passam pela RLS e pelos gatilhos de produto
-- como se a pessoa tivesse editado um por um.
-- =============================================================================

create or replace function public.aplicar_lote_produtos(p_itens jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  it          jsonb;
  m           jsonb;
  e           jsonb;
  atual       public.products%rowtype;
  v_id        uuid;
  v_nome      text;
  v_preco     numeric;
  v_antigo    numeric;
  v_categoria uuid;
  v_conflitos jsonb := '[]'::jsonb;
  v_invalidos jsonb := '[]'::jsonb;
  v_campo     text;
  v_viu       text;
  v_tem       text;
  v_mudou     boolean;
  v_r         jsonb;
  v_linhas    int;
  v_atualizados int := 0;
  v_excluidos jsonb := '[]'::jsonb;
  v_desativados jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'LOTE_VAZIO';
  end if;
  if jsonb_array_length(p_itens) > 500 then
    raise exception 'LOTE_GRANDE' using detail = 'Maximo de 500 produtos por vez.';
  end if;

  -- Permissoes, pelo que o lote pede ----------------------------------------
  if exists (select 1 from jsonb_array_elements(p_itens) x
              where not coalesce((x ->> 'excluir')::boolean, false)
                and (x -> 'mudar') ?| array['name', 'price', 'original_price', 'category_id'])
     and not public.has_permission('produtos.editar') then
    raise exception 'SEM_PERMISSAO' using detail = 'produtos.editar', errcode = '42501';
  end if;
  if exists (select 1 from jsonb_array_elements(p_itens) x
              where not coalesce((x ->> 'excluir')::boolean, false) and (x -> 'mudar') ? 'is_active')
     and not (public.has_permission('produtos.desativar') or public.has_permission('produtos.editar')) then
    raise exception 'SEM_PERMISSAO' using detail = 'produtos.desativar', errcode = '42501';
  end if;
  if exists (select 1 from jsonb_array_elements(p_itens) x where coalesce((x ->> 'excluir')::boolean, false))
     and not public.has_permission('produtos.excluir') then
    raise exception 'SEM_PERMISSAO' using detail = 'produtos.excluir', errcode = '42501';
  end if;

  -- 1a passada: conferir tudo, sem gravar nada -------------------------------
  for it in select * from jsonb_array_elements(p_itens) loop
    v_id := (it ->> 'id')::uuid;
    m := coalesce(it -> 'mudar', '{}'::jsonb);
    e := coalesce(it -> 'esperado', '{}'::jsonb);

    select * into atual from public.products where id = v_id;
    if not found then
      v_conflitos := v_conflitos || jsonb_build_object('id', v_id, 'campo', 'produto', 'atual', null);
      continue;
    end if;

    -- Conflito: campo que a pessoa quer mudar ja nao esta como ela viu.
    for v_campo in select jsonb_object_keys(m) loop
      v_viu := nullif(e ->> v_campo, '');
      -- Preco compara como numero: "1.5" e "1.50" sao o mesmo preco.
      if v_campo = 'price' then
        v_mudou := atual.price is distinct from v_viu::numeric;
      elsif v_campo = 'original_price' then
        v_mudou := atual.original_price is distinct from v_viu::numeric;
      else
        v_tem := case v_campo
          when 'name'        then atual.name
          when 'category_id' then atual.category_id::text
          when 'is_active'   then atual.is_active::text
        end;
        v_mudou := v_tem is distinct from v_viu;
      end if;
      if v_mudou then
        v_conflitos := v_conflitos || jsonb_build_object(
          'id', v_id, 'nome', atual.name, 'campo', v_campo,
          'atual', case v_campo
                     when 'price' then to_jsonb(atual.price)
                     when 'original_price' then to_jsonb(atual.original_price)
                     when 'is_active' then to_jsonb(atual.is_active)
                     when 'category_id' then to_jsonb(atual.category_id)
                     else to_jsonb(atual.name)
                   end);
      end if;
    end loop;

    if coalesce((it ->> 'excluir')::boolean, false) then
      continue;
    end if;

    -- Validacao do resultado final da linha.
    v_nome := case when m ? 'name' then btrim(m ->> 'name') else atual.name end;
    v_preco := case when m ? 'price' then (m ->> 'price')::numeric else atual.price end;
    v_antigo := case when m ? 'original_price' then nullif(m ->> 'original_price', '')::numeric
                     else atual.original_price end;
    v_categoria := case when m ? 'category_id' then (m ->> 'category_id')::uuid else atual.category_id end;

    if coalesce(v_nome, '') = '' then
      v_invalidos := v_invalidos || jsonb_build_object('id', v_id, 'nome', atual.name, 'erro', 'Nome vazio.');
    elsif v_preco is null or v_preco <= 0 then
      v_invalidos := v_invalidos || jsonb_build_object('id', v_id, 'nome', atual.name, 'erro', 'Preco precisa ser maior que zero.');
    elsif v_antigo is not null and v_antigo <= v_preco then
      v_invalidos := v_invalidos || jsonb_build_object('id', v_id, 'nome', atual.name, 'erro', 'Preco antigo precisa ser maior que o preco.');
    elsif not exists (select 1 from public.categories where id = v_categoria) then
      v_invalidos := v_invalidos || jsonb_build_object('id', v_id, 'nome', atual.name, 'erro', 'Categoria nao existe mais.');
    end if;
  end loop;

  if jsonb_array_length(v_conflitos) > 0 or jsonb_array_length(v_invalidos) > 0 then
    return jsonb_build_object('ok', false, 'conflitos', v_conflitos, 'invalidos', v_invalidos);
  end if;

  -- 2a passada: gravar -------------------------------------------------------
  for it in select * from jsonb_array_elements(p_itens) loop
    v_id := (it ->> 'id')::uuid;
    m := coalesce(it -> 'mudar', '{}'::jsonb);

    if coalesce((it ->> 'excluir')::boolean, false) then
      v_r := public.delete_product(v_id);
      if v_r ->> 'acao' = 'excluido' then
        v_excluidos := v_excluidos || jsonb_build_object('id', v_id, 'nome', v_r ->> 'nome', 'imagem', v_r ->> 'imagem');
      else
        v_desativados := v_desativados || jsonb_build_object('id', v_id, 'nome', v_r ->> 'nome', 'vendas', v_r -> 'vendas');
      end if;
      continue;
    end if;

    if m = '{}'::jsonb then
      continue;
    end if;

    update public.products p
       set name           = case when m ? 'name' then btrim(m ->> 'name') else p.name end,
           price          = case when m ? 'price' then (m ->> 'price')::numeric else p.price end,
           original_price = case when m ? 'original_price' then nullif(m ->> 'original_price', '')::numeric
                                 else p.original_price end,
           category_id    = case when m ? 'category_id' then (m ->> 'category_id')::uuid else p.category_id end,
           is_active      = case when m ? 'is_active' then (m ->> 'is_active')::boolean else p.is_active end
     where p.id = v_id;

    get diagnostics v_linhas = row_count;
    if v_linhas = 0 then
      -- RLS barrou em silencio: nada do lote pode ficar pela metade.
      raise exception 'SEM_PERMISSAO' using detail = 'produtos.editar', errcode = '42501';
    end if;
    v_atualizados := v_atualizados + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'atualizados', v_atualizados,
    'excluidos', v_excluidos,
    'desativados', v_desativados
  );
end;
$$;

comment on function public.aplicar_lote_produtos(jsonb) is
  'Edicao em lote de produtos (tudo ou nada), com conferencia de conflito e validacao antes de gravar.';

revoke all on function public.aplicar_lote_produtos(jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_lote_produtos(jsonb) to authenticated;
