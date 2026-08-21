'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Faixa com rolagem lateral sem barra visivel. Quem avisa que ha mais
 * conteudo e um esfumacado na borda: aparece do lado que ainda tem coisa
 * escondida e some quando a rolagem chega la. No dedo (celular) nada muda,
 * a faixa continua arrastavel normalmente.
 *
 * O -mx-4/px-4 fica aqui dentro para o conteudo sangrar ate a borda da
 * tela, como as faixas ja faziam antes.
 */
export function RolagemHorizontal({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [sombra, setSombra] = useState({ esquerda: false, direita: false })

  useEffect(() => {
    const area = areaRef.current
    if (!area) return

    const atualizar = () => {
      const sobraDireita = area.scrollWidth - area.clientWidth - area.scrollLeft
      setSombra({ esquerda: area.scrollLeft > 8, direita: sobraDireita > 8 })
    }

    // O ResizeObserver dispara uma vez logo apos o observe(): e ele quem faz
    // a medida inicial (e refaz quando a tela muda de tamanho).
    const observador = new ResizeObserver(atualizar)
    observador.observe(area)
    area.addEventListener('scroll', atualizar, { passive: true })

    return () => {
      observador.disconnect()
      area.removeEventListener('scroll', atualizar)
    }
  }, [])

  const fade =
    'pointer-events-none absolute inset-y-0 w-10 transition-opacity duration-200'

  return (
    <div className="relative -mx-4">
      <div ref={areaRef} className={`rolagem-discreta overflow-x-auto px-4 ${className}`}>
        {children}
      </div>
      <div
        aria-hidden
        className={`${fade} left-0 bg-gradient-to-r from-background to-transparent ${
          sombra.esquerda ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden
        className={`${fade} right-0 bg-gradient-to-l from-background to-transparent ${
          sombra.direita ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
