import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { urlImagemProduto } from '@/lib/supabase/storage'
import { AbasConfiguracoes, type Aba } from './abas'
import {
  SecaoDelivery,
  SecaoMercado,
  SecaoPagamentos,
  SecaoZonas,
  type ZonaComBairros,
} from './secoes'

export const metadata = { title: 'Configuracoes | Mercado Massa 24h' }

export default async function ConfiguracoesPage({ searchParams }: PageProps<'/painel/configuracoes'>) {
  const staff = await requirePermission(PERMISSIONS.configAcessar)
  const { aba } = await searchParams
  const supabase = await createClient()

  const [{ data: config }, { data: metodos }, { data: zonas }, { data: bairros }] =
    await Promise.all([
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('payment_methods').select('code, label, is_active, brands').order('sort_order'),
      supabase.from('delivery_zones').select('id, name, fee, is_active').order('sort_order').order('name'),
      supabase.from('zone_neighborhoods').select('id, name, zone_id').order('name'),
    ])

  const zonasComBairros: ZonaComBairros[] = (zonas ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    fee: Number(z.fee),
    is_active: z.is_active,
    bairros: (bairros ?? []).filter((b) => b.zone_id === z.id).map((b) => ({ id: b.id, name: b.name })),
  }))

  const pode = (code: string) => staff.permissions.has(code)

  // Cada aba so existe para quem pode mexer em algo dentro dela: aba vazia
  // seria um botao que leva a lugar nenhum.
  const abas: Aba[] = []

  if (pode(PERMISSIONS.configMercado) && config) {
    abas.push({
      id: 'mercado',
      rotulo: 'Mercado',
      conteudo: (
        <SecaoMercado
          valores={{
            market_name: config.market_name,
            market_phone: config.market_phone,
            market_address: config.market_address,
            market_city: config.market_city,
            timezone: config.timezone,
          }}
          logoUrl={urlImagemProduto(config.market_logo_path)}
        />
      ),
    })
  }

  const podeAbrirFechar = pode(PERMISSIONS.configDeliveryStatus)
  const podeMinimo = pode(PERMISSIONS.configPedidoMinimo)
  if (config && (podeAbrirFechar || podeMinimo)) {
    abas.push({
      id: 'delivery',
      rotulo: 'Delivery',
      conteudo: (
        <SecaoDelivery
          valores={{
            delivery_enabled: config.delivery_enabled,
            delivery_closed_message: config.delivery_closed_message,
            min_order_value: Number(config.min_order_value),
            weight_tolerance_pct: Number(config.weight_tolerance_pct),
          }}
          podeAbrirFechar={podeAbrirFechar}
          podeMinimo={podeMinimo}
        />
      ),
    })
  }

  if (pode(PERMISSIONS.configTaxaEntrega)) {
    abas.push({
      id: 'bairros',
      rotulo: 'Bairros e taxas',
      conteudo: <SecaoZonas zonas={zonasComBairros} />,
    })
  }

  if (pode(PERMISSIONS.configPagamentos) && config) {
    abas.push({
      id: 'pagamentos',
      rotulo: 'Pagamentos',
      conteudo: (
        <SecaoPagamentos
          metodos={metodos ?? []}
          pix={{ pix_key: config.pix_key, pix_receiver_name: config.pix_receiver_name }}
          podePix={pode(PERMISSIONS.configPix)}
        />
      ),
    })
  }

  return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-black">Configuracoes</h1>

      {abas.length > 0 ? (
        <AbasConfiguracoes abas={abas} inicial={typeof aba === 'string' ? aba : ''} />
      ) : (
        <p className="text-muted">Voce nao tem permissao para alterar nenhuma configuracao.</p>
      )}
    </div>
  )
}
