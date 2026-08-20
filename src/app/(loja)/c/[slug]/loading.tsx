import { SkeletonGrade } from '@/components/ui/skeleton'

export default function CarregandoCategoria() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <div className="h-12 w-full animate-pulse rounded-xl bg-foreground/[0.06]" />
      <div className="h-8 w-40 animate-pulse rounded-lg bg-foreground/[0.06]" />
      <SkeletonGrade itens={8} />
    </main>
  )
}
