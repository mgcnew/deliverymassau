'use client'

/**
 * Interruptor de verdade (role="switch"), nao um checkbox disfarcado: o
 * leitor de tela anuncia "ligado/desligado" e a tecla espaco alterna, que e
 * o que se espera de um controle desse tipo.
 */
export function Interruptor({
  ligado,
  aoAlternar,
  desabilitado = false,
  rotulo,
}: {
  ligado: boolean
  aoAlternar: (proximo: boolean) => void
  desabilitado?: boolean
  /** Descricao para quem usa leitor de tela (o texto visivel fica no card). */
  rotulo: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={() => aoAlternar(!ligado)}
      className={`relative inline-flex h-9 w-16 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        ligado ? 'bg-emerald-600' : 'bg-foreground/25'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block size-7 rounded-full bg-white shadow-md transition-transform ${
          ligado ? 'translate-x-8' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
