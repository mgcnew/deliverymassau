'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MapPin, MessageCircle, Navigation, Phone } from 'lucide-react'

import { moeda } from '@/lib/format'
import {
  enderecoTexto,
  linkGoogleMaps,
  linkTelefone,
  linkWaze,
  linkWhatsapp,
} from '@/lib/orders/navegacao'
import { assumirEntrega, finalizarEntrega, iniciarEntrega, liberarEntrega } from '../pedidos/actions'
import { PAGAMENTO_CURTO } from '../pedidos/tipos'
import type { EntregaCard } from './tipos'

export function CardEntrega({
  entrega,
  cidade,
  minha,
  permissoes,
  aoAssumir,
}: {
  entrega: EntregaCard
  cidade: string | null
  minha: boolean
  permissoes: { assumir: boolean; iniciar: boolean; finalizar: boolean }
  aoAssumir?: () => void
}) {
  const router = useRouter()
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const endereco = {
    street: entrega.address_street,
    number: entrega.address_number,
    district: entrega.address_district,
    city: cidade,
  }

  function rodar(fn: () => Promise<{ erro?: string }>, aoDarCerto?: () => void) {
    setErro(null)
    startTransition(async () => {
      const r = await fn()
      if (r.erro) setErro(r.erro)
      else aoDarCerto?.()
      router.refresh()
    })
  }

  return (
    <article className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-black leading-none">#{entrega.order_number}</p>
          <p className="mt-1 truncate font-semibold">{entrega.customer_name}</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-sm font-black text-brand-foreground">
          {entrega.address_district}
        </span>
      </div>

      <p className="text-lg font-semibold leading-tight">{enderecoTexto(endereco)}</p>
      {entrega.address_complement ? (
        <p className="text-muted">{entrega.address_complement}</p>
      ) : null}
      {entrega.address_reference ? (
        <p className="text-muted">Ref: {entrega.address_reference}</p>
      ) : null}
      {entrega.customer_note ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 font-semibold text-amber-900">
          {entrega.customer_note}
        </p>
      ) : null}

      <div className="rounded-xl bg-black/[0.04] p-3">
        <p className="text-sm text-muted">Receber na entrega</p>
        <p className="text-2xl font-black">{moeda(Number(entrega.total))}</p>
        <p className="font-bold">{PAGAMENTO_CURTO[entrega.payment_method]}</p>
        {entrega.needs_change ? (
          <p className="font-bold text-amber-800">
            Troco para {moeda(Number(entrega.change_for ?? 0))} - levar{' '}
            {moeda(Number(entrega.change_amount ?? 0))}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={linkGoogleMaps(endereco)}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line font-bold"
        >
          <MapPin size={18} /> Maps
        </a>
        <a
          href={linkWaze(endereco)}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line font-bold"
        >
          <Navigation size={18} /> Waze
        </a>
        <a
          href={linkTelefone(entrega.customer_phone)}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line font-bold"
        >
          <Phone size={18} /> Ligar
        </a>
        <a
          href={linkWhatsapp(
            entrega.customer_phone,
            `Ola! Sou do Mercado Massa 24h e estou a caminho com o pedido #${entrega.order_number}.`,
          )}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line font-bold"
        >
          <MessageCircle size={18} /> WhatsApp
        </a>
      </div>

      {!minha && permissoes.assumir ? (
        <button
          type="button"
          disabled={transicao}
          onClick={() => rodar(() => assumirEntrega(entrega.id), aoAssumir)}
          className="h-16 w-full rounded-xl bg-brand text-lg font-black text-brand-foreground"
        >
          {transicao ? 'Assumindo...' : 'ASSUMIR ENTREGA'}
        </button>
      ) : null}

      {minha && entrega.status === 'aguardando_entregador' ? (
        <div className="space-y-2">
          {permissoes.iniciar ? (
            <button
              type="button"
              disabled={transicao}
              onClick={() => rodar(() => iniciarEntrega(entrega.id))}
              className="h-16 w-full rounded-xl bg-brand text-lg font-black text-brand-foreground"
            >
              {transicao ? 'Iniciando...' : 'INICIAR ENTREGA'}
            </button>
          ) : null}
          <button
            type="button"
            disabled={transicao}
            onClick={() => rodar(() => liberarEntrega(entrega.id))}
            className="h-12 w-full rounded-xl border border-line font-bold text-muted"
          >
            Devolver para a fila
          </button>
        </div>
      ) : null}

      {minha && entrega.status === 'saiu_para_entrega' && permissoes.finalizar ? (
        <button
          type="button"
          disabled={transicao}
          onClick={() => rodar(() => finalizarEntrega(entrega.id))}
          className="h-16 w-full rounded-xl bg-emerald-600 text-lg font-black text-white"
        >
          {transicao ? 'Finalizando...' : 'MARCAR COMO ENTREGUE'}
        </button>
      ) : null}

      <Link
        href={`/painel/pedidos/${entrega.id}`}
        className="block text-center text-sm font-semibold text-muted underline"
      >
        Ver itens do pedido
      </Link>

      {erro ? <p className="text-center font-semibold text-rose-700">{erro}</p> : null}
    </article>
  )
}
