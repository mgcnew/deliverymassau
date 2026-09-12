-- =============================================================================
-- 0053 - Tira as categorias vazias e o lixo de PDV preso nelas
--
-- Depois da reclassificacao (0044/0045) sobraram tres categorias sem nada de
-- util. Uma delas, Medicamentos, esta ATIVA e aparece na loja com zero
-- produtos - o cliente toca e chega numa pagina vazia. As outras duas ja
-- estavam desativadas, mas continuavam entulhando a lista do painel.
--
-- Elas nao saiam porque products.category_id e ON DELETE RESTRICT e ainda
-- havia 11 produtos apontando para lá - todos inativos, nenhum vendido pelo
-- delivery, e nenhum deles produto de verdade. Sao entradas operacionais que
-- vieram na planilha do PDV junto com o catalogo:
--
--   CANCELAR COMPRA, SAQUE CLIENTE   operacao de caixa, nao mercadoria
--   CLAUDIO, DIVERSOS                conta de cliente e vala comum do PDV
--   COMPRIMIDO SOLTO                 venda avulsa de balcao
--   CHIP TIM/VIVO/CLARO (4)          chip de celular, fora do que a loja
--                                    entrega hoje
--   SABOR DA ROCA, SALG.FOFURA       restos da reclassificacao
--
-- Apagar em vez de mover porque nenhum deles vai voltar ao catalogo: nao ha
-- venda, nao ha conferencia, nao ha pedido. Se um dia a loja quiser vender
-- chip, cadastra como produto novo, com foto e preco.
--
-- SALG.FOFURA e o unico com imagem no Storage (salg-fofura-1788254381672.jpg).
-- Migration nao alcanca o bucket: o arquivo e removido a parte, senao fica
-- orfao ocupando espaco sem produto nenhum apontando para ele.
-- =============================================================================

-- Os cascatas cuidam do resto (product_popularity, conferencia, reclassificacao);
-- order_items e RESTRICT, e a condicao abaixo garante que nenhum foi vendido.
delete from public.products p
 where p.category_id in (
         select id from public.categories where name in ('Mercearia', 'Salgadinhos')
       )
   and not p.is_active
   and not exists (select 1 from public.order_items oi where oi.product_id = p.id);

delete from public.categories c
 where c.name in ('Medicamentos', 'Mercearia', 'Salgadinhos')
   and not exists (select 1 from public.products p where p.category_id = c.id);
