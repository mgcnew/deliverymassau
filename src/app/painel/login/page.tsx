import { Card } from '@/components/ui/card'
import { LoginForm } from './login-form'

export const metadata = { title: 'Entrar | Mercado Massa 24h' }

export default async function LoginPage({ searchParams }: PageProps<'/painel/login'>) {
  const params = await searchParams
  const redirectTo = typeof params.redirect === 'string' ? params.redirect : '/painel'

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Painel interno</p>
        <h1 className="text-2xl font-black">Mercado Massa 24h</h1>
      </div>

      <Card>
        <LoginForm redirectTo={redirectTo} />
      </Card>

      <p className="text-center text-sm text-muted">
        Acesso apenas para a equipe. Clientes compram pelo portal, sem login.
      </p>
    </main>
  )
}
