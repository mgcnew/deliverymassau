import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PERMISSIONS } from '@/lib/permissions'
import type { EstadoDelivery } from '@/lib/horario'
import type { OrderStatus } from '@/lib/types'
import { InicioAoVivo } from './inicio-ao-vivo'
import { PainelIndicadores, type Indicadores } from './indicadores'
import { EstadoDeliveryCard } from './estado-delivery'
import { PrecisaDeAtencao, type PedidoEmAndamento } from './precisa-de-atencao'

export const metadata = { title: 'Painel | Mercado Massa 24h' }

const EM_ANDAMENTO: OrderStatus[] = ['recebido', 'separando', 'aguardando_entregador', 'saiu_para_entrega']

type LinhaEmAndamento = Omit<PedidoEmAndamento, 'minutos_na_etapa'> & {
  created_at: string
  order_status_history: Array<{ to_status: OrderStatus; created_at: string }>
}

/**
 * Quando o pedido entrou na etapa atual, pelo historico de status - e nao
 * pelos campos separation_started_at & cia, que guardam so a PRIMEIRA vez:
 * um pedido que voltou de "aguardando entregador" para "separando" mostraria
 * o tempo da separacao antiga.
 */
function entrouNaEtapa(linha: LinhaEmAndamento) {
  const naEtapa = linha.order_status_history
    .filter((h) => h.to_status === linha.status)
    .map((h) => h.created_at)
    .sort()
  return naEtapa.at(-1) ?? linha.created_at
}

async function buscarEmAndamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PedidoEmAndamento[]> {
  const { data } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, customer_name, address_district, created_at, order_status_history(to_status, created_at)',
    )
    .in('status', EM_ANDAMENTO)

  // O "agora" e o da busca. A pagina atualiza sozinha (evento do banco ou a
  // cada 30s), entao os minutos andam junto.
  const agora = Date.now()
  return ((data ?? []) as LinhaEmAndamento[]).map((linha) => ({
    id: linha.id,
    order_number: linha.order_number,
    status: linha.status,
    customer_name: linha.customer_name,
    address_district: linha.address_district,
    minutos_na_etapa: Math.max(
      0,
      Math.floor((agora - new Date(entrouNaEtapa(linha)).getTime()) / 60000),
    ),
  }))
}

export default async function PainelHome() {
  const staff = await requireStaff()
  const supabase = await createClient()
  const veIndicadores = staff.permissions.has(PERMISSIONS.dashboardVer)
  const vePedidos = staff.permissions.has(PERMISSIONS.pedidosVer)

  const [{ data: settings }, { data: estadoDelivery }, indicadores, emAndamento] = await Promise.all([
    supabase.from('settings').select('market_name').eq('id', 1).maybeSingle(),
    supabase.rpc('delivery_estado'),
    veIndicadores
      ? supabase.rpc('dashboard_hoje').then(({ data }) => data as Indicadores | null)
      : Promise.resolve(null),
    vePedidos ? buscarEmAndamento(supabase) : Promise.resolve(null),
  ])

  return (
    <div className="w-full space-y-5">
      {veIndicadores || vePedidos ? <InicioAoVivo /> : null}

      <div>
        <h1 className="text-2xl font-black">Ola, {staff.profile.name.split(' ')[0]}</h1>
        <p className="text-muted">{settings?.market_name ?? 'Mercado Massa 24h'}</p>
      </div>

      {estadoDelivery ? (
        <EstadoDeliveryCard
          estado={estadoDelivery as EstadoDelivery}
          podeAlterar={staff.permissions.has(PERMISSIONS.configDeliveryStatus)}
        />
      ) : null}

      {/* O que fazer primeiro vem antes dos numeros do dia. Sem atalhos para
          as telas: o menu (lateral no computador, barra com "Mais" no
          celular) ja leva a todas, e os cards repetiam o menu. */}
      {emAndamento ? <PrecisaDeAtencao pedidos={emAndamento} /> : null}

      {indicadores ? <PainelIndicadores dados={indicadores} /> : null}
    </div>
  )
}
