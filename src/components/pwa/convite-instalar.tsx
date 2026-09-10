'use client'

import Image from 'next/image'
import { useRef, useSyncExternalStore } from 'react'
import { EllipsisVertical, Share, SquarePlus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppInstalado, usePlataforma } from '@/lib/pwa/ambiente'

/**
 * Faixa "Instale o app" no topo da loja.
 *
 * A loja ja era instalavel desde que virou PWA, mas nada na tela contava
 * isso: o cliente teria que achar sozinho a opcao no menu do navegador.
 *
 * - Chrome/Edge (Android e computador): o botao abre a janela nativa de
 *   instalacao, usando o evento guardado por captura-instalacao.ts.
 * - iPhone: o Safari nao deixa site nenhum abrir essa janela. O botao mostra
 *   o passo a passo (Compartilhar > Adicionar a Tela de Inicio).
 * - Android sem o evento (aberto dentro do WhatsApp/Instagram, Firefox...):
 *   passo a passo pelo menu do navegador.
 *
 * Some quando a loja ja esta aberta como app, e por um tempo depois que a
 * pessoa fecha no X ou responde a janela de instalacao.
 */

type PedidoInstalacao = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __pedidoInstalacao?: PedidoInstalacao | null
  }
}

const EVENTO_INSTALAVEL = 'massa24h-instalavel'
const EVENTO_DISPENSA = 'massa24h-instalar-dispensado'
const CHAVE_DISPENSA = 'massa24h-instalar-dispensado-ate'
const DIA = 24 * 60 * 60 * 1000

function assinarInstalavel(avisar: () => void) {
  window.addEventListener(EVENTO_INSTALAVEL, avisar)
  return () => window.removeEventListener(EVENTO_INSTALAVEL, avisar)
}
const lerPedidoInstalacao = () => window.__pedidoInstalacao ?? null
const semPedidoNoServidor = () => null

function assinarDispensa(avisar: () => void) {
  window.addEventListener(EVENTO_DISPENSA, avisar)
  window.addEventListener('storage', avisar)
  return () => {
    window.removeEventListener(EVENTO_DISPENSA, avisar)
    window.removeEventListener('storage', avisar)
  }
}
function lerDispensado() {
  try {
    return Number(localStorage.getItem(CHAVE_DISPENSA) ?? 0) > Date.now()
  } catch {
    return false
  }
}
// No servidor, "dispensado": o HTML sai sem a faixa e ela so aparece depois
// da hidratacao, para quem ainda nao instalou.
const dispensadoNoServidor = () => true

function dispensarPor(dias: number) {
  try {
    localStorage.setItem(CHAVE_DISPENSA, String(Date.now() + dias * DIA))
  } catch {
    // Sem localStorage (aba anonima restrita): a faixa volta na proxima visita.
  }
  window.dispatchEvent(new Event(EVENTO_DISPENSA))
}

export function ConviteInstalar() {
  const plataforma = usePlataforma()
  const instalado = useAppInstalado()
  const pedido = useSyncExternalStore(assinarInstalavel, lerPedidoInstalacao, semPedidoNoServidor)
  const dispensado = useSyncExternalStore(assinarDispensa, lerDispensado, dispensadoNoServidor)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // No computador so vale oferecer quando o navegador de fato instala com um
  // clique; passo a passo de menu fica para o celular, onde o app faz falta.
  const temComoInstalar = pedido !== null || plataforma === 'ios' || plataforma === 'android'
  if (instalado !== false || dispensado || !temComoInstalar) return null

  async function instalar() {
    if (!pedido) {
      dialogRef.current?.showModal()
      return
    }

    await pedido.prompt()
    const { outcome } = await pedido.userChoice
    // O evento so serve uma vez; o navegador manda outro no proximo carregamento.
    window.__pedidoInstalacao = null
    window.dispatchEvent(new Event(EVENTO_INSTALAVEL))
    dispensarPor(outcome === 'accepted' ? 90 : 7)
  }

  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5">
          <Image
            src="/icon-192.png"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-xl"
          />
          <p className="min-w-0 flex-1 text-sm leading-tight">
            <span className="block font-bold">Instale o app do mercado</span>
            <span className="block text-muted">Abre direto na loja, sem procurar o link.</span>
          </p>
          <Button type="button" onClick={instalar} className="shrink-0 px-4">
            Instalar
          </Button>
          <button
            type="button"
            onClick={() => dispensarPor(7)}
            aria-label="Agora nao"
            title="Agora nao"
            className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-foreground/5"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="titulo-instalar"
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-5 text-foreground backdrop:bg-black/50"
      >
        <p id="titulo-instalar" className="text-lg font-bold">
          Como instalar o app
        </p>

        {plataforma === 'ios' ? <PassosIphone /> : <PassosAndroid />}

        <div className="mt-5 flex justify-end">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            Entendi
          </Button>
        </div>
      </dialog>
    </>
  )
}

function Passo({ numero, children }: { numero: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
        {numero}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  )
}

function Icone({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex translate-y-0.5 items-center rounded-md border border-line p-0.5">
      {children}
    </span>
  )
}

function PassosIphone() {
  return (
    <>
      <ol className="mt-4 space-y-3 text-[15px]">
        <Passo numero={1}>
          Toque no botao Compartilhar{' '}
          <Icone>
            <Share size={16} aria-label="(quadrado com seta para cima)" />
          </Icone>{' '}
          na barra do Safari.
        </Passo>
        <Passo numero={2}>
          Role a lista e toque em{' '}
          <strong>
            Adicionar a Tela de Inicio{' '}
            <Icone>
              <SquarePlus size={16} aria-hidden />
            </Icone>
          </strong>
          .
        </Passo>
        <Passo numero={3}>
          Toque em <strong>Adicionar</strong>. O icone do mercado aparece junto dos seus apps.
        </Passo>
      </ol>
      <p className="mt-4 text-sm text-muted">
        Abriu o link pelo WhatsApp ou Instagram? Antes, toque em <strong>Abrir no Safari</strong>.
      </p>
    </>
  )
}

function PassosAndroid() {
  return (
    <>
      <ol className="mt-4 space-y-3 text-[15px]">
        <Passo numero={1}>
          Toque no menu{' '}
          <Icone>
            <EllipsisVertical size={16} aria-label="(tres pontinhos)" />
          </Icone>{' '}
          no canto de cima do navegador.
        </Passo>
        <Passo numero={2}>
          Toque em <strong>Instalar app</strong> ou <strong>Adicionar a tela inicial</strong>.
        </Passo>
        <Passo numero={3}>
          Confirme. O icone do mercado aparece junto dos seus apps.
        </Passo>
      </ol>
      <p className="mt-4 text-sm text-muted">
        Abriu o link pelo WhatsApp ou Instagram? Antes, toque nos tres pontinhos e em{' '}
        <strong>Abrir no Chrome</strong>.
      </p>
    </>
  )
}
