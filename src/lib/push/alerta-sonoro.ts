'use client'

/**
 * Alerta para quando o app ESTA aberto - celular no suporte da moto, tela
 * acesa. Nesse caso a notificacao do sistema nem sempre aparece, entao o
 * aviso e som e vibracao.
 *
 * O som e sintetizado na hora em vez de vir de um arquivo: sao dois bipes,
 * nao vale a pena baixar um mp3 e mante-lo em cache para isso.
 *
 * Navegador nenhum deixa tocar audio sem um gesto antes - por isso
 * `liberarSom()` e chamado no mesmo toque que liga os alertas, e so entao o
 * contexto de audio fica pronto para tocar sozinho depois.
 */

let contexto: AudioContext | null = null

export function liberarSom(): void {
  if (typeof window === 'undefined') return
  try {
    contexto = contexto ?? new AudioContext()
    if (contexto.state === 'suspended') void contexto.resume()
  } catch {
    contexto = null
  }
}

export function tocarAlerta(): void {
  try {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  } catch {
    // Vibracao nao existe no desktop e em parte dos iPhones. Segue o jogo.
  }

  if (!contexto || contexto.state !== 'running') return

  // Dois bipes curtos, subindo - corta o barulho da rua sem soar como alarme.
  const agora = contexto.currentTime
  for (const [inicio, hz] of [
    [0, 880],
    [0.18, 1174],
  ] as const) {
    const oscilador = contexto.createOscillator()
    const volume = contexto.createGain()

    oscilador.type = 'sine'
    oscilador.frequency.value = hz
    // Sobe e desce em rampa: corte seco estala no alto-falante do celular.
    volume.gain.setValueAtTime(0.0001, agora + inicio)
    volume.gain.exponentialRampToValueAtTime(0.35, agora + inicio + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, agora + inicio + 0.15)

    oscilador.connect(volume).connect(contexto.destination)
    oscilador.start(agora + inicio)
    oscilador.stop(agora + inicio + 0.16)
  }
}
