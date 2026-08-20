import type { ComponentProps, ReactNode } from 'react'

export function Card({ className = '', ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}
      {...props}
    />
  )
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{children}</h2>
      {action}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-muted">
      {children}
    </p>
  )
}

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error' | 'success'
  children: ReactNode
}) {
  const tones = {
    info: 'bg-[var(--tone-info-bg)] text-[var(--tone-info-fg)] border-[var(--tone-info-border)]',
    error: 'bg-[var(--tone-error-bg)] text-[var(--tone-error-fg)] border-[var(--tone-error-border)]',
    success:
      'bg-[var(--tone-success-bg)] text-[var(--tone-success-fg)] border-[var(--tone-success-border)]',
  }
  return (
    <p className={`rounded-xl border px-4 py-3 text-sm font-medium ${tones[tone]}`}>{children}</p>
  )
}
