'use client'

import { useRef, useState, useTransition, type ComponentProps, type ReactNode } from 'react'

import { Button } from './button'

/**
 * Botao que abre um dialogo de confirmacao nativo (<dialog>: foco preso,
 * Esc fecha, tudo de graca) antes de rodar uma acao que nao da pra desfazer
 * com um clique, tipo remover bairro ou desativar zona/pagamento.
 */
export function ConfirmarAcao({
  onConfirmar,
  titulo,
  descricao,
  rotuloConfirmar = 'Confirmar',
  rotuloCancelar = 'Cancelar',
  variante = 'danger',
  className,
  children,
  ...botaoProps
}: {
  onConfirmar: () => Promise<{ erro?: string } | void>
  titulo: string
  descricao: string
  rotuloConfirmar?: string
  rotuloCancelar?: string
  variante?: 'danger' | 'secondary'
  className?: string
  children: ReactNode
} & Omit<ComponentProps<'button'>, 'onClick' | 'className' | 'children'>) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [pendente, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function confirmar() {
    startTransition(async () => {
      const resultado = await onConfirmar()
      if (resultado?.erro) {
        setErro(resultado.erro)
        return
      }
      setErro(null)
      dialogRef.current?.close()
    })
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setErro(null)
          dialogRef.current?.showModal()
        }}
        {...botaoProps}
      >
        {children}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-5 text-foreground backdrop:bg-black/50"
      >
        <p className="text-lg font-bold">{titulo}</p>
        <p className="mt-1 text-sm text-muted">{descricao}</p>
        {erro ? (
          <p className="mt-3 text-sm font-semibold text-[var(--tone-error-fg)]">{erro}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pendente}
            onClick={() => dialogRef.current?.close()}
          >
            {rotuloCancelar}
          </Button>
          <Button type="button" variant={variante} disabled={pendente} onClick={confirmar}>
            {pendente ? 'Aguarde...' : rotuloConfirmar}
          </Button>
        </div>
      </dialog>
    </>
  )
}
