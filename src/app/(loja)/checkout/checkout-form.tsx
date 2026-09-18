'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import { useCarrinho } from '@/components/carrinho/use-carrinho'
import { Button } from '@/components/ui/button'
import { Alert, Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { moeda, normalizarComparacao, quantidade as formatarQuantidade } from '@/lib/format'
import {
  assinarDadosCheckout,
  guardarPedido,
  lerDadosCheckout,
  lerDadosCheckoutNoServidor,
  salvarDadosCheckout,
} from '@/lib/carrinho/store'
import { subtotalItem } from '@/lib/carrinho/tipos'
import { kmTexto } from '@/lib/entrega/faixas'
import { buscarEnderecoPorCep } from '@/lib/loja/cep'
import type { PaymentMethod } from '@/lib/types'
import { cotarEntregaDoCheckout, criarPedido } from './actions'

type Bairro = { bairro: string; taxa: number }
type FormaPagamento = { code: string; label: string; brands?: string[] }

const ETAPAS = ['Seus dados', 'Endereco', 'Pagamento', 'Revisao'] as const

/** Cotacao de entrega por distancia, presa ao endereco para o qual foi feita. */
type CotacaoTela = { id: string; taxa: number; rotulo: string; reserva?: boolean; chave: string }

function chaveEndereco(rua: string, numero: string, bairro: string, cep: string) {
  const n = (t: string) => normalizarComparacao(t.trim())
  return `${n(rua)}|${n(numero)}|${n(bairro)}|${cep.replace(/\D/g, '')}`
}

export function CheckoutForm({
  bairros,
  formasPagamento,
  pedidoMinimo,
  modoTaxa = 'bairro',
  whatsapp,
}: {
  bairros: Bairro[]
  formasPagamento: FormaPagamento[]
  pedidoMinimo: number
  /** 'distancia': a taxa vem do servidor (km pelo Google), nao da lista de bairros. */
  modoTaxa?: 'bairro' | 'distancia'
  /** Telefone do mercado, para o "chame no WhatsApp" quando a entrega nao da. */
  whatsapp?: string | null
}) {
  const porDistancia = modoTaxa === 'distancia'
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
  const [resultadoCep, setResultadoCep] = useState<{
    digitos: string
    status: 'encontrado' | 'sem_cobertura' | 'nao_encontrado' | 'erro'
  } | null>(null)
  const [pagamento, setPagamento] = useState<PaymentMethod | ''>('')
  // So o voucher pede a bandeira: o entregador precisa saber qual vale vai
  // passar na maquininha. Nos cartoes as bandeiras sao so informacao.
  const [bandeira, setBandeira] = useState('')
  const [precisaTroco, setPrecisaTroco] = useState(false)
  const [trocoPara, setTrocoPara] = useState('')
  const [observacao, setObservacao] = useState('')
  const [cotacao, setCotacao] = useState<CotacaoTela | null>(null)
  const [avisoEntrega, setAvisoEntrega] = useState<string | null>(null)
  const [cotando, iniciarCotacao] = useTransition()

  // Dados do ultimo pedido feito neste aparelho (nome, telefone, endereco).
  // No servidor sempre null -- o preenchimento acontece so depois de hidratar.
  const dadosSalvos = useSyncExternalStore(
    assinarDadosCheckout,
    lerDadosCheckout,
    lerDadosCheckoutNoServidor,
  )
  const [pessoalPreenchido, setPessoalPreenchido] = useState(false)
  const [enderecoPreenchido, setEnderecoPreenchido] = useState(false)

  // Ajuste de estado durante a renderizacao (nao em efeito): assim que os
  // dados salvos aparecerem (so no cliente, apos hidratar), preenche os
  // campos de uma vez, sem flash visivel. So roda uma vez por secao -- se o
  // cliente limpar pra digitar outro, a flag ja true nao deixa preencher de novo.
  if (dadosSalvos && !pessoalPreenchido) {
    setPessoalPreenchido(true)
    setNome(dadosSalvos.nome)
    setTelefone(dadosSalvos.telefone)
  }
  if (dadosSalvos?.endereco && !enderecoPreenchido) {
    // Por distancia qualquer bairro serve (o que vale e o km); por bairro, so
    // um que ainda esteja na lista.
    const bairroValido = porDistancia || bairros.some((b) => b.bairro === dadosSalvos.endereco.bairro)
    setEnderecoPreenchido(true)
    setCep(dadosSalvos.endereco.cep)
    setRua(dadosSalvos.endereco.rua)
    setNumero(dadosSalvos.endereco.numero)
    setBairro(bairroValido ? dadosSalvos.endereco.bairro : '')
    setComplemento(dadosSalvos.endereco.complemento)
    setReferencia(dadosSalvos.endereco.referencia)
    // O bairro salvo ja foi conferido contra a lista atual (acima) -- nao
    // precisa consultar o CEP de novo so porque o campo foi preenchido.
    const digitosSalvos = dadosSalvos.endereco.cep.replace(/\D/g, '')
    if (digitosSalvos.length === 8) {
      setResultadoCep({ digitos: digitosSalvos, status: bairroValido ? 'encontrado' : 'sem_cobertura' })
    }
  }

  // A cotacao so vale para o endereco em que foi feita: mexeu em rua, numero,
  // bairro ou CEP, some - e o Continuar cota de novo.
  const chaveAtual = chaveEndereco(rua, numero, bairro, cep)
  const cotacaoValida = cotacao && cotacao.chave === chaveAtual ? cotacao : null

  const taxaBairro = useMemo(
    () => bairros.find((b) => b.bairro === bairro)?.taxa ?? 0,
    [bairro, bairros],
  )
  const taxa = porDistancia ? (cotacaoValida?.taxa ?? 0) : taxaBairro
  const total = Math.round((subtotal + taxa) * 100) / 100
  const trocoNumero = Number(trocoPara.replace(/\./g, '').replace(',', '.'))
  const trocoEstimado = precisaTroco && trocoNumero > total ? trocoNumero - total : 0

  const digitosCep = cep.replace(/\D/g, '')
  // 'buscando' e derivado (digitos completos mas ainda sem resultado pra eles)
  // em vez de um setState proprio, pra nao ter estado sincrono duplicado.
  const statusCep =
    digitosCep.length !== 8
      ? 'ocioso'
      : resultadoCep?.digitos === digitosCep
        ? resultadoCep.status
        : 'buscando'

  // CEP e so um atalho: preenche bairro e rua sozinho quando da, mas nunca
  // trava o formulario -- o cliente sempre pode escolher/digitar na mao.
  useEffect(() => {
    if (digitosCep.length !== 8) return
    // Ja tem resultado pra esses digitos (busca anterior ou preenchimento
    // automatico do ultimo pedido) -- nao consulta de novo.
    if (resultadoCep?.digitos === digitosCep) return

    let cancelado = false
    const temporizador = setTimeout(async () => {
      try {
        const endereco = await buscarEnderecoPorCep(digitosCep)
        if (cancelado) return

        if (!endereco) {
          setResultadoCep({ digitos: digitosCep, status: 'nao_encontrado' })
          return
        }

        if (!rua.trim() && endereco.rua) setRua(endereco.rua)

        if (porDistancia) {
          if (endereco.bairro) setBairro(endereco.bairro)
          setResultadoCep({ digitos: digitosCep, status: 'encontrado' })
          return
        }

        const alvo = normalizarComparacao(endereco.bairro)
        const encontrado = bairros.find((b) => normalizarComparacao(b.bairro) === alvo)
        if (encontrado) {
          setBairro(encontrado.bairro)
          setResultadoCep({ digitos: digitosCep, status: 'encontrado' })
        } else {
          setResultadoCep({ digitos: digitosCep, status: 'sem_cobertura' })
        }
      } catch {
        if (!cancelado) setResultadoCep({ digitos: digitosCep, status: 'erro' })
      }
    }, 500)

    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digitosCep])

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

  const formaEscolhida = formasPagamento.find((f) => f.code === pagamento)

  const podeAvancar =
    (etapa === 0 && nome.trim().length > 1 && telefone.replace(/\D/g, '').length >= 10) ||
    // Por distancia o CEP e obrigatorio: e ele que confere se o geocodificador
    // acertou o trecho da rua. Sem essa conferencia, um fornecedor pode
    // devolver outra rua com cara de certa e a taxa sai errada - aconteceu em
    // producao. Por bairro ele segue opcional: ali a taxa nao depende de
    // onde exatamente a casa fica.
    (etapa === 1 &&
      bairro &&
      rua.trim() &&
      numero.trim() &&
      (!porDistancia || digitosCep.length === 8)) ||
    (etapa === 2 &&
      pagamento &&
      (pagamento !== 'voucher' || bandeira) &&
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
        bandeira: pagamento === 'voucher' ? bandeira : undefined,
        precisaTroco,
        trocoPara: precisaTroco ? trocoNumero : undefined,
        observacao: observacao.trim() || undefined,
        itens: itens.map((i) => ({
          product_id: i.productId,
          quantity: i.quantity,
          note: i.note || undefined,
        })),
        ...(ignorarPreco ? {} : { totalEsperado: total }),
        ...(porDistancia && cotacaoValida ? { cotacao: cotacaoValida.id } : {}),
      })

      if (resultado.pedido) {
        guardarPedido(resultado.pedido.token, resultado.pedido.numero)
        salvarDadosCheckout({
          nome: nome.trim(),
          telefone,
          endereco: {
            cep,
            rua: rua.trim(),
            numero: numero.trim(),
            bairro,
            complemento: complemento.trim(),
            referencia: referencia.trim(),
          },
        })
        limpar()
        router.push(`/pedido/${resultado.pedido.token}?novo=1`)
        return
      }

      if (resultado.refazerCotacao) {
        setCotacao(null)
        setEtapa(1)
        setAvisoEntrega(resultado.erro ?? null)
        return
      }
      setConfirmarPreco(Boolean(resultado.precisaConfirmarPreco))
      setErro(resultado.erro ?? 'Nao foi possivel concluir o pedido.')
    })
  }

  // Endereco -> pagamento: por distancia, primeiro a taxa (cotacao no
  // servidor). Endereco ja cotado segue direto.
  function continuar() {
    if (etapa !== 1 || !porDistancia || cotacaoValida) {
      setEtapa(etapa + 1)
      return
    }
    setAvisoEntrega(null)
    iniciarCotacao(async () => {
      const r = await cotarEntregaDoCheckout({ rua, numero, bairro, cep })
      if ('ok' in r) {
        setCotacao({ id: r.cotacao, taxa: r.taxa, rotulo: r.rotulo, reserva: r.reserva, chave: chaveAtual })
        setEtapa(2)
      } else if ('fora' in r) {
        setAvisoEntrega(
          `Este endereco fica ${r.km ? `a ${kmTexto(r.km)} km, ` : ''}fora da nossa area de entrega${
            r.limiteKm ? ` (ate ${kmTexto(r.limiteKm)} km)` : ''
          }.`,
        )
      } else if ('erro' in r) {
        setAvisoEntrega(r.erro)
      } else {
        // O mercado voltou a cobrar por bairro enquanto o cliente preenchia.
        setEtapa(2)
      }
    })
  }

  const linkWhats = whatsapp ? `https://wa.me/55${whatsapp.replace(/\D/g, '')}` : null

  return (
    <div className="space-y-4">
      <ol className="flex gap-1" aria-label="Etapas do pedido">
        {ETAPAS.map((rotulo, i) => (
          <li key={rotulo} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= etapa ? 'bg-brand' : 'bg-foreground/10'}`} />
            <span className={`text-xs font-semibold ${i === etapa ? 'text-brand-ink' : 'text-muted'}`}>
              {rotulo}
            </span>
          </li>
        ))}
      </ol>

      <Card className="space-y-4">
        {etapa === 0 ? (
          <>
            {pessoalPreenchido ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-foreground/5 px-3 py-2 text-xs text-muted">
                <span>Preenchido com os dados do seu ultimo pedido.</span>
                <button
                  type="button"
                  className="shrink-0 font-semibold text-brand-ink underline"
                  onClick={() => {
                    setNome('')
                    setTelefone('')
                  }}
                >
                  Nao sou eu
                </button>
              </div>
            ) : null}
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
            {enderecoPreenchido ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-foreground/5 px-3 py-2 text-xs text-muted">
                <span>Endereco do seu ultimo pedido.</span>
                <button
                  type="button"
                  className="shrink-0 font-semibold text-brand-ink underline"
                  onClick={() => {
                    setCep('')
                    setRua('')
                    setNumero('')
                    setBairro('')
                    setComplemento('')
                    setReferencia('')
                  }}
                >
                  Usar outro endereco
                </button>
              </div>
            ) : null}
            <Field
              label={porDistancia ? 'CEP' : 'CEP (opcional)'}
              hint={
                porDistancia
                  ? 'Precisamos do CEP para calcular a entrega. Ele ja preenche a rua e o bairro sozinho.'
                  : 'Preenchendo o CEP a gente tenta achar o bairro e a rua sozinho.'
              }
            >
              <div className="relative">
                <Input
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  inputMode="numeric"
                  placeholder="00000-000"
                  maxLength={9}
                />
                {statusCep === 'buscando' ? (
                  <Loader2
                    size={18}
                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted"
                    aria-hidden
                  />
                ) : null}
              </div>
            </Field>
            {statusCep === 'encontrado' ? (
              <Alert tone="success">Endereco encontrado: bairro preenchido automaticamente.</Alert>
            ) : null}
            {statusCep === 'sem_cobertura' ? (
              <Alert tone="info">
                Achamos o CEP, mas o bairro dele ainda nao esta na nossa lista de entrega. Escolha o
                bairro mais proximo abaixo.
              </Alert>
            ) : null}
            {statusCep === 'nao_encontrado' ? (
              <Alert tone="error">CEP nao encontrado. Confira o numero ou preencha na mao.</Alert>
            ) : null}
            {statusCep === 'erro' ? (
              <Alert tone="info">
                Nao consegui consultar esse CEP agora. Preencha o endereco na mao mesmo.
              </Alert>
            ) : null}

            {porDistancia ? (
              // Por distancia qualquer bairro serve: o que vale e o km.
              <Field label="Bairro">
                <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
              </Field>
            ) : (
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
            )}
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

            {porDistancia ? (
              <p className="text-sm text-muted">
                A taxa de entrega e calculada pela distancia ate o seu endereco, ao continuar.
              </p>
            ) : null}
            {avisoEntrega ? (
              <Alert tone="error">
                {avisoEntrega}
                {linkWhats ? (
                  <>
                    {' '}
                    <a href={linkWhats} target="_blank" rel="noreferrer" className="font-bold underline">
                      Chamar no WhatsApp
                    </a>
                  </>
                ) : null}
              </Alert>
            ) : null}
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
                      if (f.code !== 'voucher') setBandeira('')
                    }}
                  />
                  {f.label}
                </label>
              ))}
            </fieldset>

            {formaEscolhida?.brands?.length ? (
              pagamento === 'voucher' ? (
                <fieldset className="space-y-2 rounded-xl border border-line p-3">
                  <legend className="px-1 text-sm font-semibold">Qual e o seu vale?</legend>
                  <p className="text-sm text-muted">
                    Aceitamos estas bandeiras. O entregador leva a maquininha certa.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {formaEscolhida.brands.map((b) => (
                      <label
                        key={b}
                        className={`flex h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-bold ${
                          bandeira === b
                            ? 'border-brand bg-brand text-brand-foreground'
                            : 'border-line bg-surface'
                        }`}
                      >
                        <input
                          type="radio"
                          name="bandeira"
                          value={b}
                          checked={bandeira === b}
                          onChange={() => setBandeira(b)}
                          className="sr-only"
                        />
                        {b}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted">
                    Seu vale nao esta na lista? Escolha outra forma de pagamento.
                  </p>
                </fieldset>
              ) : (
                <p className="rounded-xl bg-foreground/5 px-3 py-2 text-sm">
                  <span className="font-semibold">Bandeiras aceitas:</span>{' '}
                  {formaEscolhida.brands.join(', ')}
                </p>
              )
            ) : null}

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
                <dt>
                  {/*
                    So "Entrega", sem km e sem o nome da faixa. O rotulo
                    ("Ate 2 km") continua gravado na cotacao e aparece no
                    painel e nos relatorios - o cliente e que nao ve
                    distancia nenhuma.
                  */}
                  {porDistancia && cotacaoValida ? 'Entrega' : `Taxa de entrega (${bairro})`}
                </dt>
                <dd>{moeda(taxa)}</dd>
              </div>
              <div className="flex justify-between text-lg font-black">
                <dt>Total</dt>
                <dd>{moeda(total)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Pagamento na entrega</dt>
                <dd className="text-right font-semibold">
                  {formaEscolhida?.label}
                  {pagamento === 'voucher' && bandeira ? ` - ${bandeira}` : ''}
                </dd>
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
              disabled={!podeAvancar || cotando}
              onClick={continuar}
            >
              {cotando ? 'Calculando entrega...' : 'Continuar'}
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
