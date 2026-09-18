import { LinkVoltar } from '@/components/ui/link-voltar'
import { Card, CardTitle, Empty } from '@/components/ui/card'
import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AbrirConferencia, EncerrarConferencia, PublicarParcial } from './abrir-conferencia'
import { Conferencia } from './conferencia'
import { DesfazerViragem } from './viragem'

export const metadata = { title: 'Conferencia de estoque | Mercado Massa 24h' }

const ROTULO_STATUS = {
  aberta: 'Em andamento',
  aplicada: 'Aplicada na vitrine',
  cancelada: 'Encerrada sem aplicar',
} as const

function dataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default async function ConferenciaPage() {
  const staff = await requirePermission(PERMISSIONS.conferenciaRealizar)
  const podeAplicar = staff.permissions.has(PERMISSIONS.conferenciaAplicar)

  const supabase = await createClient()
  const { data: conferencias } = await supabase
    .from('stock_takes')
    .select('id, name, status, started_at, applied_at, stock_take_items(count)')
    .order('started_at', { ascending: false })
    .limit(10)

  const lista = conferencias ?? []
  const conferidos = (c: (typeof lista)[number]) =>
    (c.stock_take_items as unknown as Array<{ count: number }>)?.[0]?.count ?? 0

  const aberta = lista.find((c) => c.status === 'aberta')
  // Desfazer so faz sentido na ultima aplicada: ela e a unica cujo estado
  // anterior ainda esta guardado (a seguinte sobrescreveria o dela).
  const ultimaAplicada = !aberta ? lista.find((c) => c.status === 'aplicada') : undefined
  const anteriores = lista.filter((c) => c.status !== 'aberta' && c.id !== ultimaAplicada?.id)

  return (
    <div className="w-full space-y-4">
      <div>
        <LinkVoltar href="/painel/produtos">Produtos</LinkVoltar>
        <h1 className="text-2xl font-black">Conferencia de estoque</h1>
        <p className="text-muted">
          Ande pela loja bipando o que existe na prateleira. O catalogo desce inteiro para o
          aparelho, entao a bipagem funciona mesmo sem sinal no corredor. Enquanto a conferencia
          esta aberta, a vitrine nao muda.
        </p>
      </div>

      {aberta ? (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{aberta.name}</p>
              <p className="text-sm text-muted">Aberta em {dataHora(aberta.started_at)}</p>
            </div>
            {/* Publicar aos poucos: o dono ja vende o que bipou enquanto
                continua andando a loja. Quem nao pode aplicar tambem nao
                publica - e a mesma permissao, porque as duas mexem na vitrine. */}
            <div className="flex flex-wrap items-start gap-2">
              {podeAplicar ? <PublicarParcial conferenciaId={aberta.id} /> : null}
              <EncerrarConferencia conferenciaId={aberta.id} />
            </div>
          </Card>

          <Conferencia
            conferencia={{ id: aberta.id, name: aberta.name, started_at: aberta.started_at }}
            podeAplicar={podeAplicar}
          />
        </>
      ) : (
        <>
          {ultimaAplicada && podeAplicar ? (
            <DesfazerViragem
              conferenciaId={ultimaAplicada.id}
              aplicadaEm={ultimaAplicada.applied_at ?? ultimaAplicada.started_at}
            />
          ) : null}

          <Card className="space-y-3">
            <CardTitle>Comecar uma conferencia</CardTitle>
            <p className="text-muted">
              Uma de cada vez: duas pessoas bipando em sessoes separadas dariam duas listas
              parciais da loja.
            </p>
            <AbrirConferencia />
          </Card>
        </>
      )}

      <Card>
        <CardTitle>Conferencias anteriores</CardTitle>
        {anteriores.length === 0 ? (
          <Empty>Nenhuma conferencia encerrada ainda.</Empty>
        ) : (
          <ul>
            {anteriores.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-sm text-muted">
                    {dataHora(c.started_at)} -{' '}
                    {ROTULO_STATUS[c.status as keyof typeof ROTULO_STATUS]}
                  </p>
                </div>
                <p className="text-sm text-muted">{conferidos(c)} conferidos</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
