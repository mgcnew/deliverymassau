-- =============================================================================
-- 0054 - "Sempre tem": produto que a conferencia nunca tira do catalogo
--
-- A conferencia parte de uma premissa que nao vale para toda a loja: que o
-- produto esta na prateleira no momento em que alguem passa bipando. Pao
-- frances sai do forno o dia inteiro, mortadela e fatiada na hora, hortifruti
-- e reposto por caixa. Esses itens a loja SEMPRE trabalha; o que muda e se
-- acabou agora - e isso quem sabe e o balconista, no botao "acabou", nao uma
-- caminhada com a camera.
--
-- A viragem (0047) ja tinha uma protecao para isso, porem por heuristica:
-- "manter produtos sem codigo de barras". Medindo, ela erra dos dois lados:
--
--   - dos 33 produtos vendidos por peso, 12 TEM codigo - asa, bacon, pe de
--     frango. Ficavam fora da protecao.
--   - o Pao frances tem codigo PLU interno (2000100000502). Tambem ficava
--     fora: uma viragem sem ele bipado o tirava do catalogo.
--   - e ela protegia de graca o lixo de PDV sem codigo, que devia sair.
--
-- Com um campo explicito o produto passa a ser protegido por ser o que e, e
-- nao por acidente de ter ou nao codigo.
--
-- O significado e estreito de proposito: "a conferencia nao tira este produto
-- do catalogo". Nao e "esta sempre disponivel" - a disponibilidade continua
-- na mao, e bipar com quantidade 0 continua marcando que acabou, porque o
-- julgamento de quem esta na loja vale sempre mais.
--
-- Os 33 vendidos por peso entram marcados: por definicao sao cortados ou
-- pesados na hora. O Pao frances e os demais itens de balcao sao marcados a
-- mao, porque nao ha regra que os descreva.
-- =============================================================================

alter table public.products
  add column always_stocked boolean not null default false;

comment on column public.products.always_stocked is
  'A conferencia nunca tira este produto do catalogo. Nao mexe na disponibilidade.';

-- Cortado ou pesado na hora: a loja trabalha com o item, nao com unidades dele.
update public.products set always_stocked = true where sold_by_weight;

-- Quem pode mudar -------------------------------------------------------------------
-- Entra no grupo de produtos.editar: e decisao de cadastro, de quem monta o
-- catalogo, e nao rotina de balcao. O balconista segue mexendo no que importa
-- para ele, que e "acabou"/"voltou".
create or replace function public.trg_products_campos_sensiveis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.has_permission('produtos.editar') then
    if new.is_active is distinct from old.is_active
       and not public.has_permission('produtos.desativar')
       and not public.has_permission('conferencia.aplicar') then
      raise exception 'SEM_PERMISSAO' using detail = 'produtos.desativar', errcode = '42501';
    end if;

    if (new.name, new.category_id, new.price, new.unit_type, new.sold_by_weight,
        new.short_description, new.image_path, new.slug, new.sort_order,
        new.weight_step, new.min_weight, new.barcode, new.always_stocked)
       is distinct from
       (old.name, old.category_id, old.price, old.unit_type, old.sold_by_weight,
        old.short_description, old.image_path, old.slug, old.sort_order,
        old.weight_step, old.min_weight, old.barcode, old.always_stocked) then
      raise exception 'SEM_PERMISSAO' using detail = 'produtos.editar', errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Efeito da viragem ------------------------------------------------------------------
-- 'sempre' entra como acao propria, e nao junto de 'mantido', porque sao razoes
-- diferentes: 'mantido' e "nao deu para bipar" (falta de codigo, que um dia se
-- resolve), 'sempre' e "a loja sempre trabalha com isto" (que nao muda). Quem
-- aplica precisa ver os dois numeros separados para saber se a protecao por
-- heuristica ainda esta carregando algo que devia ser marcado a mao.
create or replace function public.conferencia_efeito(
  p_conferencia uuid,
  p_manter_sem_codigo boolean default true
)
returns table (
  product_id     uuid,
  acao           text,
  volta          boolean,
  volta_a_vender boolean,
  novo_ativo     boolean,
  nova_vitrine   boolean,
  muda           boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      p.id,
      p.is_active,
      p.is_available,
      p.always_stocked,
      (p.barcode is null or btrim(p.barcode) = '')      as sem_codigo,
      (i.product_id is not null)                        as conferido,
      (i.product_id is not null and (i.quantity is null or i.quantity > 0)) as na_prateleira
      from public.products p
      left join public.stock_take_items i
        on i.stock_take_id = p_conferencia
       and i.product_id = p.id
     where p.is_active
  ),
  alvo as (
    select
      b.*,
      case
        when b.conferido                             then true
        when not b.is_active                         then false
        when b.always_stocked                        then true
        when b.sem_codigo and p_manter_sem_codigo    then true
        else false
      end as novo_ativo,
      case when b.conferido then b.na_prateleira else b.is_available end as nova_vitrine
      from base b
  )
  select
    a.id,
    case
      when a.conferido and a.na_prateleira          then 'fica'
      when a.conferido                              then 'acabou'
      when not a.is_active                          then 'ja_fora'
      when a.always_stocked                         then 'sempre'
      when a.sem_codigo and p_manter_sem_codigo     then 'mantido'
      else 'sai'
    end,
    a.conferido and not a.is_active,
    a.conferido and a.is_active and not a.is_available and a.na_prateleira,
    a.novo_ativo,
    a.nova_vitrine,
    (a.novo_ativo, a.nova_vitrine) is distinct from (a.is_active, a.is_available)
    from alvo a;
$$;

revoke all on function public.conferencia_efeito(uuid, boolean) from public;
grant execute on function public.conferencia_efeito(uuid, boolean) to authenticated;

create or replace function public.previa_conferencia(
  p_conferencia uuid,
  p_manter_sem_codigo boolean default true
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'fica',                count(*) filter (where acao = 'fica'),
    'acabou',              count(*) filter (where acao = 'acabou'),
    'sai',                 count(*) filter (where acao = 'sai'),
    'sempre_tem',          count(*) filter (where acao = 'sempre'),
    'mantidos_sem_codigo', count(*) filter (where acao = 'mantido'),
    'voltam',              count(*) filter (where volta),
    'voltam_a_vender',     count(*) filter (where volta_a_vender),
    'mudam',               count(*) filter (where muda),
    'vitrine_depois',      count(*) filter (where novo_ativo),
    'para_cadastrar',      (select count(*) from public.stock_take_unknown
                             where stock_take_id = p_conferencia)
  )
    from public.conferencia_efeito(p_conferencia, p_manter_sem_codigo);
$$;

revoke all on function public.previa_conferencia(uuid, boolean) from public;
grant execute on function public.previa_conferencia(uuid, boolean) to authenticated;

-- Edicao em lote aceita "sempre tem" ------------------------------------------------
-- Sao poucas dezenas de itens de balcao, mas marcar um por um na ficha cansa:
-- pela tela de lote da para filtrar Padaria ou Frios e marcar todos de uma vez.
-- Entra no mesmo grupo de produtos.editar e na mesma checagem de conflito dos
-- outros campos - se alguem mexeu no valor enquanto a pessoa editava, o lote
-- volta sem gravar.
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
                and (x -> 'mudar') ?| array['name', 'price', 'original_price', 'category_id', 'always_stocked'])
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
          when 'always_stocked' then atual.always_stocked::text
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
                     when 'always_stocked' then to_jsonb(atual.always_stocked)
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
           is_active      = case when m ? 'is_active' then (m ->> 'is_active')::boolean else p.is_active end,
           always_stocked = case when m ? 'always_stocked' then (m ->> 'always_stocked')::boolean
                                 else p.always_stocked end
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
