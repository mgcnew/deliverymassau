'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

/**
 * A loja publica agora vive em /loja, sem link nenhum na raiz do dominio.
 * Este botao gera e compartilha esse link com o cliente (WhatsApp, se
 * disponivel no aparelho, ou copia para a area de transferencia).
 */
export function CompartilharLoja({ nomeMercado }: { nomeMercado: string }) {
  const [copiado, setCopiado] = useState(false)

  async function compartilhar() {
    const url = `${window.location.origin}/loja`
    const texto = `Peça seu delivery no ${nomeMercado}: ${url}`

    if (navigator.share) {
      try {
        await navigator.share({ title: nomeMercado, text: texto, url })
      } catch {
        // usuario cancelou o compartilhamento nativo: nao faz nada
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      window.prompt('Copie o link da loja:', url)
    }
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-foreground hover:bg-black/5"
    >
      {copiado ? <Check size={18} className="text-emerald-600" aria-hidden /> : <Share2 size={18} aria-hidden />}
      <span className="hidden sm:inline">{copiado ? 'Link copiado!' : 'Compartilhar loja'}</span>
    </button>
  )
}
