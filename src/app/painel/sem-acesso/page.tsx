import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const metadata = { title: 'Sem acesso | Mercado Massa 24h' }

export default async function SemAcessoPage({ searchParams }: PageProps<'/painel/sem-acesso'>) {
  const params = await searchParams
  const codigo = typeof params.p === 'string' ? params.p : null

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
      <Card className="space-y-3 text-center">
        <h1 className="text-xl font-bold">Voce nao tem acesso a esta area</h1>
        <p className="text-muted">
          Peca a um administrador para liberar
          {codigo ? <span className="font-mono font-semibold"> {codigo}</span> : ' a permissao'} no
          seu cadastro.
        </p>
        <ButtonLink href="/painel" variant="secondary" className="w-full">
          Voltar ao painel
        </ButtonLink>
      </Card>
    </main>
  )
}
