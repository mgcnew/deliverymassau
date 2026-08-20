/** Mensagem convite pra loja, usada no botao "Compartilhar" do painel. */
export function montarMensagemCompartilhamento({
  nomeMercado,
  endereco,
  url,
  nomeCliente,
}: {
  nomeMercado: string
  endereco: string | null
  url: string
  /** Quando vem de um cliente especifico, a mensagem fica personalizada. */
  nomeCliente?: string | null
}): string {
  const linhas = nomeCliente
    ? [
        `Oi, ${nomeCliente}! 👋`,
        `Que tal fazer mais um pedido no *${nomeMercado}*? Entrega rápida, direto na sua casa, a qualquer hora do dia. 🛒`,
      ]
    : [
        `🛒 *${nomeMercado}* — seu mercado aberto 24 horas!`,
        'Peça agora e receba rapidinho em casa, sem sair do sofá. 🚀',
      ]

  if (endereco) linhas.push(`📍 ${endereco}`)
  linhas.push('', `👉 Faça seu pedido: ${url}`)

  return linhas.join('\n')
}
