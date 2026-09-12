'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { ConfirmarAcao } from '@/components/ui/confirmar-acao'
import {
  alternarAtivo,
  alternarDisponibilidade,
  alternarSempreTem,
  excluirProduto,
} from '../actions'

export function EstadoProduto({
  id,
  ativo,
  disponivel,
  sempreTem,
  podeDesativar,
  podeAlterarDisponibilidade,
  podeEditar,
  podeExcluir,
  jaVendeu,
}: {
  id: string
  ativo: boolean
  disponivel: boolean
  sempreTem: boolean
  podeDesativar: boolean
  podeAlterarDisponibilidade: boolean
  podeEditar: boolean
  podeExcluir: boolean
  /** Produto que ja saiu em pedido nao pode ser apagado - so desativado. */
  jaVendeu: boolean
}) {
  const router = useRouter()
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Disponivel para venda</p>
          <p className="text-sm text-muted">Some do carrinho na hora quando o estoque acaba.</p>
        </div>
        <Button
          type="button"
          variant={disponivel ? 'secondary' : 'primary'}
          disabled={!podeAlterarDisponibilidade || transicao}
          onClick={() =>
            startTransition(async () => {
              const r = await alternarDisponibilidade(id, !disponivel)
              setErro(r.error ?? null)
            })
          }
        >
          {disponivel ? 'Marcar que acabou' : 'Marcar como disponivel'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div className="min-w-0">
          <p className="font-semibold">Sempre tem</p>
          <p className="text-sm text-muted">
            {sempreTem
              ? 'A conferencia de estoque nunca tira este produto do catalogo. Quando acabar, marque acima.'
              : 'Para o que a loja sempre trabalha e e reposto no dia: pao, fatiados, hortifruti. A conferencia deixa de exigir que ele seja bipado.'}
          </p>
        </div>
        <Button
          type="button"
          variant={sempreTem ? 'secondary' : 'primary'}
          disabled={!podeEditar || transicao}
          onClick={() =>
            startTransition(async () => {
              const r = await alternarSempreTem(id, !sempreTem)
              setErro(r.error ?? null)
              if (!r.error) router.refresh()
            })
          }
        >
          {sempreTem ? 'Deixar de marcar' : 'Marcar "sempre tem"'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div>
          <p className="font-semibold">Ativo no catalogo</p>
          <p className="text-sm text-muted">Inativo nem aparece no portal do cliente.</p>
        </div>
        <Button
          type="button"
          variant={ativo ? 'danger' : 'secondary'}
          disabled={!podeDesativar || transicao}
          onClick={() =>
            startTransition(async () => {
              const r = await alternarAtivo(id, !ativo)
              setErro(r.error ?? null)
            })
          }
        >
          {ativo ? 'Desativar produto' : 'Reativar produto'}
        </Button>
      </div>

      {podeExcluir ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <div className="min-w-0">
            <p className="font-semibold">Excluir do cadastro</p>
            <p className="text-sm text-muted">
              {jaVendeu
                ? 'Este produto ja saiu em pedido: ele sera apenas desativado, para nao apagar o historico de vendas.'
                : 'Este produto nunca foi vendido: ele sai do cadastro de vez.'}
            </p>
          </div>

          <ConfirmarAcao
            titulo={jaVendeu ? 'Desativar este produto?' : 'Excluir este produto?'}
            descricao={
              jaVendeu
                ? 'Ele ja aparece em pedidos antigos, entao sera desativado em vez de apagado. Some da loja, mas continua no historico.'
                : 'Ele nunca foi vendido, entao sera apagado de vez, junto com a foto. Nao da para desfazer.'
            }
            rotuloConfirmar={jaVendeu ? 'Desativar' : 'Excluir'}
            onConfirmar={async () => {
              const r = await excluirProduto(id)
              if (r.error) return { erro: r.error }
              // Excluido de verdade: a pagina deste produto deixou de existir.
              if (r.acao === 'excluido') router.push('/painel/produtos')
              else router.refresh()
            }}
          >
            {jaVendeu ? 'Desativar' : 'Excluir produto'}
          </ConfirmarAcao>
        </div>
      ) : null}

      {erro ? (
        <p role="status" aria-live="polite" className="text-sm font-semibold text-rose-700">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
