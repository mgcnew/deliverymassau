'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'

import { moeda } from '@/lib/format'
import { useCarrinho } from './use-carrinho'

const ESCONDER_EM = ['/carrinho', '/checkout']

/**
 * O carrinho fica sempre ao alcance do polegar - e diz, antes de a pessoa
 * chegar no checkout, o que ainda falta: o valor do pedido minimo, ou que a
 * loja esta fechada (o carrinho fica guardado ate abrir).
 */
export function BarraCarrinho({
  pedidoMinimo,
  aberto,
  abreEm,
}: {
  pedidoMinimo: number
  aberto: boolean
  /** "amanha as 8h" - ja formatado no fuso do mercado pelo servidor. */
  abreEm: string | null
}) {
  const { itens, subtotal, carregado } = useCarrinho()
  const pathname = usePathname()

  if (!carregado || itens.length === 0) return null
  if (ESCONDER_EM.some((rota) => pathname.startsWith(rota))) return null
  if (pathname.startsWith('/painel') || pathname.startsWith('/pedido')) return null

  const falta = Math.max(0, pedidoMinimo - subtotal)
  const aviso = !aberto
    ? `Fechado agora${abreEm ? ` - abrimos ${abreEm}` : ''}. Seu carrinho fica guardado.`
    : falta > 0
      ? `Faltam ${moeda(falta)} para o pedido minimo de ${moeda(pedidoMinimo)}`
      : null

  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-surface p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {aviso ? (
        <p
          aria-live="polite"
          className={`mx-auto mb-2 max-w-2xl text-center text-sm font-semibold ${
            aberto ? 'text-foreground' : 'text-amber-900 dark:text-amber-200'
          }`}
        >
          {aviso}
        </p>
      ) : null}
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
