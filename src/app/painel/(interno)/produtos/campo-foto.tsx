'use client'

import { useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2 } from 'lucide-react'

import { comprimirImagem } from '@/lib/produtos/comprimir-imagem'

/**
 * Dois botoes de verdade lado a lado: "Tirar foto" (forca a camera no
 * celular) e "Escolher arquivo" (abre a galeria/arquivos). Um input com
 * capture="environment" sozinho tira a opcao de galeria em varios celulares
 * -- por isso sao dois inputs escondidos, e o da camera copia o arquivo
 * escolhido para o input real via DataTransfer.
 */
export function CampoFoto({
  imagemAtualUrl,
  disabled,
}: {
  imagemAtualUrl: string | null
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [comprimindo, setComprimindo] = useState(false)

  function mostrarPreview(arquivo: File) {
    setPreview((atual) => {
      if (atual) URL.revokeObjectURL(atual)
      return URL.createObjectURL(arquivo)
    })
  }

  // Recebe o arquivo cru (camera ou galeria), comprime e coloca no input
  // real - os dois fluxos convergem aqui para nao duplicar a logica.
  async function processarArquivo(bruto: File) {
    if (!inputRef.current) return
    setComprimindo(true)
    try {
      const comprimido = await comprimirImagem(bruto)
      const transferencia = new DataTransfer()
      transferencia.items.add(comprimido)
      inputRef.current.files = transferencia.files
      mostrarPreview(comprimido)
    } finally {
      setComprimindo(false)
    }
  }

  function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (arquivo) processarArquivo(arquivo)
  }

  function aoTirarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (arquivo) processarArquivo(arquivo)
  }

  const miniatura = preview ?? imagemAtualUrl

  return (
    <div className="space-y-2">
      <span className="block text-sm font-semibold">Foto</span>

      <div className="flex items-center gap-3">
        {miniatura ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={miniatura} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-foreground/5 text-2xl">
            🛒
          </span>
        )}

        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={disabled || comprimindo}
            onClick={() => cameraRef.current?.click()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold disabled:opacity-50 sm:w-auto sm:flex-1"
          >
            {comprimindo ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Camera size={18} aria-hidden />}
            Tirar foto
          </button>
          <button
            type="button"
            disabled={disabled || comprimindo}
            onClick={() => inputRef.current?.click()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold disabled:opacity-50 sm:w-auto sm:flex-1"
          >
            {comprimindo ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ImagePlus size={18} aria-hidden />}
            Escolher arquivo
          </button>
        </div>
      </div>

      <p className="text-sm text-muted">JPG, PNG ou WEBP de ate 3 MB.</p>

      {/* Input real: e o que o Server Action le em formData.get('imagem'). */}
      <input
        ref={inputRef}
        type="file"
        name="imagem"
        accept="image/*"
        disabled={disabled}
        onChange={aoEscolherArquivo}
        className="hidden"
      />
      {/* So existe para abrir a camera; o arquivo e copiado para o input real. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={aoTirarFoto}
        className="hidden"
      />
    </div>
  )
}
