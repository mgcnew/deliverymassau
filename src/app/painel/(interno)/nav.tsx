'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Bike,
  ChartColumn,
  Ellipsis,
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
  relatorios: ChartColumn,
  equipe: Users,
  config: Settings,
} as const

/** Quantos botoes cabem na barra de baixo do celular. */
const LUGARES_NA_BARRA = 5

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  // Guarda a pagina em que o "Mais" abriu: ao navegar (por ele ou pela barra)
  // o menu fecha sozinho, sem precisar de efeito observando a rota.
  const [maisAbertoEm, setMaisAbertoEm] = useState<string | null>(null)
  const maisAberto = maisAbertoEm === pathname

  const isActive = (href: string) =>
    href === '/painel' ? pathname === '/painel' : pathname.startsWith(href)

  // Celular: se tudo cabe, mostra tudo. Se nao cabe, os primeiros ficam na
  // barra e o ultimo lugar vira "Mais" com o resto (Clientes, Relatorios,
  // Equipe, Configuracoes...). Antes o que passava de cinco simplesmente nao
  // aparecia, e so dava para chegar la pelos atalhos da pagina inicial.
  const cabeTudo = items.length <= LUGARES_NA_BARRA
  const naBarra = cabeTudo ? items : items.slice(0, LUGARES_NA_BARRA - 1)
  const noMais = cabeTudo ? [] : items.slice(LUGARES_NA_BARRA - 1)
  const maisAtivo = noMais.some((item) => isActive(item.href))

  useEffect(() => {
    if (!maisAberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaisAbertoEm(null)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [maisAberto])

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

      {/* Celular: menu do "Mais", abrindo logo acima da barra */}
      {maisAberto ? (
        <>
          <div
            aria-hidden
            onClick={() => setMaisAbertoEm(null)}
            className="fixed inset-0 z-10 bg-black/40 md:hidden"
          />
          <div
            id="menu-mais"
            className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 rounded-2xl border border-line bg-surface p-2 shadow-xl md:hidden"
          >
            <ul className="grid grid-cols-2 gap-1">
              {noMais.map((item) => {
                const Icon = ICONS[item.icon as keyof typeof ICONS]
                const ativo = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={ativo ? 'page' : undefined}
                      // Tocar na pagina em que ja se esta nao muda a rota:
                      // fecha na mao para o menu nao ficar aberto.
                      onClick={() => setMaisAbertoEm(null)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3.5 font-semibold ${
                        ativo ? 'bg-brand text-brand-foreground' : 'hover:bg-foreground/5'
                      }`}
                    >
                      <Icon size={20} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      ) : null}

      {/* Celular */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {naBarra.map((item) => {
          const Icon = ICONS[item.icon as keyof typeof ICONS]
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                isActive(item.href) ? 'text-brand-ink' : 'text-muted'
              }`}
            >
              <Icon size={22} aria-hidden />
              {item.label}
            </Link>
          )
        })}

        {noMais.length > 0 ? (
          <button
            type="button"
            aria-expanded={maisAberto}
            aria-controls="menu-mais"
            onClick={() => setMaisAbertoEm(maisAberto ? null : pathname)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
              maisAberto || maisAtivo ? 'text-brand-ink' : 'text-muted'
            }`}
          >
            <Ellipsis size={22} aria-hidden />
            Mais
          </button>
        ) : null}
      </nav>
    </>
  )
}
