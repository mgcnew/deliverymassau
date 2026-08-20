import { Skeleton } from '@/components/ui/skeleton'

export default function CarregandoPedidos() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-32 animate-pulse rounded-lg bg-foreground/[0.06]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  )
}
