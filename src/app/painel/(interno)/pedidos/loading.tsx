import { Skeleton } from '@/components/ui/skeleton'

export default function CarregandoPedidos() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-foreground/[0.06]" />
        <Skeleton className="h-11 w-44" />
      </div>
      {/* Celular: seletor das etapas + lista; computador: as 4 colunas */}
      <Skeleton className="h-16 lg:hidden" />
      <div className="grid gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`space-y-2 ${i > 1 ? 'hidden lg:block' : ''}`}>
            <div className="hidden h-10 w-28 animate-pulse rounded-lg bg-foreground/[0.06] lg:block" />
            <Skeleton className="h-40" />
          </div>
        ))}
      </div>
    </div>
  )
}
