import type { Metadata } from 'next'

import { PERMISSIONS } from '@/lib/permissions'
import { requireStaff, touchLastSeen } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { logoutAction } from '../login/actions'
import { CompartilharLoja } from './compartilhar-loja'
import { Nav, type NavItem } from './nav'

// App diferente da loja pra quem instala: publico interno, abre direto no
// painel em vez da vitrine.
export const metadata: Metadata = {
  manifest: '/manifest-painel.webmanifest',
}

const MENU: Array<NavItem & { permission: string }> = [
  { href: '/painel', label: 'Painel', icon: 'dashboard', permission: PERMISSIONS.dashboardVer },
  { href: '/painel/pedidos', label: 'Pedidos', icon: 'pedidos', permission: PERMISSIONS.pedidosVer },
  { href: '/painel/entregas', label: 'Entregas', icon: 'entregas', permission: PERMISSIONS.entregasVer },
  { href: '/painel/produtos', label: 'Produtos', icon: 'produtos', permission: PERMISSIONS.produtosVer },
  { href: '/painel/clientes', label: 'Clientes', icon: 'clientes', permission: PERMISSIONS.clientesVer },
  { href: '/painel/equipe', label: 'Equipe', icon: 'equipe', permission: PERMISSIONS.equipeVer },
  { href: '/painel/configuracoes', label: 'Configuracoes', icon: 'config', permission: PERMISSIONS.configAcessar },
]

export default async function PainelLayout({ children }: LayoutProps<'/painel'>) {
  const staff = await requireStaff()
  await touchLastSeen(staff)

  const supabase = await createClient()
  const { data: config } = await supabase
    .from('settings')
    .select('market_name, market_address, market_city')
    .eq('id', 1)
    .maybeSingle()

  const nomeMercado = config?.market_name ?? 'Mercado Massa 24h'
  const endereco = [config?.market_address, config?.market_city].filter(Boolean).join(', ') || null

  // O menu mostra somente o que a pessoa pode acessar.
  const items = MENU.filter((item) => staff.permissions.has(item.permission))

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo altura={30} className="shrink-0" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <CompartilharLoja nomeMercado={nomeMercado} endereco={endereco} />
          <form action={logoutAction}>
            <button className="h-11 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-foreground/5">
              Sair
            </button>
          </form>
        </div>
      </header>

      <div className="flex min-w-0 flex-1 overflow-hidden">
        <Nav items={items} />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>
    </div>
  )
}
