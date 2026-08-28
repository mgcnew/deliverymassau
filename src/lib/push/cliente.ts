'use client'

/**
 * Lado do navegador da notificacao: inscrever e cancelar o aparelho.
 *
 * Nada aqui e automatico de proposito. A inscricao so acontece depois de um
 * toque do entregador no botao - navegador nenhum aceita pedir permissao sem
 * gesto, e pedir na primeira visita e a receita para a pessoa negar para
 * sempre e nunca mais receber aviso nenhum.
 */

/**
 * A chave VAPID viaja em base64url e o navegador quer bytes.
 *
 * O ArrayBuffer e criado explicitamente porque o tipo de `applicationServerKey`
 * nao aceita um Uint8Array que possa estar sobre SharedArrayBuffer.
 */
function chaveParaBytes(base64url: string): ArrayBuffer {
  const preenchimento = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + preenchimento).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(base64)
  const buffer = new ArrayBuffer(bruto.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i)
  return buffer
}

export type DadosInscricao = {
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string
}

export function pushSuportado(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Inscricao ja existente neste aparelho, se houver. */
export async function inscricaoAtual(): Promise<PushSubscription | null> {
  if (!pushSuportado()) return null
  const registro = await navigator.serviceWorker.ready
  return registro.pushManager.getSubscription()
}

export function paraDados(inscricao: PushSubscription): DadosInscricao {
  const json = inscricao.toJSON()
  return {
    endpoint: inscricao.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    userAgent: navigator.userAgent.slice(0, 300),
  }
}

/**
 * Pede permissao e inscreve. Devolve null quando a pessoa nega - negar e uma
 * resposta valida, nao um erro para jogar na tela.
 */
export async function inscrever(chavePublica: string): Promise<DadosInscricao | null> {
  if (!pushSuportado()) return null

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return null

  const registro = await navigator.serviceWorker.ready
  const existente = await registro.pushManager.getSubscription()
  if (existente) return paraDados(existente)

  const nova = await registro.pushManager.subscribe({
    // Sem isto o Chrome recusa: todo push tem que virar notificacao visivel.
    userVisibleOnly: true,
    applicationServerKey: chaveParaBytes(chavePublica),
  })

  return paraDados(nova)
}

/** Cancela no navegador e devolve o endpoint que saiu, para apagar no banco. */
export async function cancelar(): Promise<string | null> {
  const inscricao = await inscricaoAtual()
  if (!inscricao) return null
  const endpoint = inscricao.endpoint
  await inscricao.unsubscribe()
  return endpoint
}
