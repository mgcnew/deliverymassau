import Link from 'next/link'

import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardTitle, Empty } from '@/components/ui/card'

export const metadata = { title: 'Equipe | Mercado Massa 24h' }

function quandoFoi(iso: string | null) {
  if (!iso) return 'nunca acessou'
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 5) return 'agora'
  if (minutos < 60) return `ha ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `ha ${horas}h`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default async function EquipePage() {
  const staff = await requirePermission(PERMISSIONS.equipeVer)
  const supabase = await createClient()

  const { data: pessoas } = await supabase
    .from('profiles')
    .select('id, name, phone, is_active, last_seen_at, preset_id')
    .order('is_active', { ascending: false })
    .order('name')

  const { data: presets } = await supabase.from('permission_presets').select('id, name')
  const nomePreset = new Map((presets ?? []).map((p) => [p.id, p.name]))

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Equipe</h1>
        {staff.permissions.has(PERMISSIONS.equipeCadastrar) ? (
          <ButtonLink href="/painel/equipe/novo">Novo funcionario</ButtonLink>
        ) : null}
      </div>

      <Card>
        <CardTitle>{pessoas?.length ?? 0} cadastrados</CardTitle>

        {!pessoas?.length ? (
          <Empty>Nenhum funcionario cadastrado ainda.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {pessoas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/painel/equipe/${p.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-black/[0.02]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {p.name}
                      {!p.is_active ? (
                        <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-900">
                          inativo
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {nomePreset.get(p.preset_id ?? '') ?? 'sem perfil'} - {quandoFoi(p.last_seen_at)}
                    </p>
                  </div>
                  <span aria-hidden className="text-muted">
                    &rsaquo;
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-sm text-muted">
        Perfis sao apenas atalhos. Cada pessoa pode receber ou perder permissoes individualmente.
      </p>
    </div>
  )
}
