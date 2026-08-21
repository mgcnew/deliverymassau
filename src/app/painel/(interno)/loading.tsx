import { Skeleton } from '@/components/ui/skeleton'

/**
 * Esqueleto padrao do painel: vale para o dashboard e para as telas que nao
 * tem loading.tsx proprio (equipe, configuracoes, categorias). Pedidos,
 * entregas, produtos e clientes tem os seus, com o formato de cada uma.
 *
 * Existe por um motivo de desempenho, nao so estetico: rota dinamica SEM
 * loading boundary nao e prefetchada pelo Next (docs de prefetching:
 * "Dynamic page -> Prefetched: No, unless loading.js"). Sem este arquivo, o
 * clique nessas telas ficava parado, sem feedback, ate o servidor responder.
 */
export default function CarregandoPainel() {
  return (
    <div className="w-full space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
