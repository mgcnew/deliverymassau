'use client'

import { useAtualizacaoAoVivo } from '@/lib/tempo-real/use-atualizacao-ao-vivo'

/**
 * Faz a pagina do pedido acompanhar sozinha as etapas (Separando, Saiu para
 * entrega...), a pesagem e os itens em falta, sem o cliente recarregar.
 *
 * O banco avisa pelo topico do proprio token (migration 0035) e a pagina
 * busca de novo no servidor. O intervalo de 20s e rede de seguranca para
 * quando o socket cai sem avisar - o cliente olhando o pedido e exatamente
 * quem mais sente uma tela parada.
 */
export function AcompanharAoVivo({ token }: { token: string }) {
  useAtualizacaoAoVivo({
    canal: `pedido-${token}`,
    topicos: [`pedido:${token}`],
    intervaloMs: 20_000,
  })

  return null
}
