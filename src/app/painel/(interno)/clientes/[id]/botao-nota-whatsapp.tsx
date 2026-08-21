'use client'

import { MessageCircle } from 'lucide-react'

import { montarMensagemNota } from '@/lib/loja/mensagem-compartilhamento'
import { linkWhatsapp } from '@/lib/orders/navegacao'

/**
 * Em vez de abrir a tela de impressao, manda direto pro WhatsApp do
 * cliente um agradecimento com o link da nota (a mesma pagina publica
 * /pedido/[token] que ele ja usa pra acompanhar -- funciona sem login).
 */
export function BotaoNotaWhatsapp({
  telefone,
  nomeCliente,
  nomeMercado,
  numeroPedido,
  token,
}: {
  telefone: string
  nomeCliente: string
  nomeMercado: string
  numeroPedido: number
  token: string
}) {
  function enviar() {
    const url = `${window.location.origin}/pedido/${token}`
    const texto = montarMensagemNota({ nomeMercado, nomeCliente, numeroPedido, url })
    window.open(linkWhatsapp(telefone, texto), '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={enviar}
      aria-label={`Enviar nota do pedido #${numeroPedido} pelo WhatsApp`}
      title="Enviar nota pelo WhatsApp"
      className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-foreground/5"
    >
      <MessageCircle size={20} aria-hidden />
    </button>
  )
}
