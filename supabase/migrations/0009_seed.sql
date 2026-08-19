-- =============================================================================
-- 0009 - Seed: catalogo de permissoes, presets e dados iniciais
-- Dados marcados como EXEMPLO devem ser substituidos em Configuracoes.
-- =============================================================================

insert into public.permissions (code, module, label, description, sort_order) values
  ('dashboard.ver',                  'Dashboard',     'Ver dashboard',                'Indicadores do dia', 10),

  ('pedidos.ver',                    'Pedidos',       'Ver pedidos',                  'Tela operacional de pedidos', 20),
  ('pedidos.editar',                 'Pedidos',       'Editar pedido',                'Alterar endereco, observacoes e itens', 21),
  ('pedidos.alterar_status',         'Pedidos',       'Alterar status',               'Mover o pedido no fluxo', 22),
  ('pedidos.separar',                'Pedidos',       'Separar pedido',               'Abrir a separacao e confirmar itens', 23),
  ('pedidos.ajustar_peso',           'Pedidos',       'Ajustar peso',                 'Informar o peso real da balanca', 24),
  ('pedidos.marcar_indisponivel',    'Pedidos',       'Marcar item em falta',         'Remover item indisponivel do pedido', 25),
  ('pedidos.cancelar',               'Pedidos',       'Cancelar pedido',              'Exige motivo', 26),
  ('pedidos.imprimir',               'Pedidos',       'Imprimir pedido',              'Via de impressao', 27),

  ('produtos.ver',                   'Produtos',      'Ver produtos',                 null, 30),
  ('produtos.criar',                 'Produtos',      'Criar produto',                null, 31),
  ('produtos.editar',                'Produtos',      'Editar produto',               'Nome, preco, categoria, imagem', 32),
  ('produtos.desativar',             'Produtos',      'Ativar/desativar produto',     'Sai do catalogo', 33),
  ('produtos.alterar_disponibilidade','Produtos',     'Alterar disponibilidade',      'Botao rapido acabou/voltou', 34),
  ('categorias.gerenciar',           'Produtos',      'Gerenciar categorias',         'Criar, editar, ordenar', 35),

  ('entregas.ver',                   'Entregas',      'Ver entregas',                 'Fila e minhas entregas', 40),
  ('entregas.ver_todas',             'Entregas',      'Ver entregas de todos',        null, 41),
  ('entregas.assumir',               'Entregas',      'Assumir entrega',              null, 42),
  ('entregas.iniciar',               'Entregas',      'Iniciar entrega',              null, 43),
  ('entregas.finalizar',             'Entregas',      'Finalizar entrega',            null, 44),
  ('entregas.atribuir',              'Entregas',      'Atribuir entrega a outro',     null, 45),

  ('clientes.ver',                   'Clientes',      'Ver clientes',                 null, 50),

  ('equipe.ver',                     'Equipe',        'Ver equipe',                   null, 60),
  ('equipe.cadastrar',               'Equipe',        'Cadastrar funcionario',        null, 61),
  ('equipe.editar',                  'Equipe',        'Editar funcionario',           null, 62),
  ('equipe.desativar',               'Equipe',        'Desativar funcionario',        'Nunca excluir quem tem historico', 63),
  ('equipe.alterar_permissoes',      'Equipe',        'Alterar permissoes',           'Nunca concede o que nao possui', 64),
  ('equipe.cadastrar_admin',         'Equipe',        'Cadastrar administrador',      null, 65),

  ('config.acessar',                 'Configuracoes', 'Acessar configuracoes',        null, 70),
  ('config.mercado',                 'Configuracoes', 'Dados do mercado',             'Nome, telefone, logo, endereco', 71),
  ('config.pagamentos',              'Configuracoes', 'Formas de pagamento',          null, 72),
  ('config.pix',                     'Configuracoes', 'Chave PIX',                    null, 73),
  ('config.taxa_entrega',            'Configuracoes', 'Zonas e taxas de entrega',     null, 74),
  ('config.pedido_minimo',           'Configuracoes', 'Pedido minimo',                null, 75),
  ('config.delivery_status',         'Configuracoes', 'Abrir/fechar o delivery',      null, 76)
on conflict (code) do nothing;

insert into public.permission_presets (slug, name, description, is_system, sort_order) values
  ('administrador', 'Administrador', 'Acesso total ao sistema', true, 1),
  ('balconista',    'Balconista',    'Operacao do balcao: pedidos, separacao e disponibilidade', true, 2),
  ('motoboy',       'Motoboy',       'Entregas', true, 3)
on conflict (slug) do nothing;

-- Administrador: todas as permissoes
insert into public.preset_permissions (preset_id, permission_code)
select p.id, c.code
  from public.permission_presets p cross join public.permissions c
 where p.slug = 'administrador'
on conflict do nothing;

-- Balconista (sugestao inicial - o administrador ajusta por pessoa)
insert into public.preset_permissions (preset_id, permission_code)
select p.id, c.code
  from public.permission_presets p join public.permissions c on c.code in (
    'dashboard.ver',
    'pedidos.ver', 'pedidos.alterar_status', 'pedidos.separar', 'pedidos.ajustar_peso',
    'pedidos.marcar_indisponivel', 'pedidos.imprimir',
    'produtos.ver', 'produtos.alterar_disponibilidade',
    'clientes.ver'
  )
 where p.slug = 'balconista'
on conflict do nothing;

-- Motoboy (sugestao inicial)
insert into public.preset_permissions (preset_id, permission_code)
select p.id, c.code
  from public.permission_presets p join public.permissions c on c.code in (
    'entregas.ver', 'entregas.assumir', 'entregas.iniciar', 'entregas.finalizar'
  )
 where p.slug = 'motoboy'
on conflict do nothing;

-- Categorias iniciais -----------------------------------------------------------
insert into public.categories (name, slug, sort_order) values
  ('Acougue',    'acougue',    1),
  ('Frios',      'frios',      2),
  ('Bebidas',    'bebidas',    3),
  ('Padaria',    'padaria',    4),
  ('Mercearia',  'mercearia',  5),
  ('Hortifruti', 'hortifruti', 6),
  ('Higiene',    'higiene',    7),
  ('Limpeza',    'limpeza',    8)
on conflict (slug) do nothing;

-- Zonas de entrega EXEMPLO (substituir em Configuracoes > Entrega) --------------
insert into public.delivery_zones (name, fee, sort_order) values
  ('Centro',  5.00,  1),
  ('Zona 1',  7.00,  2),
  ('Zona 2', 10.00,  3);

insert into public.zone_neighborhoods (zone_id, name)
select z.id, b.bairro
  from public.delivery_zones z
  join (values
    ('Centro', 'Centro'),
    ('Zona 1', 'Bairro A'),
    ('Zona 2', 'Bairro B')
  ) as b(zona, bairro) on b.zona = z.name
on conflict do nothing;

-- Produtos EXEMPLO para testar o fluxo (remover antes do go-live) ---------------
insert into public.products (category_id, name, slug, short_description, unit_type, sold_by_weight, price, sort_order)
select c.id, 'Alcatra', 'alcatra', 'Corte bovino, peca ou em bifes', 'kg', true, 49.90, 1
  from public.categories c where c.slug = 'acougue'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, unit_type, sold_by_weight, price, sort_order)
select c.id, 'Coca-Cola 2L', 'coca-cola-2l', 'Refrigerante garrafa 2 litros', 'unidade', false, 10.00, 1
  from public.categories c where c.slug = 'bebidas'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, unit_type, sold_by_weight, price, sort_order)
select c.id, 'Queijo mussarela', 'queijo-mussarela', 'Fatiado na hora', 'kg', true, 42.00, 1
  from public.categories c where c.slug = 'frios'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, unit_type, sold_by_weight, price, sort_order)
select c.id, 'Arroz 5kg', 'arroz-5kg', 'Tipo 1', 'pacote', false, 24.90, 1
  from public.categories c where c.slug = 'mercearia'
on conflict (slug) do nothing;
