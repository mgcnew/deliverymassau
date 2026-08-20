-- =============================================================================
-- 0020 - Codigo de barras (Fase C)
-- Campo opcional, unico quando preenchido. Ajuda a achar produto rapido e a
-- evitar duplicar cadastro de um item que so mudou de nome no fornecedor.
-- =============================================================================

alter table public.products add column if not exists barcode text;

-- Indice unico PARCIAL: varios produtos podem ficar com barcode nulo (a
-- maioria, no inicio), so quando preenchido precisa ser unico.
create unique index if not exists products_barcode_unico
  on public.products (barcode) where barcode is not null;

comment on column public.products.barcode is
  'Codigo de barras (EAN/UPC), opcional. Unico quando preenchido.';

-- barcode entra no mesmo grupo de campos que so quem tem produtos.editar
-- pode mudar (antes so cuidava de nome/preco/categoria/etc).
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
       and not public.has_permission('produtos.desativar') then
      raise exception 'SEM_PERMISSAO' using detail = 'produtos.desativar', errcode = '42501';
    end if;

    if (new.name, new.category_id, new.price, new.unit_type, new.sold_by_weight,
        new.short_description, new.image_path, new.slug, new.sort_order,
        new.weight_step, new.min_weight, new.barcode)
       is distinct from
       (old.name, old.category_id, old.price, old.unit_type, old.sold_by_weight,
        old.short_description, old.image_path, old.slug, old.sort_order,
        old.weight_step, old.min_weight, old.barcode) then
      raise exception 'SEM_PERMISSAO' using detail = 'produtos.editar', errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Consulta rapida: existe produto com este codigo? (para o aviso de duplicado
-- no formulario, antes mesmo de salvar). So staff enxerga.
create or replace function public.find_product_by_barcode(p_barcode text, p_excluir_id uuid default null)
returns table (id uuid, name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_permission('produtos.criar') or public.has_permission('produtos.editar')) then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;

  return query
    select p.id, p.name
      from public.products p
     where p.barcode = p_barcode
       and (p_excluir_id is null or p.id <> p_excluir_id)
     limit 1;
end;
$$;

revoke all on function public.find_product_by_barcode(text, uuid) from public;
grant execute on function public.find_product_by_barcode(text, uuid) to authenticated;
