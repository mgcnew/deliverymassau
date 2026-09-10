'use client'

import { useAtualizacaoAoVivo } from '@/lib/tempo-real/use-atualizacao-ao-vivo'

/**
 * Pagina inicial do painel em dia sozinha: os numeros do dia ("Novos
 * esperando", "Aguardando entregador"...) e a lista "Precisa de atencao" so
 * mudavam recarregando.
 *
 * postgres_changes em orders, como a tela de Pedidos: quem esta logado passa
 * pela RLS e recebe os eventos. O intervalo de 30s do hook tambem faz os
 * minutos de "parado ha" andarem sem evento nenhum.
 */
export function InicioAoVivo() {
  useAtualizacaoAoVivo({ canal: 'painel-inicio', tabelas: ['orders'] })
  return null
}
