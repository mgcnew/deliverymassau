'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Link2, Loader2 } from 'lucide-react'

import { Input } from '@/components/ui/field'
import { comprimirImagem } from '@/lib/produtos/comprimir-imagem'

/**
 * Tres jeitos de por foto no produto, porque sao tres situacoes diferentes:
 *
 *   "Tirar foto"      -> o produto esta na mao, no balcao
 *   "Escolher arquivo"-> a foto ja esta no celular ou no computador
 *   colar / URL       -> a foto esta numa pagina da web
 *
 * O terceiro existe para o trabalho de completar catalogo: sem ele, cada
 * produto obriga a salvar a imagem no disco e reenviar. Colar (Ctrl+V) e
 * preferivel a colar endereco -- o arquivo vem inteiro para o navegador e
 * passa pela compressao daqui, enquanto a URL faz o servidor buscar. Os
 * dois ficam porque nem todo site deixa copiar a imagem em si; as vezes so
 * da para copiar o endereco.
 *
 * Um input com capture="environment" sozinho tira a opcao de galeria em
 * varios celulares -- por isso sao dois inputs escondidos, e o da camera
 * copia o arquivo escolhido para o input real via DataTransfer.
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
  const objetoUrlRef = useRef<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [comprimindo, setComprimindo] = useState(false)
  const [endereco, setEndereco] = useState('')
  const [colou, setColou] = useState(false)

  useEffect(() => {
    return () => {
      if (objetoUrlRef.current) URL.revokeObjectURL(objetoUrlRef.current)
    }
  }, [])

  function mostrarPreviewDeArquivo(arquivo: File) {
    if (objetoUrlRef.current) URL.revokeObjectURL(objetoUrlRef.current)
    objetoUrlRef.current = URL.createObjectURL(arquivo)
    setPreview(objetoUrlRef.current)
  }

  // Recebe o arquivo cru (camera, galeria ou area de transferencia),
  // comprime e coloca no input real - os fluxos convergem aqui para nao
  // duplicar a logica.
  async function processarArquivo(bruto: File) {
    if (!inputRef.current) return
    setComprimindo(true)
    try {
      const comprimido = await comprimirImagem(bruto)
      const transferencia = new DataTransfer()
      transferencia.items.add(comprimido)
      inputRef.current.files = transferencia.files
      mostrarPreviewDeArquivo(comprimido)
      // Arquivo escolhido manda: limpa a URL para nao sobrar ambiguidade
      // entre o que esta na tela e o que o servidor vai usar.
      setEndereco('')
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

  // Ctrl+V em qualquer lugar da pagina. Escuta no documento, e nao num campo
  // so, porque quem esta copiando imagem da web volta para a aba e cola --
  // exigir clicar no lugar certo antes seria uma etapa a mais no trabalho
  // que este campo existe para encurtar. So age se houver imagem na area de
  // transferencia, entao colar texto num campo continua funcionando normal.
  useEffect(() => {
    if (disabled) return

    function aoColar(evento: ClipboardEvent) {
      const item = Array.from(evento.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      )
      if (!item) return
      const arquivo = item.getAsFile()
      if (!arquivo) return
      evento.preventDefault()
      processarArquivo(arquivo)
      setColou(true)
      setTimeout(() => setColou(false), 2500)
    }

    document.addEventListener('paste', aoColar)
    return () => document.removeEventListener('paste', aoColar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  function aoDigitarEndereco(valor: string) {
    setEndereco(valor)
    // URL manda: limpa o arquivo, mesmo caminho do caso inverso.
    if (valor.trim() && inputRef.current) inputRef.current.value = ''
    if (objetoUrlRef.current) {
      URL.revokeObjectURL(objetoUrlRef.current)
      objetoUrlRef.current = null
    }
    setPreview(valor.trim() ? valor.trim() : null)
  }

  const miniatura = preview ?? imagemAtualUrl

  return (
    <div className="space-y-2">
      <span className="block text-sm font-semibold">Foto</span>

      <div className="flex items-center gap-3">
        {miniatura ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={miniatura}
            alt=""
            className="size-16 shrink-0 rounded-xl object-cover"
            // Endereco errado ou que bloqueia link externo: some a miniatura
            // em vez de deixar o icone de imagem quebrada.
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden'
            }}
            onLoad={(e) => {
              e.currentTarget.style.visibility = 'visible'
            }}
          />
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

      <div className="flex items-center gap-2">
        <Link2 size={18} className="shrink-0 text-muted" aria-hidden />
        <Input
          name="imagem_url"
          value={endereco}
          onChange={(e) => aoDigitarEndereco(e.target.value)}
          inputMode="url"
          placeholder="Ou cole o endereco da imagem (https://...)"
          disabled={disabled}
          className="flex-1"
          aria-label="Endereco da imagem"
        />
      </div>

      <p className="text-sm text-muted">
        {colou
          ? 'Imagem colada da area de transferencia.'
          : 'JPG, PNG ou WEBP de ate 3 MB. Voce tambem pode copiar a imagem e apertar Ctrl+V.'}
      </p>

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
