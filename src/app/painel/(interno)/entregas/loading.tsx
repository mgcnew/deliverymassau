import { Skeleton } from '@/components/ui/skeleton'

export default function CarregandoEntregas() {
  return (
    <div className="w-full space-y-4">
      <div className="h-8 w-28 animate-pulse rounded-lg bg-black/[0.06]" />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  )
}
