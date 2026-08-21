import Link from 'next/link'

import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { PERMISSIONS } from '@/lib/permissions'
import { PainelIndicadores, type Indicadores } from './indicadores'
import { InterruptorDelivery } from './interruptor-delivery'

export const metadata = { title: 'Painel | Mercado Massa 24h' }

const ATALHOS = [
  { href: '/painel/pedidos', titulo: 'Pedidos', texto: 'Receber, separar e despachar', permission: PERMISSIONS.pedidosVer },
  { href: '/painel/entregas', titulo: 'Entregas', texto: 'Fila e minhas entregas', permission: PERMISSIONS.entregasVer },
  { href: '/painel/produtos', titulo: 'Produtos', texto: 'Disponibilidade e cadastro', permission: PERMISSIONS.produtosVer },
  { href: '/painel/equipe', titulo: 'Equipe', texto: 'Funcionarios e permissoes', permission: PERMISSIONS.equipeVer },
  { href: '/painel/configuracoes', titulo: 'Configuracoes', texto: 'Entrega, pagamento e mercado', permission: PERMISSIONS.configAcessar },
]

export default async function PainelHome() {
  const staff = await requireStaff()
  const supabase = await createClient()

  const [{ data: settings }, indicadores] = await Promise.all([
    supabase.from('settings').select('market_name, delivery_enabled').eq('id', 1).maybeSingle(),
    staff.permissions.has(PERMISSIONS.dashboardVer)
      ? supabase.rpc('dashboard_hoje').then(({ data }) => data as Indicadores | null)
      : Promise.resolve(null),
  ])

  const atalhos = ATALHOS.filter((a) => staff.permissions.has(a.permission))

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-2xl font-black">Ola, {staff.profile.name.split(' ')[0]}</h1>
        <p className="text-muted">{settings?.market_name ?? 'Mercado Massa 24h'}</p>
      </div>

      <InterruptorDelivery
        ativo={settings?.delivery_enabled ?? false}
        podeAlterar={staff.permissions.has(PERMISSIONS.configDeliveryStatus)}
      />

      {indicadores ? <PainelIndicadores dados={indicadores} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {atalhos.map((a) => (
          <Link key={a.href} href={a.href}>
            <Card className="h-full transition hover:border-brand">
              <p className="text-lg font-bold">{a.titulo}</p>
              <p className="text-muted">{a.texto}</p>
            </Card>
          </Link>
        ))}
      </div>

    </div>
  )
}
