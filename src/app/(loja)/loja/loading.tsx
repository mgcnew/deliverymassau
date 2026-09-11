export default function CarregandoLoja() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-7 p-4">
      <div className="h-12 w-full animate-pulse rounded-xl bg-foreground/[0.06]" />
      <div className="space-y-3">
        <div className="h-7 w-32 animate-pulse rounded-lg bg-foreground/[0.06]" />
        {/* Mesma grade das categorias: nada pula de lugar quando carrega. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-[74px] animate-pulse rounded-2xl bg-foreground/[0.06]" />
          ))}
        </div>
      </div>
    </main>
  )
}
