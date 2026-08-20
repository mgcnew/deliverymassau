import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

/**
 * Link de "voltar" com alvo de toque de 40px de altura. Como texto puro ele
 * ficava com 18px, dificil de acertar com o polegar no meio do corredor.
 */
export function LinkVoltar({
  children,
  className = '',
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link
      className={`-ml-1 inline-flex h-10 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-muted hover:bg-foreground/5 ${className}`}
      {...props}
    >
      <span aria-hidden>&lsaquo;</span>
      {children}
    </Link>
  )
}
