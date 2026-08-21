'use client'

import { MessageCircle } from 'lucide-react'

import { linkWhatsapp } from '@/lib/orders/navegacao'

/** Codigo que so o cliente conhece, para falar ao entregador na porta. */
export function CodigoEntrega({ codigo, numeroPedido }: { codigo: string; numeroPedido: number }) {
  const mensagem = `Meu codigo de entrega do pedido #${numeroPedido} e: ${codigo}`

  return (
    <div className="space-y-2 rounded-2xl border-2 border-dashed border-brand bg-brand/5 p-4 text-center">
      <p className="font-bold">Codigo de confirmacao da entrega</p>
      <p className="text-4xl font-black tracking-[0.3em] text-brand">{codigo}</p>
      <p className="text-sm text-muted">
        Guarde este numero e fale para o entregador quando ele chegar. Isso evita fraude na
        entrega.
      </p>
      <a
        href={linkWhatsapp(null, mensagem)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold"
      >
        <MessageCircle size={18} /> Enviar por WhatsApp
      </a>
    </div>
  )
}
