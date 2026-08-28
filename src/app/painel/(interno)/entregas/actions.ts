'use server'

import { createClient } from '@/lib/supabase/server'
import type { DadosInscricao } from '@/lib/push/cliente'

export type InscricaoState = { erro?: string; ok?: boolean }

/**
 * Guarda o aparelho do entregador para receber aviso de pedido novo.
 *
 * Sem service_role: a RLS de push_subscriptions ja garante que ninguem
 * inscreva aparelho no nome de outra pessoa.
 */
export async function salvarInscricaoPush(dados: DadosInscricao): Promise<InscricaoState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { erro: 'Sua sessao expirou. Entre de novo.' }
  if (!dados.endpoint || !dados.p256dh || !dados.auth) return { erro: 'Inscricao incompleta.' }

  // onConflict no endpoint: reinstalar o app ou reativar o aviso devolve o
  // mesmo endereco, e o certo e atualizar a linha, nao criar outra.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: user.id,
      endpoint: dados.endpoint,
      p256dh: dados.p256dh,
      auth: dados.auth,
      user_agent: dados.userAgent,
      failures: 0,
    },
    { onConflict: 'endpoint' },
  )

  if (error) return { erro: 'Nao foi possivel ligar os avisos neste aparelho.' }
  return { ok: true }
}

export async function removerInscricaoPush(endpoint: string): Promise<InscricaoState> {
  const supabase = await createClient()
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)

  if (error) return { erro: 'Nao foi possivel desligar os avisos.' }
  return { ok: true }
}
