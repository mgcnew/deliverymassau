import Image from 'next/image'

const RAZAO = 700 / 148

/**
 * Duas versoes (fundo claro/escuro), a exibida troca com o tema via
 * dark: -- a mesma classe .dark que controla toda a paleta do site.
 */
export function Logo({ altura = 32, className = '' }: { altura?: number; className?: string }) {
  const largura = Math.round(altura * RAZAO)
  return (
    <>
      <Image
        src="/logo-claro.png"
        alt="Mercado Massau 24h"
        width={largura}
        height={altura}
        priority
        className={`dark:hidden ${className}`}
      />
      <Image
        src="/logo-escuro.png"
        alt="Mercado Massau 24h"
        width={largura}
        height={altura}
        priority
        className={`hidden dark:block ${className}`}
      />
    </>
  )
}
