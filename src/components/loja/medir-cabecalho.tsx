'use client'

import { useEffect } from 'react'

/**
 * Publica a altura do cabecalho fixo da loja em --altura-cabecalho, para o
 * que gruda logo abaixo dele (a faixa de categorias) saber onde parar. A
 * altura muda com o tema, a fonte do aparelho e o tamanho da tela, entao e
 * medida, nao chutada.
 */
export function MedirCabecalho({ alvo }: { alvo: string }) {
  useEffect(() => {
    const cabecalho = document.getElementById(alvo)
    if (!cabecalho) return
    const raiz = document.documentElement
    const observador = new ResizeObserver(() => {
      raiz.style.setProperty('--altura-cabecalho', `${cabecalho.offsetHeight}px`)
    })
    observador.observe(cabecalho)
    return () => observador.disconnect()
  }, [alvo])

  return null
}
