-- =============================================================================
-- 0019 - Importacao de produtos por planilha (CSV)
--
-- Uma unica funcao serve tanto a previa quanto a confirmacao (p_dry_run).
-- Isso elimina o risco classico de "a previa mostra uma coisa e o confirmar
-- grava outra": os inserts/updates SEMPRE rodam de verdade; se for so
-- previa, um savepoint (via BEGIN/EXCEPTION) desfaz tudo no final, mas as
-- variaveis com os contadores e o detalhe por linha continuam validas -
-- rollback de dados nao apaga estado de variavel em PL/pgSQL.
-- =============================================================================

create or replace function public.import_products(p_rows jsonb, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row                 jsonb;
  v_linha                text;
  v_name                 text;
  v_category             text;
  v_unit                 text;
  v_price                numeric;
  v_cat_id               uuid;
  v_categoria_era_nova   boolean;
  v_slug                 text;
  v_existing_id          uuid;
  v_preco_atual          numeric;
  v_sold_by_weight       boolean;
  v_criados              int := 0;
  v_atualizados          int := 0;
  v_categorias_criadas   int := 0;
  v_erros                jsonb := '[]'::jsonb;
  v_linhas               jsonb := '[]'::jsonb;
begin
  if not public.has_permission('produtos.criar') then
    raise exception 'SEM_PERMISSAO' using detail = 'produtos.criar', errcode = '42501';
  end if;

  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
    loop
      v_linha    := coalesce(v_row->>'linha', '');
      v_name     := btrim(coalesce(v_row->>'name', ''));
      v_category := btrim(coalesce(v_row->>'category', ''));
      v_unit     := lower(btrim(coalesce(v_row->>'unit', '')));
      v_price    := nullif(v_row->>'price', '')::numeric;

      if v_name = '' and v_category = '' and v_unit = '' and v_price is null then
        continue; -- linha em branco no fim do arquivo: ignora em silencio
      end if;

      if v_name = '' then
        v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'Nome vazio');
        continue;
      end if;
      if v_category = '' then
        v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'Categoria vazia');
        continue;
      end if;
      if v_unit not in ('unidade', 'pacote', 'caixa', 'kg', 'g') then
        v_erros := v_erros || jsonb_build_object(
          'linha', v_linha,
          'motivo', 'Unidade desconhecida: "' || coalesce(v_row->>'unit', '') ||
                    '" (use unidade, pacote, caixa, kg ou g)'
        );
        continue;
      end if;
      if v_price is null or v_price <= 0 then
        v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'Preco invalido');
        continue;
      end if;

      v_sold_by_weight := v_unit in ('kg', 'g');

      -- Categoria: casa por nome normalizado (sem acento/maiuscula), cria se nao existir.
      select id into v_cat_id from public.categories
       where normalize_text(name) = normalize_text(v_category) limit 1;

      v_categoria_era_nova := v_cat_id is null;
      if v_cat_id is null then
        v_slug := regexp_replace(normalize_text(v_category), '\s+', '-', 'g')
                  || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
        insert into public.categories (name, slug, sort_order)
        select v_category, v_slug, coalesce(max(sort_order), 0) + 1 from public.categories
        returning id into v_cat_id;
        v_categorias_criadas := v_categorias_criadas + 1;
      end if;

      -- Produto: casa por nome normalizado. Ja existe -> atualiza preco/categoria/unidade.
      select id, price into v_existing_id, v_preco_atual from public.products
       where normalize_text(name) = normalize_text(v_name) limit 1;

      if v_existing_id is not null then
        update public.products
           set category_id    = v_cat_id,
               unit_type       = v_unit::public.unit_type,
               sold_by_weight  = v_sold_by_weight,
               price           = v_price
         where id = v_existing_id;

        v_atualizados := v_atualizados + 1;
        v_linhas := v_linhas || jsonb_build_object(
          'linha', v_linha, 'status', 'atualizado', 'nome', v_name, 'categoria', v_category,
          'categoria_nova', v_categoria_era_nova, 'preco_atual', v_preco_atual, 'preco_novo', v_price
        );
      else
        v_slug := regexp_replace(normalize_text(v_name), '\s+', '-', 'g')
                  || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
        insert into public.products (category_id, name, slug, unit_type, sold_by_weight, price)
        values (v_cat_id, v_name, v_slug, v_unit::public.unit_type, v_sold_by_weight, v_price);

        v_criados := v_criados + 1;
        v_linhas := v_linhas || jsonb_build_object(
          'linha', v_linha, 'status', 'novo', 'nome', v_name, 'categoria', v_category,
          'categoria_nova', v_categoria_era_nova, 'preco_novo', v_price
        );
      end if;
    end loop;

    if p_dry_run then
      raise exception using errcode = 'P0001', message = '__DRY_RUN__';
    end if;
  exception
    when others then
      if sqlerrm <> '__DRY_RUN__' then
        raise;
      end if;
      -- so cai aqui em modo previa: o savepoint implicito deste bloco
      -- desfez todos os inserts/updates acima. Os contadores e v_linhas
      -- continuam validos porque variavel de PL/pgSQL nao e desfeita.
  end;

  return jsonb_build_object(
    'criados', v_criados,
    'atualizados', v_atualizados,
    'categorias_criadas', v_categorias_criadas,
    'erros', v_erros,
    'linhas', v_linhas
  );
end;
$$;

revoke all on function public.import_products(jsonb, boolean) from public;
grant execute on function public.import_products(jsonb, boolean) to authenticated;
