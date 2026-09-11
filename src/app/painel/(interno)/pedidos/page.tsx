import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { diaDeHoje, diaValido, intervaloDoDia, rotuloDoDia, somarDias } from '@/lib/datas'
import { getFuso } from '@/lib/painel/mercado'
import { createClient } from '@/lib/supabase/server'
import { PainelPedidos } from './painel-pedidos'
import type { PedidoOperacional } from './tipos'

export const metadata = { title: 'Pedidos | Mercado Massa 24h' }

const CAMPOS =
  'id, order_number, status, created_at, customer_name, customer_phone, address_district, total, payment_method, payment_brand, needs_change, change_amount, delivery_person_id, order_items(count), entregador:profiles!orders_delivery_person_id_fkey(name)'

const EM_ANDAMENTO = ['recebido', 'separando', 'aguardando_entregador', 'saiu_para_entrega']

type LinhaPedido = Omit<PedidoOperacional, 'itens' | 'entregador'> & {
  order_items: Array<{ count: number }>
  entregador: { name: string } | null
}

// Fora do componente: o "agora" do servidor so serve para a primeira
// pintura bater com a hidratacao (depois o relogio do navegador assume).
function agoraDoServidor() {
  return Date.now()
}

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
    (linhas ?? []).map(({ order_items, entregador, ...resto }) => ({
      ...resto,
      itens: order_items?.[0]?.count ?? 0,
      entregador: entregador?.name ?? null,
    }))

  return (
    <PainelPedidos
      pedidos={mapear(abertos as LinhaPedido[] | null)}
      finalizados={mapear(fechados as LinhaPedido[] | null)}
      dia={dia}
      hoje={hoje}
      ontem={somarDias(hoje, -1)}
      rotuloDia={rotuloDoDia(dia, fuso)}
      etapaInicial={typeof params.etapa === 'string' ? params.etapa : undefined}
      gavetaAberta={params.finalizados === '1'}
      agoraServidor={agoraDoServidor()}
      podeSeparar={staff.permissions.has(PERMISSIONS.pedidosSeparar)}
      podeImprimir={staff.permissions.has(PERMISSIONS.pedidosImprimir)}
    />
  )
}
