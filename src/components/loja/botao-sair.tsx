'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { usePlataforma } from '@/lib/pwa/ambiente'

/**
 * "Sair" da loja, pedido de quem nao sabe (ou nao quer) minimizar o app.
 *
 * Site nenhum consegue se fechar sempre: o navegador so obedece o
 * window.close() quando a janela nao tem historico para tras - na pratica,
 * app instalado no Android aberto agora e sem ter navegado. No iPhone ele
 * nunca obedece. Quando o fechamento e recusado, a tela de despedida cobre a
 * loja e diz como terminar de sair, em vez de o botao "nao fazer nada".
 */
export function BotaoSair() {
  const pathname = usePathname()
  const plataforma = usePlataforma()
  // Guarda a pagina em que a despedida abriu: se a pessoa usar o "voltar" do
  // celular, a despedida some sozinha em vez de ficar por cima da outra tela.
  const [despedidaEm, setDespedidaEm] = useState<string | null>(null)

  function sair() {
    window.close()
    // Fechou de verdade = esta pagina ja nao existe e o timer nao roda.
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') setDespedidaEm(pathname)
    }, 300)
  }

  return (
    <>
      <button
        type="button"
        onClick={sair}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-bold"
      >
        <LogOut size={18} aria-hidden />
        Sair
      </button>

      {despedidaEm === pathname ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-despedida"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6 text-center"
        >
          <Logo altura={48} />
          <div className="max-w-sm space-y-2">
            <p id="titulo-despedida" className="text-2xl font-black">
              Obrigado pela visita!
            </p>
            <p className="text-muted">
              {plataforma === 'ios'
                ? 'Para fechar, arraste de baixo para cima a partir da borda da tela.'
                : 'Para fechar, aperte o botao de inicio do celular (a bolinha ou o risquinho embaixo da tela).'}
            </p>
            <p className="text-sm text-muted">
              O que estiver no carrinho fica guardado para quando voltar.
            </p>
          </div>
          <Button type="button" variant="secondary" size="lg" onClick={() => setDespedidaEm(null)}>
            Voltar para a loja
          </Button>
        </div>
      ) : null}
    </>
  )
}
