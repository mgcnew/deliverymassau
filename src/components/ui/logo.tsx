import Image from 'next/image'

const RAZAO = 700 / 148

/**
 * Duas versoes (fundo claro/escuro), a exibida troca com o tema via
 * dark: -- a mesma classe .dark que controla toda a paleta do site.
 *
 * As duas carregam sempre (mesmo a escondida por CSS) -- tentei tirar o
 * "priority" pra ver se o lazy loading padrao poupava a que fica
 * display:none, mas nao poupa: navegador busca a imagem antes de saber
 * que ela esta escondida. A alternativa (decidir o tema em JS e renderizar
 * so uma) troca essa banda extra (poucos KB) por um flash da logo errada
 * na hidratacao -- pior negocio. Fica como esta.
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
