import { SkeletonGrade } from '@/components/ui/skeleton'

export default function CarregandoLoja() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <div className="h-12 w-full animate-pulse rounded-xl bg-foreground/[0.06]" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-foreground/[0.06]" />
        ))}
      </div>
      <SkeletonGrade itens={8} />
    </main>
  )
}
