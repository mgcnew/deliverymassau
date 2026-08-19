import { createClient } from '@/lib/supabase/server'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type PublicSettings = {
  market_name: string
  delivery_enabled: boolean
  delivery_closed_message: string
  min_order_value: number
}

export default async function LojaPage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_public_settings')
  const settings = data as PublicSettings | null

  const aberto = settings?.delivery_enabled ?? false

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 p-6">
      <header className="space-y-1 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Delivery</p>
        <h1 className="text-3xl font-black">{settings?.market_name ?? 'Mercado Massa 24h'}</h1>
      </header>

      <Card className="space-y-2 text-center">
        {aberto ? (
          <>
            <p className="text-lg font-bold">Estamos abertos</p>
            <p className="text-muted">
              Pedido minimo de{' '}
              {(settings?.min_order_value ?? 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
              . A vitrine de produtos entra na proxima etapa.
            </p>
          </>
        ) : (
          <p className="text-lg font-bold">
            {settings?.delivery_closed_message ?? 'Delivery temporariamente indisponivel.'}
          </p>
        )}
      </Card>

      <div className="text-center">
        <ButtonLink href="/painel" variant="ghost">
          Sou da equipe
        </ButtonLink>
      </div>
    </main>
  )
}
