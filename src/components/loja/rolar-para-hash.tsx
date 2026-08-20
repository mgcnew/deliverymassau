'use client'

import { useEffect } from 'react'

/**
 * Ao chegar em /loja com #cat-slug na URL (link de outra pagina, ou
 * compartilhado), rola ate a secao. O navegador tenta fazer isso sozinho,
 * mas com o conteudo carregando pode nao acertar -- entao repete a rolagem
 * na mao depois do primeiro paint.
 */
export function RolarParaHash() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const alvo = document.getElementById(hash.slice(1))
    alvo?.scrollIntoView({ behavior: 'instant', block: 'start' })
  }, [])

  return null
}
