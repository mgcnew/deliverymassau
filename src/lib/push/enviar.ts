import 'server-only'

import webpush from 'web-push'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Envio das notificacoes de pedido novo.
 *
 * O Realtime resolve quem esta com a tela aberta. Este arquivo cuida do resto
 * do dia do entregador: celular no bolso, app fechado, moto andando. Nesse
 * caso quem entrega o aviso e o servico de push do proprio navegador, e para
 * falar com ele o servidor precisa das chaves VAPID.
 *
 * Roda com service_role de proposito: quem dispara e a operacao do balcao
 * (ao concluir a separacao), mas o destinatario e outra pessoa - a RLS de
 * push_subscriptions so deixa cada um ver os proprios aparelhos.
 */

const PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVADA = process.env.VAPID_PRIVATE_KEY
const CONTATO = process.env.VAPID_SUBJECT ?? 'mailto:contato@example.com'

export function pushConfigurado(): boolean {
  return Boolean(PUBLICA && PRIVADA)
}

export type Aviso = {
  titulo: string
  corpo: string
  /** Para onde o toque na notificacao leva. */
  url?: string
  /** Avisos com a mesma tag se substituem em vez de empilhar na tela. */
  tag?: string
}

/**
 * Dispara o aviso para todos os aparelhos inscritos e limpa os que morreram.
 *
 * Nunca lanca: notificacao e um extra. Se o servico de push estiver fora do
 * ar, o pedido ja foi separado e a fila ja apareceu para quem esta com a tela
 * aberta - derrubar a acao do balconista por causa disso seria pior.
 */
export async function avisarEntregadores(aviso: Aviso): Promise<{ enviados: number }> {
  if (!pushConfigurado()) return { enviados: 0 }

  webpush.setVapidDetails(CONTATO, PUBLICA!, PRIVADA!)

  const admin = createAdminClient()
  const { data: inscricoes } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')

  if (!inscricoes?.length) return { enviados: 0 }

  const payload = JSON.stringify({
    titulo: aviso.titulo,
    corpo: aviso.corpo,
    url: aviso.url ?? '/painel/entregas',
    tag: aviso.tag ?? 'entrega',
  })

  const mortas: string[] = []
  const vivas: string[] = []

  await Promise.all(
    inscricoes.map(async (inscricao) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: inscricao.endpoint,
            keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
          },
          payload,
          { TTL: 600, urgency: 'high' },
        )
        vivas.push(inscricao.id)
      } catch (erro) {
        // 404/410 = o navegador desinstalou o app ou a inscricao expirou.
        // Guardar isso para sempre so faria o proximo envio demorar mais.
        const status = (erro as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) mortas.push(inscricao.id)
      }
    }),
  )

  if (mortas.length) await admin.from('push_subscriptions').delete().in('id', mortas)
  if (vivas.length) {
    await admin
      .from('push_subscriptions')
      .update({ last_success_at: new Date().toISOString(), failures: 0 })
      .in('id', vivas)
  }

  return { enviados: vivas.length }
}
