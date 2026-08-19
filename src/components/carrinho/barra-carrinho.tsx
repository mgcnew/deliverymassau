'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'

import { moeda } from '@/lib/format'
import { useCarrinho } from './carrinho-provider'

const ESCONDER_EM = ['/carrinho', '/checkout']

/** O carrinho fica sempre ao alcance do polegar. */
export function BarraCarrinho() {
  const { itens, subtotal, carregado } = useCarrinho()
  const pathname = usePathname()

  if (!carregado || itens.length === 0) return null
  if (ESCONDER_EM.some((rota) => pathname.startsWith(rota))) return null
  if (pathname.startsWith('/painel') || pathname.startsWith('/pedido')) return null

  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-surface/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
      <Link
        href="/carrinho"
        className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-3 rounded-xl bg-brand px-4 font-bold text-brand-foreground"
      >
        <span className="flex items-center gap-2">
          <ShoppingCart size={20} aria-hidden />
          {itens.length} {itens.length === 1 ? 'item' : 'itens'}
        </span>
        <span>Ver carrinho - {moeda(subtotal)}</span>
      </Link>
    </div>
  )
}
