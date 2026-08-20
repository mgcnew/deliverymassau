'use client'

import Link from 'next/link'
import { useActionState, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Alert, Card } from '@/components/ui/card'
import { moeda } from '@/lib/format'
import {
  analisarPlanilha,
  confirmarImportacao,
  type ImportacaoState,
} from './actions'

const ESTADO_INICIAL: ImportacaoState = {}

export function ImportarForm() {
  const [estadoAnalise, acaoAnalise, analisando] = useActionState<ImportacaoState, FormData>(
    analisarPlanilha,
    ESTADO_INICIAL,
  )
  const [estadoFinal, setEstadoFinal] = useState<ImportacaoState | null>(null)
  const [confirmando, startConfirmacao] = useTransition()

  const estado = estadoFinal ?? estadoAnalise
  const previa = estado.resultado
  const podeConfirmar = previa && !estado.concluido && estadoAnalise.linhasEnviadas

  function confirmar() {
    if (!estadoAnalise.linhasEnviadas) return
    startConfirmacao(async () => {
      const resultado = await confirmarImportacao(estadoAnalise.linhasEnviadas!)
      setEstadoFinal(resultado)
    })
  }

  function comecarDeNovo() {
    setEstadoFinal(null)
    window.location.reload()
  }

  // Concluido: tela de resumo final, sem tabela de previa.
  if (estado.concluido && previa) {
    return (
      <Card className="space-y-3">
        <Alert tone="success">Importacao concluida.</Alert>
        <ul className="text-sm">
          <li>
            <strong>{previa.criados}</strong> produtos novos
          </li>
          <li>
            <strong>{previa.atualizados}</strong> produtos atualizados
          </li>
          <li>
            <strong>{previa.categorias_criadas}</strong> categorias novas
          </li>
          {previa.erros.length > 0 ? (
            <li>
              <strong>{previa.erros.length}</strong> linhas ignoradas por erro
            </li>
          ) : null}
        </ul>
        <div className="flex gap-2">
          <Link
            href="/painel/produtos"
            className="flex h-12 items-center rounded-xl bg-brand px-5 font-bold text-brand-foreground"
          >
            Ver produtos
          </Link>
          <Button type="button" variant="secondary" onClick={comecarDeNovo}>
            Importar outra planilha
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {!previa ? (
        <Card>
          <form action={acaoAnalise} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="block text-sm font-semibold">Arquivo CSV</span>
              <input
                type="file"
                name="arquivo"
                accept=".csv,text/csv"
                required
                className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm"
              />
              <span className="block text-sm text-muted">
                Cabecalho esperado: <code>produto, categoria, unidade, preco</code>. Unidade aceita
                unidade, pacote, caixa, kg ou g.
              </span>
            </label>

            {estadoAnalise.erro ? <Alert tone="error">{estadoAnalise.erro}</Alert> : null}

            <Button type="submit" size="lg" className="w-full" disabled={analisando}>
              {analisando ? 'Analisando...' : 'Analisar planilha'}
            </Button>
          </form>
        </Card>
      ) : null}

      {previa ? (
        <>
          <Card className="space-y-2">
            <p className="font-bold">
              {previa.criados} novos · {previa.atualizados} atualizados ·{' '}
              {previa.categorias_criadas} categorias novas
              {previa.erros.length > 0 ? ` · ${previa.erros.length} com erro` : ''}
            </p>
            <p className="text-sm text-muted">
              Nada foi gravado ainda. Confira a lista abaixo e confirme para aplicar de verdade.
            </p>
          </Card>

          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="p-3">Linha</th>
                  <th className="p-3">Produto</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Preco</th>
                  <th className="p-3">Situacao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {previa.linhas.map((l) => (
                  <tr key={l.linha}>
                    <td className="p-3 text-muted">{l.linha}</td>
                    <td className="p-3 font-semibold">{l.nome}</td>
                    <td className="p-3">
                      {l.categoria}
                      {l.categoria_nova ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                          nova
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3">
                      {l.status === 'atualizado' && l.preco_atual !== undefined ? (
                        <span className="text-muted line-through">{moeda(l.preco_atual)}</span>
                      ) : null}{' '}
                      {moeda(l.preco_novo)}
                    </td>
                    <td className="p-3">
                      {l.status === 'novo' ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900">
                          novo
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-900">
                          atualizar
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {previa.erros.map((e) => (
                  <tr key={`erro-${e.linha}`} className="bg-rose-50">
                    <td className="p-3 text-muted">{e.linha}</td>
                    <td className="p-3 font-semibold text-rose-900" colSpan={3}>
                      {e.motivo}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-900">
                        erro
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {estadoFinal?.erro ? <Alert tone="error">{estadoFinal.erro}</Alert> : null}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={comecarDeNovo} disabled={confirmando}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              disabled={!podeConfirmar || confirmando}
              onClick={confirmar}
            >
              {confirmando ? 'Gravando...' : 'Confirmar importacao'}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
