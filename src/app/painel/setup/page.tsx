import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'
import { Alert, Card } from '@/components/ui/card'
import { SetupForm } from './setup-form'

export const metadata = { title: 'Primeiro acesso | Mercado Massa 24h' }

export default async function SetupPage() {
  let semChave = false
  let jaTemEquipe = false

  try {
    const admin = createAdminClient()
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
    jaTemEquipe = (count ?? 0) > 0
  } catch {
    semChave = true
  }

  if (jaTemEquipe) redirect('/painel/login')

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Primeiro acesso</p>
        <h1 className="text-2xl font-black">Criar o administrador</h1>
        <p className="mt-1 text-sm text-muted">
          Esta tela some assim que existir o primeiro funcionario cadastrado.
        </p>
      </div>

      <Card>
        {semChave ? (
          <Alert tone="error">
            Configure SUPABASE_SERVICE_ROLE_KEY no arquivo .env.local (Supabase &gt; Project
            Settings &gt; API Keys &gt; service_role) e recarregue esta pagina.
          </Alert>
        ) : (
          <SetupForm />
        )}
      </Card>
    </main>
  )
}
