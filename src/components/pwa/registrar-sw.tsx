'use client'

import { useEffect } from 'react'

/** Registra o service worker depois que a pagina carregou, sem atrasar nada. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Sem service worker o site funciona normal, so nao instala como app.
      })
    }

    if (document.readyState === 'complete') {
      registrar()
    } else {
      window.addEventListener('load', registrar)
      return () => window.removeEventListener('load', registrar)
    }
  }, [])

  return null
}
