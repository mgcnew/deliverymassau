'use client'

import { PackageX, Trash2, Undo2 } from 'lucide-react'

import type { Leitura } from './sessao'

/**
 * Uma linha da lista de conferidos.
 *
 * A quantidade fica em branco por padrao - conferir e dizer "tem", nao contar.
 * Quem quiser contar digita; quem marcar "acabou" grava zero, que na viragem
 * mantem o produto no catalogo porem esgotado na vitrine.
 */
export function LinhaConferida({
  leitura,
  onQuantidade,
  onRemover,
  aoEnter,
}: {
  leitura: Leitura
  onQuantidade: (quantidade: number | null) => void
  onRemover: () => void
  /** Enter na quantidade: vai para a quantidade do proximo da lista. */
  aoEnter: (campo: HTMLInputElement) => void
}) {
  const acabou = leitura.quantidade === 0
  const desconhecido = leitura.produtoId === null

  return (
    // No celular o nome fica numa linha so dele e os botoes embaixo. Lado a
    // lado, os tres controles deixavam ~150px para o nome e "ABS INTIMUS
    // TRIPLA C/16 SUAVE" virava "ABS INTIMUS ..." - sem saber de qual produto
    // se trata, conferir a lista depois nao serve para nada.
    <li className="flex flex-col gap-2 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className={`font-semibold sm:truncate ${acabou ? 'text-muted line-through' : ''}`}>
          {leitura.nome}
        </p>
        <p className="text-sm text-muted sm:truncate">
          {desconhecido
            ? 'Nao esta no cadastro - cadastrar depois'
            : // Conferido pelo nome: nunca teve codigo (padaria, fatiados, dose).
              (leitura.codigo || 'Sem codigo de barras')}
          {leitura.inativo ? ' - inativo, vai voltar para a vitrine' : ''}
          {leitura.sincronizada ? '' : ' - no aparelho'}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 sm:gap-3">
        {/* Codigo sem cadastro nao tem quantidade nem "acabou": nao ha produto
            para estar em falta. Ele so espera virar cadastro. */}
        {desconhecido ? null : acabou ? (
          <button
            type="button"
            onClick={() => onQuantidade(null)}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold"
          >
            <Undo2 size={16} aria-hidden />
            Tem
          </button>
        ) : (
          <>
            {/* Contar a loja e digitar, Enter, digitar, Enter - quem bipou tudo
                primeiro desce esta lista de uma vez. Sem isso, cada item
                custava fechar o teclado, achar a proxima linha e tocar nela.
                Mesmo caminho do preco na edicao em lote. */}
            <input
              data-conferencia-qtd
              type="number"
              min={0}
              inputMode="numeric"
              enterKeyHint="next"
              aria-label={`Quantidade de ${leitura.nome}`}
              placeholder="qtd"
              value={leitura.quantidade ?? ''}
              onChange={(e) => {
                const texto = e.target.value.trim()
                const numero = Number(texto)
                onQuantidade(texto === '' || !Number.isFinite(numero) ? null : Math.max(0, numero))
              }}
              // Entrou no campo que ja tem numero: digitar troca o valor, em
              // vez de emendar no que estava (5 viraria 15).
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                aoEnter(e.currentTarget)
              }}
              className="h-11 w-16 shrink-0 rounded-xl border border-line bg-surface px-2 text-center text-base"
            />
            <button
              type="button"
              onClick={() => onQuantidade(0)}
              aria-label={`Marcar ${leitura.nome} como acabou`}
              title="Acabou"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-muted"
            >
              <PackageX size={18} aria-hidden />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onRemover}
          aria-label={`Tirar ${leitura.nome} da lista`}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-foreground/5"
        >
          <Trash2 size={18} aria-hidden />
        </button>
      </div>
    </li>
  )
}
