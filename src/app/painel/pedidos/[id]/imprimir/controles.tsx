'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function ControlesImpressao({ orderId, auto }: { orderId: string; auto: boolean }) {
  const [a4, setA4] = useState(false)

  // Abre a caixa de impressao sozinho apenas quando veio do botao "Imprimir"
  // do pedido (?auto=1). Quem abre a via pelo link direto nao fica preso num
  // dialogo modal que nao pediu.
  useEffect(() => {
    if (!auto) return
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [auto])

  useEffect(() => {
    document.querySelector('.via')?.classList.toggle('via-a4', a4)
  }, [a4])

  return (
    <div className="nao-imprimir mx-auto flex w-full max-w-2xl flex-wrap items-center gap-2 p-4">
      <Link
        href={`/painel/pedidos/${orderId}`}
        className="flex h-11 items-center rounded-xl border border-line bg-surface px-4 font-semibold"
      >
        &lsaquo; Voltar ao pedido
      </Link>

      <button
        type="button"
        onClick={() => window.print()}
        className="h-11 rounded-xl bg-brand px-5 font-bold text-brand-foreground"
      >
        Imprimir
      </button>

      <div className="flex overflow-hidden rounded-xl border border-line">
        <button
          type="button"
          onClick={() => setA4(false)}
          className={`h-11 px-4 font-semibold ${!a4 ? 'bg-foreground text-white' : 'bg-surface'}`}
        >
          Termica 80mm
        </button>
        <button
          type="button"
          onClick={() => setA4(true)}
          className={`h-11 px-4 font-semibold ${a4 ? 'bg-foreground text-white' : 'bg-surface'}`}
        >
          Papel A4
        </button>
      </div>
    </div>
  )
}
