import { SkeletonLista } from '@/components/ui/skeleton'

export default function CarregandoClientes() {
  return (
    <div className="w-full space-y-4">
      <div className="h-8 w-32 animate-pulse rounded-lg bg-black/[0.06]" />
      <div className="h-12 w-full max-w-xl animate-pulse rounded-xl bg-black/[0.06]" />
      <SkeletonLista linhas={8} />
    </div>
  )
}
