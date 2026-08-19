import { PERMISSIONS } from '@/lib/permissions'
import { requireStaff, touchLastSeen } from '@/lib/auth'
import { logoutAction } from '../login/actions'
import { Nav, type NavItem } from './nav'

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

  // O menu mostra somente o que a pessoa pode acessar.
  const items = MENU.filter((item) => staff.permissions.has(item.permission))

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Massa 24h</p>
          <p className="truncate text-sm font-bold">{staff.profile.name}</p>
        </div>
        <form action={logoutAction}>
          <button className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-black/5">
            Sair
          </button>
        </form>
      </header>

      <div className="flex flex-1">
        <Nav items={items} />
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>
    </div>
  )
}
