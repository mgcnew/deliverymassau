-- =============================================================================
-- 0036 - Voucher (vale-alimentacao / refeicao) como forma de pagamento
--
-- So o valor novo do enum. Fica sozinho nesta migration porque o Postgres nao
-- deixa USAR um valor de enum na mesma transacao em que ele foi criado - a
-- linha em payment_methods e o resto vem na 0037.
-- =============================================================================

alter type public.payment_method add value if not exists 'voucher';
