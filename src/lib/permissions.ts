// Codigos de permissao. Mesma lista da tabela public.permissions.
// A interface esconde o que o usuario nao pode; o banco impede de verdade (RLS + RPC).

export const PERMISSIONS = {
  dashboardVer: 'dashboard.ver',

  pedidosVer: 'pedidos.ver',
  pedidosEditar: 'pedidos.editar',
  pedidosAlterarStatus: 'pedidos.alterar_status',
  pedidosSeparar: 'pedidos.separar',
  pedidosAjustarPeso: 'pedidos.ajustar_peso',
  pedidosMarcarIndisponivel: 'pedidos.marcar_indisponivel',
  pedidosCancelar: 'pedidos.cancelar',
  pedidosImprimir: 'pedidos.imprimir',

  produtosVer: 'produtos.ver',
  produtosCriar: 'produtos.criar',
  produtosEditar: 'produtos.editar',
  produtosDesativar: 'produtos.desativar',
  produtosAlterarDisponibilidade: 'produtos.alterar_disponibilidade',
  categoriasGerenciar: 'categorias.gerenciar',

  entregasVer: 'entregas.ver',
  entregasVerTodas: 'entregas.ver_todas',
  entregasAssumir: 'entregas.assumir',
  entregasIniciar: 'entregas.iniciar',
  entregasFinalizar: 'entregas.finalizar',
  entregasAtribuir: 'entregas.atribuir',

  clientesVer: 'clientes.ver',

  equipeVer: 'equipe.ver',
  equipeCadastrar: 'equipe.cadastrar',
  equipeEditar: 'equipe.editar',
  equipeDesativar: 'equipe.desativar',
  equipeAlterarPermissoes: 'equipe.alterar_permissoes',
  equipeCadastrarAdmin: 'equipe.cadastrar_admin',

  configAcessar: 'config.acessar',
  configMercado: 'config.mercado',
  configPagamentos: 'config.pagamentos',
  configPix: 'config.pix',
  configTaxaEntrega: 'config.taxa_entrega',
  configPedidoMinimo: 'config.pedido_minimo',
  configDeliveryStatus: 'config.delivery_status',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
