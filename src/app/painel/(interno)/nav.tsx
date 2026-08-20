'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bike,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react'

export type NavItem = { href: string; label: string; icon: string }

const ICONS = {
  dashboard: LayoutDashboard,
  pedidos: Receipt,
  produtos: Package,
  entregas: Bike,
  clientes: UsersRound,
  equipe: Users,
  config: Settings,
} as const

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/painel' ? pathname === '/painel' : pathname.startsWith(href)

  return (
    <>
      {/* Desktop / tablet */}
      <nav className="hidden w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-3 md:flex">
        {items.map((item) => {
          const Icon = ICONS[item.icon as keyof typeof ICONS]
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 font-semibold ${
                isActive(item.href) ? 'bg-brand text-brand-foreground' : 'hover:bg-foreground/5'
              }`}
            >
              <Icon size={20} aria-hidden />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Celular */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.slice(0, 5).map((item) => {
          const Icon = ICONS[item.icon as keyof typeof ICONS]
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                isActive(item.href) ? 'text-brand' : 'text-muted'
              }`}
            >
              <Icon size={22} aria-hidden />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
