'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Formato = '58mm' | '80mm' | 'a4'

const OPCOES: Array<{ valor: Formato; label: string }> = [
  { valor: '58mm', label: 'Bluetooth 58mm' },
  { valor: '80mm', label: 'Termica 80mm' },
  { valor: 'a4', label: 'Papel A4' },
]

export function ControlesImpressao({ orderId, auto }: { orderId: string; auto: boolean }) {
  const [formato, setFormato] = useState<Formato>('80mm')

  // Abre a caixa de impressao sozinho apenas quando veio do botao "Imprimir"
  // do pedido (?auto=1). Quem abre a via pelo link direto nao fica preso num
  // dialogo modal que nao pediu.
  useEffect(() => {
    if (!auto) return
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [auto])

  useEffect(() => {
    const via = document.querySelector('.via')
    via?.classList.toggle('via-a4', formato === 'a4')
    via?.classList.toggle('via-58mm', formato === '58mm')
  }, [formato])

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
        {OPCOES.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            onClick={() => setFormato(opcao.valor)}
            className={`h-11 px-4 text-sm font-semibold ${
              formato === opcao.valor ? 'bg-foreground text-white' : 'bg-surface'
            }`}
          >
            {opcao.label}
          </button>
        ))}
      </div>
    </div>
  )
}
