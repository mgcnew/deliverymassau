'use client'

import Link from 'next/link'
import { Minus, Plus, Trash2 } from 'lucide-react'

import { useCarrinho } from '@/components/carrinho/use-carrinho'
import { Card, Empty } from '@/components/ui/card'
import { moeda, quantidade as formatarQuantidade } from '@/lib/format'
import { subtotalItem } from '@/lib/carrinho/tipos'
import { urlImagemProduto } from '@/lib/supabase/storage'

export function CarrinhoCliente({
  pedidoMinimo,
  deliveryAberto,
}: {
  pedidoMinimo: number
  deliveryAberto: boolean
}) {
  const { itens, subtotal, carregado, ajustar, definirObservacao, remover } = useCarrinho()

  if (!carregado) return <Empty>Carregando...</Empty>

  if (itens.length === 0) {
    return (
      <Card className="space-y-3 text-center">
        <p className="text-lg font-bold">Seu carrinho esta vazio</p>
        <Link href="/" className="inline-block font-semibold text-brand underline">
          Ver produtos
        </Link>
      </Card>
    )
  }

  const falta = Math.max(pedidoMinimo - subtotal, 0)
  const progresso = pedidoMinimo > 0 ? Math.min(subtotal / pedidoMinimo, 1) : 1

  return (
    <div className="space-y-4">
      <Card className="divide-y divide-line p-0">
        {itens.map((item) => {
          const imagem = urlImagemProduto(item.imagePath)
          const passo = item.soldByWeight ? item.weightStep : 1

          return (
            <div key={item.productId} className="space-y-2 p-4">
              <div className="flex gap-3">
                {imagem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagem} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-black/5 text-2xl">
                    🛒
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{item.name}</p>
                  <p className="text-sm text-muted">
                    {formatarQuantidade(item.quantity, item.soldByWeight, item.unitType)} ×{' '}
                    {moeda(item.price)}
                    {item.soldByWeight ? '/kg' : ''}
                  </p>
                  <p className="font-bold">{moeda(subtotalItem(item))}</p>
                </div>

                <button
                  type="button"
                  aria-label={`Remover ${item.name}`}
                  onClick={() => remover(item.productId)}
                  className="h-10 rounded-lg px-2 text-muted hover:bg-black/5"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-11 items-center rounded-xl border-2 border-brand">
                  <button
                    type="button"
                    aria-label="Diminuir"
                    onClick={() => ajustar(item.productId, -passo)}
                    className="flex h-full w-11 items-center justify-center text-brand"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="min-w-16 text-center font-bold">
                    {item.soldByWeight
                      ? `${Math.round(item.quantity * 1000)} g`
                      : `${item.quantity} ${item.unitType === 'unidade' ? 'un' : item.unitType}`}
                  </span>
                  <button
                    type="button"
                    aria-label="Aumentar"
                    onClick={() => ajustar(item.productId, passo)}
                    className="flex h-full w-11 items-center justify-center text-brand"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <input
                value={item.note}
                onChange={(e) => definirObservacao(item.productId, e.target.value)}
                maxLength={140}
                placeholder="Observacao (ex: cortada em bifes finos)"
                className="h-11 w-full rounded-xl border border-line bg-background px-3 text-sm"
              />

              {item.soldByWeight ? (
                <p className="text-xs text-muted">
                  Peso aproximado. O valor final sai da balanca na separacao.
                </p>
              ) : null}
            </div>
          )
        })}
      </Card>

      <Card className="space-y-3">
        <div className="flex justify-between text-lg">
          <span className="font-semibold">Subtotal</span>
          <span className="font-black">{moeda(subtotal)}</span>
        </div>
        <p className="text-sm text-muted">
          A taxa de entrega aparece no proximo passo, depois que voce escolher o bairro.
        </p>

        {falta > 0 ? (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-black/10">
              <div className="h-full bg-brand" style={{ width: `${progresso * 100}%` }} />
            </div>
            <p className="font-semibold text-brand">
              Faltam {moeda(falta)} para atingir o pedido minimo de {moeda(pedidoMinimo)}.
            </p>
            <Link href="/" className="inline-block font-semibold underline">
              Continuar comprando
            </Link>
          </div>
        ) : !deliveryAberto ? (
          <p className="rounded-xl bg-amber-100 px-4 py-3 font-semibold text-amber-900">
            O delivery esta fechado no momento. Seu carrinho fica guardado.
          </p>
        ) : (
          <Link
            href="/checkout"
            className="flex h-14 w-full items-center justify-center rounded-xl bg-brand text-base font-bold text-brand-foreground"
          >
            Finalizar pedido
          </Link>
        )}
      </Card>
    </div>
  )
}
