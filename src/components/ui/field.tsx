import type { ComponentProps, ReactNode } from 'react'

const control =
  'h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-foreground ' +
  'placeholder:text-muted/70'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
    </label>
  )
}

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input className={`${control} ${className}`} {...props} />
}

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return <select className={`${control} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={`min-h-24 w-full rounded-xl border border-line bg-surface p-3 text-base ${className}`}
      {...props}
    />
  )
}
