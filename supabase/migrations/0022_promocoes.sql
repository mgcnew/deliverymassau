-- =============================================================================
-- 0022 - Promocoes: preco antigo pra mostrar riscado quando o produto
-- esta em oferta. Em promocao = original_price preenchido e maior que price.
-- =============================================================================

alter table public.products
  add column original_price numeric(12,2),
  add constraint products_original_price_ck
    check (original_price is null or original_price > price);
