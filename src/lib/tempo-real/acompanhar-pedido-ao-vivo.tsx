'use client'

import { useAtualizacaoAoVivo } from './use-atualizacao-ao-vivo'

/**
 * Faz a tela de UM pedido acompanhar sozinha as etapas (Separando, Saiu para
 * entrega...), a pesagem, os itens em falta e o cancelamento, sem recarregar.
 *
 * Usado na pagina do cliente (/pedido/[token]) e no detalhe do painel
 * (/painel/pedidos/[id]). O banco avisa pelo topico do token do pedido
 * (migration 0035) e a pagina busca de novo no servidor - no painel isso
 * tambem evita assinar postgres_changes de todos os pedidos para olhar um.
 *
 * O intervalo de 20s e rede de seguranca para quando o socket cai sem
 * avisar - quem esta olhando um pedido e exatamente quem mais sente uma
 * tela parada.
 */
export function AcompanharPedidoAoVivo({ token }: { token: string }) {
  useAtualizacaoAoVivo({
    canal: `pedido-${token}`,
    topicos: [`pedido:${token}`],
    intervaloMs: 20_000,
  })

  return null
}
