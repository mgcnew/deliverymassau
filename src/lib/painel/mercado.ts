import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

export type MercadoPainel = {
  market_name: string | null
  market_address: string | null
  market_city: string | null
}

/**
 * Nome/endereco do mercado, usados pelo cabecalho do painel e por telas que
 * montam mensagem de WhatsApp.
 *
 * cache(): layout e pagina pediam a MESMA linha de settings no mesmo
 * request, cada um por conta propria - duas idas de rede para o mesmo dado.
 * Com o cache do React, e uma so por request.
 */
export const getMercado = cache(async (): Promise<MercadoPainel | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('settings')
    .select('market_name, market_address, market_city')
    .eq('id', 1)
    .maybeSingle()

  return data ?? null
})

/** Nome do mercado com o padrao ja aplicado (usado em varias telas). */
export async function getNomeMercado(): Promise<string> {
  const mercado = await getMercado()
  return mercado?.market_name ?? 'Mercado Massa 24h'
}
