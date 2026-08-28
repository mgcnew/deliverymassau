import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * Cliente com service_role. IGNORA RLS.
 *
 * Dois usos, ambos por falta de outro caminho:
 *  1. criar/apagar usuarios no auth;
 *  2. enviar as notificacoes de pedido novo (lib/push/enviar.ts) - quem
 *     dispara e o balconista, mas os aparelhos inscritos sao de OUTRAS
 *     pessoas, e a RLS de push_subscriptions (de proposito) so deixa cada
 *     um enxergar os proprios.
 *
 * Nunca importar em Client Component. Nunca usar para ler/gravar dados de
 * negocio - pedido, produto, cliente e permissao passam pela RLS.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY nao configurada. Necessaria para cadastrar funcionarios e para avisar os entregadores.',
    )
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
