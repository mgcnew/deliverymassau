-- =============================================================================
-- 0014 - Auditoria de produtos e categorias
-- O item 31 do briefing exige guardar quem mudou preco (e disponibilidade).
-- Numa operacao 24h com troca de turno, "quem marcou que acabou" importa.
-- =============================================================================

create trigger trg_audit_products after insert or update on public.products
  for each row execute function public.trg_audit_row();

create trigger trg_audit_categories after update on public.categories
  for each row execute function public.trg_audit_row();
