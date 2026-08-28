'use client'

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'

/**
 * Fica fora da nota impressa (classe nao-imprimir): na folha, sairia como
 * dois retangulos vazios.
 */
export function ControlesNota({ token }: { token: string }) {
  return (
    <div className="nao-imprimir mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 p-4">
      <Link
        href={`/pedido/${token}`}
        className="flex h-11 items-center gap-2 rounded-xl border border-line px-4 font-semibold"
      >
        <ArrowLeft size={18} aria-hidden />
        Voltar ao pedido
      </Link>

      <button
        type="button"
        onClick={() => window.print()}
        className="flex h-11 items-center gap-2 rounded-xl bg-brand px-4 font-bold text-brand-foreground"
      >
        <Printer size={18} aria-hidden />
        Imprimir ou salvar PDF
      </button>
    </div>
  )
}
