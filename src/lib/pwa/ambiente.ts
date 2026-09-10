'use client'

import { useSyncExternalStore } from 'react'

/**
 * Onde a loja esta rodando: app instalado ou aba do navegador, iPhone ou
 * Android. Decide o que o convite de instalar e o botao Sair mostram.
 *
 * Tudo via useSyncExternalStore com o servidor "sem informacao": o HTML sai
 * sem convite e o valor real chega logo apos a hidratacao, sem mismatch.
 */

export type Plataforma = 'ios' | 'android' | 'outro'

function lerPlataforma(): Plataforma {
  const ua = navigator.userAgent
  // iPad com iPadOS 13+ se apresenta como Mac; o toque denuncia.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  if (/android/i.test(ua)) return 'android'
  return 'outro'
}

// O aparelho nao muda de sistema com a pagina aberta: nada a assinar.
const semMudancas = () => () => {}
const semInformacao = () => null

export function usePlataforma(): Plataforma | null {
  return useSyncExternalStore(semMudancas, lerPlataforma, semInformacao)
}

const CONSULTA_INSTALADO = '(display-mode: standalone)'

function assinarModoExibicao(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_INSTALADO)
  consulta.addEventListener('change', avisar)
  return () => consulta.removeEventListener('change', avisar)
}

function lerInstalado() {
  return (
    window.matchMedia(CONSULTA_INSTALADO).matches ||
    // Safari do iPhone nao conhece display-mode em versoes antigas.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** True quando aberto pelo icone da tela inicial (app instalado). */
export function useAppInstalado(): boolean | null {
  return useSyncExternalStore(assinarModoExibicao, lerInstalado, semInformacao)
}
