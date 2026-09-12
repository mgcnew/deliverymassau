'use client'

import { useState } from 'react'
import { Barcode } from 'lucide-react'

import { Input } from '@/components/ui/field'
import { LeitorCodigoBarras, useLeitorDisponivel } from '@/components/ui/leitor-codigo-barras'
import { verificarCodigoBarras } from './actions'
import { LinkImagens } from './link-imagens'

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
  const suportado = useLeitorDisponivel()
  const [escaneando, setEscaneando] = useState(false)
  const [duplicado, setDuplicado] = useState<{ id: string; name: string } | null>(null)

  function aoDetectar(codigo: string) {
    setValor(codigo)
    setEscaneando(false)
    conferirDuplicado(codigo)
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
            onClick={() => setEscaneando(true)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface disabled:opacity-50"
            aria-label="Escanear codigo de barras"
          >
            <Barcode size={20} aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4">
        {!suportado ? (
          <p className="text-sm text-muted">
            Leitura por camera nao disponivel neste navegador. Digite o codigo manualmente.
          </p>
        ) : (
          <span />
        )}
        {/* Buscar pelo codigo acha a embalagem exata, com o gramagem certa -
            pelo nome vem o produto da linha, as vezes de outro tamanho. */}
        <LinkImagens termo={valor}>Procurar pelo codigo</LinkImagens>
      </div>

      {duplicado ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
          Ja existe um produto com este codigo: {duplicado.name}
        </p>
      ) : null}

      {escaneando ? (
        <LeitorCodigoBarras onDetectar={aoDetectar} onFechar={() => setEscaneando(false)} />
      ) : null}
    </div>
  )
}
