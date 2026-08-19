'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * A pagina do pedido (/pedido/[token]) e puramente self-service: o cliente
 * pode receber esse link por WhatsApp sem nenhum vinculo com a equipe.
 * Nas demais paginas da loja o atalho continua disponivel.
 */
export function RodapeEquipe() {
  const pathname = usePathname()
  if (pathname.startsWith('/pedido/')) return null

  return (
    <p className="pt-2">
      <Link href="/painel" className="font-semibold underline">
        Sou da equipe
      </Link>
    </p>
  )
}
