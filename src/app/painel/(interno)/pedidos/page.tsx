import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { diaDeHoje, diaValido, intervaloDoDia, rotuloDoDia, somarDias } from '@/lib/datas'
import { getFuso } from '@/lib/painel/mercado'
import { createClient } from '@/lib/supabase/server'
import { FiltroDia } from './filtro-dia'
import { PainelPedidos } from './painel-pedidos'
import type { PedidoOperacional } from './tipos'

export const metadata = { title: 'Pedidos | Mercado Massa 24h' }

const CAMPOS =
  'id, order_number, status, created_at, customer_name, customer_phone, address_district, total, payment_method, needs_change, change_amount, delivery_person_id, order_items(count)'

const EM_ANDAMENTO = ['recebido', 'separando', 'aguardando_entregador', 'saiu_para_entrega']

type LinhaPedido = Omit<PedidoOperacional, 'itens'> & { order_items: Array<{ count: number }> }

export default async function PedidosPage({ searchParams }: PageProps<'/painel/pedidos'>) {
  const [staff, fuso, params] = await Promise.all([
    requirePermission(PERMISSIONS.pedidosVer),
    getFuso(),
    searchParams,
  ])

  const hoje = diaDeHoje(fuso)
  const dia = diaValido(params.dia, fuso)
  const { de, ate } = intervaloDoDia(dia, fuso)

  const supabase = await createClient()

  const [{ data: abertos }, { data: fechados }] = await Promise.all([
    // Pedidos em andamento NUNCA entram no filtro de data. Um pedido feito
    // 23h50 e separado depois da meia-noite continua sendo trabalho a fazer:
    // sumir da fila porque "e de ontem" seria perder pedido em operacao.
    supabase.from('orders').select(CAMPOS).in('status', EM_ANDAMENTO).order('created_at'),
    // Finalizados sao historico e crescem sem parar - esses sim, um dia por vez.
    supabase
      .from('orders')
      .select(CAMPOS)
      .in('status', ['entregue', 'cancelado'])
      .gte('created_at', de)
      .lt('created_at', ate)
      .order('created_at', { ascending: false }),
  ])

  const mapear = (linhas: LinhaPedido[] | null): PedidoOperacional[] =>
    (linhas ?? []).map(({ order_items, ...resto }) => ({
      ...resto,
      itens: order_items?.[0]?.count ?? 0,
    }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Pedidos</h1>
        <FiltroDia dia={dia} hoje={hoje} ontem={somarDias(hoje, -1)} />
      </div>

      <PainelPedidos
        pedidos={mapear(abertos as LinhaPedido[] | null)}
        finalizados={mapear(fechados as LinhaPedido[] | null)}
        rotuloDia={rotuloDoDia(dia, fuso)}
        podeSeparar={staff.permissions.has(PERMISSIONS.pedidosSeparar)}
        podeImprimir={staff.permissions.has(PERMISSIONS.pedidosImprimir)}
      />
    </div>
  )
}
