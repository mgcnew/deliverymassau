import { Skeleton } from '@/components/ui/skeleton'

/**
 * Esqueleto proprio: o relatorio e a tela mais pesada do painel (uma RPC que
 * varre o periodo inteiro), entao o loading boundary aqui nao e enfeite - e
 * o que deixa o Next prefetchar a rota e o clique responder na hora.
 */
export default function CarregandoRelatorios() {
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-72" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      <Skeleton className="h-64" />

      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    </div>
  )
}
