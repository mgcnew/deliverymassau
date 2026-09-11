import { useSyncExternalStore } from 'react'

/**
 * Relogio da tela de pedidos: a tela fica aberta horas no balcao e a idade
 * de cada pedido ("12 min") precisa andar sozinha, sem esperar o proximo
 * pedido chegar para re-renderizar. Um timer so para a tela inteira.
 *
 * O servidor manda o seu "agora" para a hidratacao bater com o HTML; logo
 * depois o navegador assume com o relogio dele.
 */

const ouvintes = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function assinar(avisar: () => void) {
  ouvintes.add(avisar)
  timer ??= setInterval(() => ouvintes.forEach((f) => f()), 30_000)
  return () => {
    ouvintes.delete(avisar)
    if (ouvintes.size === 0) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

// Arredondado ao minuto: o valor so muda quando a idade exibida muda.
function minutoAtual() {
  return Math.floor(Date.now() / 60_000) * 60_000
}

export function useAgora(agoraServidor: number) {
  return useSyncExternalStore(assinar, minutoAtual, () => agoraServidor)
}
