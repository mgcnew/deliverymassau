'use client'

import { Share2 } from 'lucide-react'

import { montarMensagemCompartilhamento } from '@/lib/loja/mensagem-compartilhamento'
import { linkWhatsapp } from '@/lib/orders/navegacao'

/**
 * A loja publica agora vive em /loja, sem link nenhum na raiz do dominio.
 * Este botao monta uma mensagem convite (nome do mercado, endereco e link)
 * e abre direto no WhatsApp -- pro numero do cliente quando veio da tela
 * dele, ou deixando a pessoa escolher o contato quando e o convite generico.
 */
export function CompartilharLoja({
  nomeMercado,
  endereco,
  telefoneCliente,
  nomeCliente,
  rotulo = 'Compartilhar loja',
}: {
  nomeMercado: string
  endereco: string | null
  telefoneCliente?: string | null
  nomeCliente?: string | null
  rotulo?: string
}) {
  function compartilhar() {
    const url = `${window.location.origin}/loja`
    const texto = montarMensagemCompartilhamento({ nomeMercado, endereco, url, nomeCliente })
    window.open(linkWhatsapp(telefoneCliente, texto), '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-foreground hover:bg-foreground/5"
    >
      <Share2 size={18} aria-hidden />
      <span className="hidden sm:inline">{rotulo}</span>
    </button>
  )
}
