'use client'

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Leitor de codigo de barras pela camera, em tela cheia. Usado no campo do
 * cadastro de produto e na busca da lista de produtos.
 *
 * Usa o detector nativo do navegador (BarcodeDetector), que so existe em
 * Chrome/Edge - Android e computador. Safari (iPhone) e Firefox ainda nao
 * tem: la o botao de escanear nem aparece (useLeitorDisponivel) e sobra
 * digitar o codigo.
 *
 * Montado = camera ligada. Por padrao le UM codigo, desliga a camera e chama
 * onDetectar; quem usa decide o que fazer (fechar, mostrar resultado no
 * rodape via children, ou remontar com outra key para ler de novo).
 *
 * Com `continuo`, a camera nao desliga: chama onDetectar a cada codigo novo e
 * segue lendo. E o modo da conferencia de estoque, onde a pessoa passa por
 * centenas de itens seguidos - parar e reabrir a camera a cada bipada tornaria
 * a tarefa impraticavel.
 */

type DetectorDeCodigos = {
  detect: (fonte: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}
type JanelaComDetector = Window & {
  BarcodeDetector?: new (opcoes?: { formats: string[] }) => DetectorDeCodigos
}

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code']

/**
 * Quanto tempo o mesmo codigo fica ignorado no modo continuo.
 *
 * A camera le uns 60 quadros por segundo: sem isso, um item parado na mira
 * viraria dezenas de leituras iguais. Precisa ser maior que o tempo de tirar
 * um produto da frente e por o proximo (~1s) e pequeno o bastante para que
 * bipar o mesmo item de novo, de proposito, funcione.
 */
const ESPERA_MESMO_CODIGO = 2500

const semMudancas = () => () => {}

/**
 * Se o navegador le codigo pela camera. No servidor responde false: o HTML
 * sai sem o botao e ele aparece na hidratacao, sem divergir do servidor.
 */
export function useLeitorDisponivel() {
  return useSyncExternalStore(
    semMudancas,
    () => 'BarcodeDetector' in window,
    () => false,
  )
}

export function LeitorCodigoBarras({
  onDetectar,
  onFechar,
  titulo = 'Aponte para o codigo de barras',
  continuo = false,
  children,
}: {
  onDetectar: (codigo: string) => void
  onFechar: () => void
  titulo?: string
  /** Camera fica ligada lendo um codigo atras do outro (conferencia). */
  continuo?: boolean
  /** Rodape por cima da imagem: resultado da leitura, botoes de acao. */
  children?: ReactNode
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const detectou = useEffectEvent((codigo: string) => onDetectar(codigo))

  useEffect(() => {
    let parado = false
    let stream: MediaStream | null = null
    // Modo continuo: qual codigo saiu por ultimo e quando, para nao repetir o
    // item que continua na mira (ver ESPERA_MESMO_CODIGO).
    let ultimoCodigo = ''
    let ultimoEm = 0
    const desligar = () => stream?.getTracks().forEach((t) => t.stop())

    ;(async () => {
      try {
        const Detector = (window as JanelaComDetector).BarcodeDetector
        if (!Detector) throw new Error('sem suporte')

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        const video = videoRef.current
        if (parado || !video) return desligar()
        video.srcObject = stream
        await video.play()

        const detector = new Detector({ formats: FORMATOS })
        const loop = async () => {
          if (parado) return
          try {
            const [lido] = await detector.detect(video)
            if (lido && !parado) {
              const agora = performance.now()
              const repetido =
                lido.rawValue === ultimoCodigo && agora - ultimoEm < ESPERA_MESMO_CODIGO

              if (!repetido) {
                ultimoCodigo = lido.rawValue
                ultimoEm = agora
                // O "bip": confirma a leitura sem precisar olhar a tela. No
                // continuo e a unica confirmacao que a pessoa tem, porque o
                // olho esta na prateleira e nao no aparelho.
                navigator.vibrate?.(80)

                if (!continuo) {
                  parado = true
                  desligar()
                  detectou(lido.rawValue)
                  return
                }
                detectou(lido.rawValue)
              }
            }
          } catch {
            // Quadro ilegivel: tenta de novo no proximo.
          }
          requestAnimationFrame(loop)
        }
        requestAnimationFrame(loop)
      } catch {
        // A tela fica aberta so com a mensagem: se fechasse sozinha, o aviso
        // sumiria junto.
        if (!parado) setErro('Nao foi possivel abrir a camera. Feche e digite o codigo.')
        desligar()
      }
    })()

    return () => {
      parado = true
      desligar()
    }
  }, [continuo])

  // Portal no <body>: dentro da pagina, o overlay herdava estilo de quem o
  // contem (o space-y da lista de produtos dava margem nele e a barra de
  // navegacao aparecia por baixo) e ficaria preso a qualquer ancestral com
  // transform, como a animacao de entrada de pagina.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between gap-3 p-4">
        <p className="font-semibold text-white">{titulo}</p>
        <button
          type="button"
          onClick={onFechar}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
          aria-label="Fechar"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} className="size-full object-cover" playsInline muted />
        {/* Mira: mostra onde encaixar o codigo, que e o que mais faz a
            leitura demorar quando a pessoa aponta a camera a esmo. */}
        {!erro && (continuo || !children) ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
          />
        ) : null}
      </div>

      {erro ? <p className="p-4 text-center font-semibold text-rose-300">{erro}</p> : null}
      {children ? (
        <div className="space-y-3 bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground">
          {children}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
