'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { useCarrinho } from '@/components/carrinho/use-carrinho'
import { Button } from '@/components/ui/button'
import { Alert, Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { moeda, quantidade as formatarQuantidade } from '@/lib/format'
import { guardarPedido } from '@/lib/carrinho/store'
import { subtotalItem } from '@/lib/carrinho/tipos'
import type { PaymentMethod } from '@/lib/types'
import { criarPedido } from './actions'

type Bairro = { bairro: string; taxa: number }
type FormaPagamento = { code: string; label: string }

const ETAPAS = ['Seus dados', 'Endereco', 'Pagamento', 'Revisao'] as const

export function CheckoutForm({
  bairros,
  formasPagamento,
  pedidoMinimo,
}: {
  bairros: Bairro[]
  formasPagamento: FormaPagamento[]
  pedidoMinimo: number
}) {
  const router = useRouter()
  const { itens, subtotal, carregado, limpar } = useCarrinho()
  const [etapa, setEtapa] = useState(0)
  const [enviando, iniciarEnvio] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarPreco, setConfirmarPreco] = useState(false)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [bairro, setBairro] = useState('')
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [referencia, setReferencia] = useState('')
  const [cep, setCep] = useState('')
  const [pagamento, setPagamento] = useState<PaymentMethod | ''>('')
  const [precisaTroco, setPrecisaTroco] = useState(false)
  const [trocoPara, setTrocoPara] = useState('')
  const [observacao, setObservacao] = useState('')

  const taxa = useMemo(
    () => bairros.find((b) => b.bairro === bairro)?.taxa ?? 0,
    [bairro, bairros],
  )
  const total = Math.round((subtotal + taxa) * 100) / 100
  const trocoNumero = Number(trocoPara.replace(/\./g, '').replace(',', '.'))
  const trocoEstimado = precisaTroco && trocoNumero > total ? trocoNumero - total : 0

  if (!carregado) return <Card>Carregando...</Card>

  if (itens.length === 0) {
    return (
      <Card className="space-y-2 text-center">
        <p className="font-bold">Seu carrinho esta vazio.</p>
        <Button type="button" variant="secondary" onClick={() => router.push('/loja')}>
          Ver produtos
        </Button>
      </Card>
    )
  }

  if (subtotal < pedidoMinimo) {
    return (
      <Card className="space-y-2 text-center">
        <p className="font-bold">
          Faltam {moeda(pedidoMinimo - subtotal)} para o pedido minimo de {moeda(pedidoMinimo)}.
        </p>
        <Button type="button" variant="secondary" onClick={() => router.push('/loja')}>
          Continuar comprando
        </Button>
      </Card>
    )
  }

  const podeAvancar =
    (etapa === 0 && nome.trim().length > 1 && telefone.replace(/\D/g, '').length >= 10) ||
    (etapa === 1 && bairro && rua.trim() && numero.trim()) ||
    (etapa === 2 &&
      pagamento &&
      (!precisaTroco || (Number.isFinite(trocoNumero) && trocoNumero > total)))

  function enviar(ignorarPreco = false) {
    setErro(null)
    iniciarEnvio(async () => {
      const resultado = await criarPedido({
        nome: nome.trim(),
        telefone,
        endereco: {
          cep: cep || undefined,
          rua: rua.trim(),
          numero: numero.trim(),
          bairro,
          complemento: complemento.trim() || undefined,
          referencia: referencia.trim() || undefined,
        },
        pagamento: pagamento as PaymentMethod,
        precisaTroco,
        trocoPara: precisaTroco ? trocoNumero : undefined,
        observacao: observacao.trim() || undefined,
        itens: itens.map((i) => ({
          product_id: i.productId,
          quantity: i.quantity,
          note: i.note || undefined,
        })),
        ...(ignorarPreco ? {} : { totalEsperado: total }),
      })

      if (resultado.pedido) {
        guardarPedido(resultado.pedido.token, resultado.pedido.numero)
        limpar()
        router.push(`/pedido/${resultado.pedido.token}?novo=1`)
        return
      }

      setConfirmarPreco(Boolean(resultado.precisaConfirmarPreco))
      setErro(resultado.erro ?? 'Nao foi possivel concluir o pedido.')
    })
  }

  return (
    <div className="space-y-4">
      <ol className="flex gap-1" aria-label="Etapas do pedido">
        {ETAPAS.map((rotulo, i) => (
          <li key={rotulo} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= etapa ? 'bg-brand' : 'bg-foreground/10'}`} />
            <span className={`text-xs font-semibold ${i === etapa ? 'text-brand' : 'text-muted'}`}>
              {rotulo}
            </span>
          </li>
        ))}
      </ol>

      <Card className="space-y-4">
        {etapa === 0 ? (
          <>
            <Field label="Seu nome">
              <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            </Field>
            <Field label="WhatsApp" hint="Usamos para avisar sobre o pedido.">
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                inputMode="tel"
                placeholder="(00) 00000-0000"
              />
            </Field>
          </>
        ) : null}

        {etapa === 1 ? (
          <>
            <Field label="Bairro" hint="A taxa de entrega depende do bairro.">
              <Select value={bairro} onChange={(e) => setBairro(e.target.value)}>
                <option value="">Escolha o bairro...</option>
                {bairros.map((b) => (
                  <option key={b.bairro} value={b.bairro}>
                    {b.bairro} - {moeda(b.taxa)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="Rua">
                <Input value={rua} onChange={(e) => setRua(e.target.value)} />
              </Field>
              <Field label="Numero">
                <Input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className="sm:w-28"
                />
              </Field>
            </div>
            <Field label="Complemento">
              <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </Field>
            <Field label="Ponto de referencia">
              <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </Field>
            <Field label="CEP (opcional)">
              <Input value={cep} onChange={(e) => setCep(e.target.value)} inputMode="numeric" />
            </Field>
          </>
        ) : null}

        {etapa === 2 ? (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Forma de pagamento</legend>
              {formasPagamento.map((f) => (
                <label
                  key={f.code}
                  className={`flex h-14 items-center gap-3 rounded-xl border px-4 font-semibold ${
                    pagamento === f.code ? 'border-brand bg-brand/5' : 'border-line'
                  }`}
                >
                  <input
                    type="radio"
                    name="pagamento"
                    className="size-5 accent-[var(--brand)]"
                    checked={pagamento === f.code}
                    onChange={() => {
                      setPagamento(f.code as PaymentMethod)
                      if (f.code !== 'dinheiro') setPrecisaTroco(false)
                    }}
                  />
                  {f.label}
                </label>
              ))}
            </fieldset>

            {pagamento === 'dinheiro' ? (
              <div className="space-y-3 rounded-xl border border-line p-3">
                <p className="font-semibold">Precisa de troco?</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={precisaTroco ? 'secondary' : 'primary'}
                    onClick={() => setPrecisaTroco(false)}
                  >
                    Nao
                  </Button>
                  <Button
                    type="button"
                    variant={precisaTroco ? 'primary' : 'secondary'}
                    onClick={() => setPrecisaTroco(true)}
                  >
                    Sim
                  </Button>
                </div>

                {precisaTroco ? (
                  <>
                    <Field label="Troco para quanto?" hint={`Total do pedido: ${moeda(total)}`}>
                      <Input
                        value={trocoPara}
                        onChange={(e) => setTrocoPara(e.target.value)}
                        inputMode="decimal"
                        placeholder="0,00"
                      />
                    </Field>
                    {trocoPara && trocoNumero <= total ? (
                      <Alert tone="error">
                        O valor precisa ser maior que o total do pedido ({moeda(total)}).
                      </Alert>
                    ) : null}
                    {trocoEstimado > 0 ? (
                      <p className="font-bold">Troco estimado: {moeda(trocoEstimado)}</p>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            <Field label="Observacao do pedido" hint="Ex: interfone quebrado, chamar no WhatsApp.">
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                maxLength={280}
              />
            </Field>
          </>
        ) : null}

        {etapa === 3 ? (
          <div className="space-y-3">
            <div>
              <p className="font-bold">{nome}</p>
              <p className="text-sm text-muted">{telefone}</p>
              <p className="text-sm text-muted">
                {rua}, {numero}
                {complemento ? ` - ${complemento}` : ''} - {bairro}
              </p>
              {referencia ? <p className="text-sm text-muted">Ref: {referencia}</p> : null}
            </div>

            <ul className="divide-y divide-line border-y border-line">
              {itens.map((i) => (
                <li key={i.productId} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-semibold">{i.name}</span>
                    <span className="text-muted">
                      {formatarQuantidade(i.quantity, i.soldByWeight, i.unitType)}
                      {i.note ? ` - ${i.note}` : ''}
                    </span>
                  </span>
                  <span className="font-semibold">{moeda(subtotalItem(i))}</span>
                </li>
              ))}
            </ul>

            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{moeda(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Taxa de entrega ({bairro})</dt>
                <dd>{moeda(taxa)}</dd>
              </div>
              <div className="flex justify-between text-lg font-black">
                <dt>Total</dt>
                <dd>{moeda(total)}</dd>
              </div>
              {precisaTroco && trocoEstimado > 0 ? (
                <div className="flex justify-between">
                  <dt>Troco para {moeda(trocoNumero)}</dt>
                  <dd>{moeda(trocoEstimado)}</dd>
                </div>
              ) : null}
            </dl>

            {itens.some((i) => i.soldByWeight) ? (
              <Alert>
                Itens por peso tem valor estimado. O total final sai da balanca na separacao e voce
                acompanha pelo link do pedido.
              </Alert>
            ) : null}
          </div>
        ) : null}

        {erro ? <Alert tone="error">{erro}</Alert> : null}

        <div className="flex gap-2">
          {etapa > 0 ? (
            <Button type="button" variant="secondary" onClick={() => setEtapa(etapa - 1)}>
              Voltar
            </Button>
          ) : null}

          {etapa < 3 ? (
            <Button
              type="button"
              size="lg"
              className="flex-1"
              disabled={!podeAvancar}
              onClick={() => setEtapa(etapa + 1)}
            >
              Continuar
            </Button>
          ) : confirmarPreco ? (
            <Button
              type="button"
              size="lg"
              className="flex-1"
              disabled={enviando}
              onClick={() => enviar(true)}
            >
              {enviando ? 'Enviando...' : 'Confirmar com o novo valor'}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="flex-1"
              disabled={enviando}
              onClick={() => enviar(false)}
            >
              {enviando ? 'Enviando...' : `Fazer pedido - ${moeda(total)}`}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
