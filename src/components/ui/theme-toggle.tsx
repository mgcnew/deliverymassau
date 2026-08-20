'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

const EVENTO_TEMA = 'massa24h-theme'

// Nao existe um store real por tras da classe .dark no <html> -- so mudamos
// ela por um clique nosso, entao avisamos o React com um evento sintetico
// proprio (dispatchado em alternar()) para o useSyncExternalStore reler.
function subscribe(callback: () => void) {
  window.addEventListener(EVENTO_TEMA, callback)
  return () => window.removeEventListener(EVENTO_TEMA, callback)
}
function getSnapshot() {
  return document.documentElement.classList.contains('dark')
}
// No servidor nao existe tema real ainda (decidido pelo script inline no
// <head> antes da hidratacao) -- usar sempre claro aqui casa com o HTML que
// o servidor mandou, e o valor real chega logo depois que o cliente hidrata.
function getServerSnapshot() {
  return false
}

export function ThemeToggle({ inverso }: { inverso?: boolean }) {
  const escuro = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  function alternar() {
    const proximo = !escuro
    document.documentElement.classList.toggle('dark', proximo)
    localStorage.setItem('theme', proximo ? 'dark' : 'light')
    window.dispatchEvent(new Event(EVENTO_TEMA))
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={escuro ? 'Modo claro' : 'Modo escuro'}
      className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${
        inverso ? 'text-brand-foreground hover:bg-white/20' : 'text-muted hover:bg-foreground/5'
      }`}
    >
      {escuro ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
    </button>
  )
}
