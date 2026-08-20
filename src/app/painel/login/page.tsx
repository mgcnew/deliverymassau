import { Card } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import { LoginForm } from './login-form'

export const metadata = { title: 'Entrar | Mercado Massa 24h' }

export default async function LoginPage({ searchParams }: PageProps<'/painel/login'>) {
  const params = await searchParams
  const redirectTo = typeof params.redirect === 'string' ? params.redirect : '/painel'

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo altura={44} />
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Painel interno</p>
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
