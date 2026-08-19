import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { urlImagemProduto } from '@/lib/supabase/storage'
import {
  SecaoDelivery,
  SecaoMercado,
  SecaoPagamentos,
  SecaoZonas,
  type ZonaComBairros,
} from './secoes'

export const metadata = { title: 'Configuracoes | Mercado Massa 24h' }

export default async function ConfiguracoesPage() {
  const staff = await requirePermission(PERMISSIONS.configAcessar)
  const supabase = await createClient()

  const [{ data: config }, { data: metodos }, { data: zonas }, { data: bairros }] =
    await Promise.all([
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('payment_methods').select('code, label, is_active').order('sort_order'),
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

  return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-black">Configuracoes</h1>

      {pode(PERMISSIONS.configMercado) && config ? (
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
      ) : null}

      {config ? (
        <SecaoDelivery
          valores={{
            delivery_enabled: config.delivery_enabled,
            delivery_closed_message: config.delivery_closed_message,
            min_order_value: Number(config.min_order_value),
            weight_tolerance_pct: Number(config.weight_tolerance_pct),
          }}
          podeAbrirFechar={pode(PERMISSIONS.configDeliveryStatus)}
          podeMinimo={pode(PERMISSIONS.configPedidoMinimo)}
        />
      ) : null}

      {pode(PERMISSIONS.configTaxaEntrega) ? <SecaoZonas zonas={zonasComBairros} /> : null}

      {pode(PERMISSIONS.configPagamentos) && config ? (
        <SecaoPagamentos
          metodos={metodos ?? []}
          pix={{ pix_key: config.pix_key, pix_receiver_name: config.pix_receiver_name }}
          podePix={pode(PERMISSIONS.configPix)}
        />
      ) : null}
    </div>
  )
}
