'use client'

import { useEffect, useRef, useState } from 'react'
import { Barcode, X } from 'lucide-react'

import { Input } from '@/components/ui/field'
import { verificarCodigoBarras } from './actions'

// Detector nativo do navegador. So existe em Chrome/Edge (desktop e Android);
// Safari/Firefox ainda nao tem. Onde nao existir, o botao de escanear some
// e sobra so a digitacao manual.
type DetectorDeCodigos = {
  detect: (fonte: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}
type JanelaComDetector = Window & {
  BarcodeDetector?: new (opcoes?: { formats: string[] }) => DetectorDeCodigos
}

export function CampoCodigoBarras({
  produtoId,
  defaultValue,
  disabled,
}: {
  produtoId?: string
  defaultValue: string
  disabled?: boolean
}) {
  const [valor, setValor] = useState(defaultValue)
  // Feature detection direto no useState: rodar isso num useEffect causaria
  // uma renderizacao extra toda vez (setState sincrono dentro de effect).
  const [suportado] = useState(() => typeof window !== 'undefined' && 'BarcodeDetector' in window)
  const [escaneando, setEscaneando] = useState(false)
  const [erroCamera, setErroCamera] = useState<string | null>(null)
  const [duplicado, setDuplicado] = useState<{ id: string; name: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pararLoopRef = useRef(false)

  useEffect(() => {
    return () => pararCamera()
  }, [])

  function pararCamera() {
    pararLoopRef.current = true
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function abrirScanner() {
    setErroCamera(null)
    setEscaneando(true)
    pararLoopRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const Detector = (window as JanelaComDetector).BarcodeDetector
      if (!Detector) throw new Error('sem suporte')
      const detector = new Detector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
      })

      const loop = async () => {
        if (pararLoopRef.current || !videoRef.current) return
        try {
          const codigos = await detector.detect(videoRef.current)
          if (codigos[0]) {
            aoDetectar(codigos[0].rawValue)
            return
          }
        } catch {
          // frame ilegivel, so tenta de novo no proximo
        }
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    } catch {
      // Mantem a tela aberta so com a mensagem: se fechasse sozinho, o
      // aviso desapareceria junto (ele fica dentro do overlay de camera).
      setErroCamera('Nao foi possivel abrir a camera. Feche e digite o codigo manualmente.')
      pararCamera()
    }
  }

  function aoDetectar(codigo: string) {
    setValor(codigo)
    fecharScanner()
    conferirDuplicado(codigo)
  }

  function fecharScanner() {
    pararCamera()
    setEscaneando(false)
  }

  async function conferirDuplicado(codigo: string) {
    if (!codigo.trim()) {
      setDuplicado(null)
      return
    }
    const resultado = await verificarCodigoBarras(codigo, produtoId)
    setDuplicado(resultado.produtoExistente ?? null)
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-semibold">Codigo de barras</span>

      <div className="flex gap-2">
        <Input
          name="barcode"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => conferirDuplicado(valor)}
          inputMode="numeric"
          placeholder="Opcional"
          disabled={disabled}
          className="flex-1"
        />
        {suportado ? (
          <button
            type="button"
            disabled={disabled}
            onClick={abrirScanner}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface disabled:opacity-50"
            aria-label="Escanear codigo de barras"
          >
            <Barcode size={20} aria-hidden />
          </button>
        ) : null}
      </div>

      {!suportado ? (
        <p className="text-sm text-muted">
          Leitura por camera nao disponivel neste navegador. Digite o codigo manualmente.
        </p>
      ) : null}

      {duplicado ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
          Ja existe um produto com este codigo: {duplicado.name}
        </p>
      ) : null}

      {escaneando ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-4">
            <p className="font-semibold text-white">Aponte para o codigo de barras</p>
            <button
              type="button"
              onClick={fecharScanner}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white"
              aria-label="Fechar"
            >
              <X size={20} aria-hidden />
            </button>
          </div>
          <video ref={videoRef} className="flex-1 object-cover" playsInline muted />
          {erroCamera ? (
            <p className="p-4 text-center font-semibold text-rose-300">{erroCamera}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
