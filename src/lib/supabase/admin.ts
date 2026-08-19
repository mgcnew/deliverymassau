import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * Cliente com service_role. IGNORA RLS.
 * Uso exclusivo: criar/apagar usuarios no auth (nao existe outro caminho).
 * Nunca importar em Client Component. Nunca usar para ler/gravar dados de negocio.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY nao configurada. Necessaria para cadastrar funcionarios.',
    )
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
