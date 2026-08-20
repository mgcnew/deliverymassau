'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

import { montarMensagemCompartilhamento } from '@/lib/loja/mensagem-compartilhamento'

/**
 * A loja publica agora vive em /loja, sem link nenhum na raiz do dominio.
 * Este botao monta uma mensagem convite (com nome do mercado, endereco e
 * link) e compartilha (WhatsApp nativo, se disponivel no aparelho, ou copia
 * pra area de transferencia). Com nomeCliente, a mensagem fica personalizada
 * -- usado na tela do cliente pra convidar de volta quem ja comprou antes.
 */
export function CompartilharLoja({
  nomeMercado,
  endereco,
  nomeCliente,
  rotulo = 'Compartilhar loja',
}: {
  nomeMercado: string
  endereco: string | null
  nomeCliente?: string | null
  rotulo?: string
}) {
  const [copiado, setCopiado] = useState(false)

  async function compartilhar() {
    const url = `${window.location.origin}/loja`
    const texto = montarMensagemCompartilhamento({ nomeMercado, endereco, url, nomeCliente })

    if (navigator.share) {
      try {
        // Sem url separada: ja esta embutida no texto, senao alguns apps
        // (WhatsApp incluso) mandam o link duplicado no final.
        await navigator.share({ title: nomeMercado, text: texto })
      } catch {
        // usuario cancelou o compartilhamento nativo: nao faz nada
      }
      return
    }

    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      window.prompt('Copie a mensagem:', texto)
    }
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-foreground hover:bg-foreground/5"
    >
      {copiado ? <Check size={18} className="text-emerald-600" aria-hidden /> : <Share2 size={18} aria-hidden />}
      <span className="hidden sm:inline">{copiado ? 'Mensagem copiada!' : rotulo}</span>
    </button>
  )
}
