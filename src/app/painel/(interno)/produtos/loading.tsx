import { SkeletonLista } from '@/components/ui/skeleton'

export default function CarregandoProdutos() {
  return (
    <div className="w-full space-y-4">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-black/[0.06]" />
      <div className="h-12 w-full max-w-xl animate-pulse rounded-xl bg-black/[0.06] lg:max-w-xl" />
      <SkeletonLista linhas={6} />
    </div>
  )
}
