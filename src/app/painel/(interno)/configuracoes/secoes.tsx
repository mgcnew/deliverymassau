'use client'

import Image from 'next/image'
import { useActionState, useMemo, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Alert, Card, CardTitle } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { moeda, normalizarComparacao } from '@/lib/format'
import { distanciaEdicao } from '@/lib/similaridade'
import {
  adicionarBairro,
  alternarPagamento,
  alternarZona,
  removerBairro,
  salvarDelivery,
  salvarMercado,
  salvarPix,
  salvarZona,
  type ConfigState,
} from './actions'

function Resultado({ estado }: { estado: ConfigState }) {
  if (estado.erro) return <Alert tone="error">{estado.erro}</Alert>
  if (estado.ok) return <Alert tone="success">{estado.ok}</Alert>
  return null
}

export function SecaoMercado({
  valores,
  logoUrl,
}: {
  valores: {
    market_name: string
    market_phone: string | null
    market_address: string | null
    market_city: string | null
    timezone: string
  }
  logoUrl: string | null
}) {
  const [estado, acao, pendente] = useActionState<ConfigState, FormData>(salvarMercado, {})

  return (
    <Card>
      <CardTitle>Mercado</CardTitle>
      <form action={acao} className="space-y-4">
        <Field label="Nome">
          <Input name="market_name" defaultValue={valores.market_name} required />
        </Field>
        <Field label="WhatsApp">
          <Input name="market_phone" defaultValue={valores.market_phone ?? ''} inputMode="tel" />
        </Field>
        <Field label="Endereco">
          <Input name="market_address" defaultValue={valores.market_address ?? ''} />
        </Field>
        <Field label="Cidade / UF" hint="Usada nos links de Maps e Waze e no cabecalho da impressao.">
          <Input name="market_city" defaultValue={valores.market_city ?? ''} placeholder="Cidade - UF" />
        </Field>
        <Field label="Fuso horario" hint="Define o que conta como 'hoje' no dashboard.">
          <Input name="timezone" defaultValue={valores.timezone} />
        </Field>
        <Field label="Logo">
          <input
            type="file"
            name="logo"
            accept="image/*"
            className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm"
          />
        </Field>
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={80}
            height={80}
            className="size-20 rounded-xl object-cover"
          />
        ) : null}

        <Resultado estado={estado} />
        <Button type="submit" disabled={pendente}>
          {pendente ? 'Salvando...' : 'Salvar mercado'}
        </Button>
      </form>
    </Card>
  )
}

export function SecaoDelivery({
  valores,
  podeAbrirFechar,
  podeMinimo,
}: {
  valores: {
    delivery_enabled: boolean
    delivery_closed_message: string
    min_order_value: number
    weight_tolerance_pct: number
  }
  podeAbrirFechar: boolean
  podeMinimo: boolean
}) {
  const [estadoStatus, acaoStatus, pendenteStatus] = useActionState<ConfigState, FormData>(
    salvarDelivery,
    {},
  )
  const [estadoMinimo, acaoMinimo, pendenteMinimo] = useActionState<ConfigState, FormData>(
    salvarDelivery,
    {},
  )
  const [aberto, setAberto] = useState(valores.delivery_enabled)

  return (
    <>
      {podeAbrirFechar ? (
        <Card>
          <CardTitle>Delivery aberto</CardTitle>
          <form action={acaoStatus} className="space-y-4">
            <label className="flex items-center gap-3 rounded-xl border border-line p-3">
              <input
                type="checkbox"
                name="delivery_enabled"
                className="size-6 accent-[var(--brand)]"
                checked={aberto}
                onChange={(e) => setAberto(e.target.checked)}
              />
              <span>
                <span className="block font-bold">
                  {aberto ? 'Recebendo pedidos' : 'Fechado para novos pedidos'}
                </span>
                <span className="block text-sm text-muted">
                  Fechado, o portal continua no ar avisando o cliente. Pedidos em andamento seguem
                  normalmente.
                </span>
              </span>
            </label>

            <Field label="Mensagem quando estiver fechado">
              <Textarea
                name="delivery_closed_message"
                defaultValue={valores.delivery_closed_message}
                maxLength={160}
              />
            </Field>

            <Resultado estado={estadoStatus} />
            <Button type="submit" disabled={pendenteStatus}>
              {pendenteStatus ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </Card>
      ) : null}

      {podeMinimo ? (
        <Card>
          <CardTitle>Pedido minimo e pesagem</CardTitle>
          <form action={acaoMinimo} className="space-y-4">
            <Field
              label="Pedido minimo (R$)"
              hint="Conta so os produtos. A taxa de entrega fica de fora."
            >
              <Input
                name="min_order_value"
                inputMode="decimal"
                defaultValue={String(valores.min_order_value).replace('.', ',')}
              />
            </Field>
            <Field
              label="Tolerancia de peso (%)"
              hint="Divergencia entre o peso pedido e o da balanca que pede confirmacao extra."
            >
              <Input
                name="weight_tolerance_pct"
                type="number"
                min={1}
                max={200}
                defaultValue={valores.weight_tolerance_pct}
              />
            </Field>

            <Resultado estado={estadoMinimo} />
            <Button type="submit" disabled={pendenteMinimo}>
              {pendenteMinimo ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </Card>
      ) : null}
    </>
  )
}

export function SecaoPagamentos({
  metodos,
  pix,
  podePix,
}: {
  metodos: Array<{ code: string; label: string; is_active: boolean }>
  pix: { pix_key: string | null; pix_receiver_name: string | null }
  podePix: boolean
}) {
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [estadoPix, acaoPix, pendentePix] = useActionState<ConfigState, FormData>(salvarPix, {})

  return (
    <>
      <Card>
        <CardTitle>Formas de pagamento</CardTitle>
        <div className="space-y-2">
          {metodos.map((m) => (
            <div
              key={m.code}
              className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"
            >
              <span className="font-semibold">{m.label}</span>
              <Button
                type="button"
                variant={m.is_active ? 'secondary' : 'primary'}
                disabled={transicao}
                onClick={() =>
                  startTransition(async () => {
                    const r = await alternarPagamento(m.code, !m.is_active)
                    setErro(r.erro ?? null)
                  })
                }
              >
                {m.is_active ? 'Desativar' : 'Ativar'}
              </Button>
            </div>
          ))}
          {erro ? <Alert tone="error">{erro}</Alert> : null}
        </div>
      </Card>

      {podePix ? (
        <Card>
          <CardTitle>PIX</CardTitle>
          <form action={acaoPix} className="space-y-4">
            <Field label="Chave PIX">
              <Input name="pix_key" defaultValue={pix.pix_key ?? ''} />
            </Field>
            <Field label="Nome do recebedor">
              <Input name="pix_receiver_name" defaultValue={pix.pix_receiver_name ?? ''} />
            </Field>
            <Resultado estado={estadoPix} />
            <Button type="submit" disabled={pendentePix}>
              {pendentePix ? 'Salvando...' : 'Salvar PIX'}
            </Button>
          </form>
        </Card>
      ) : null}
    </>
  )
}

export type ZonaComBairros = {
  id: string
  name: string
  fee: number
  is_active: boolean
  bairros: Array<{ id: string; name: string }>
}

export function SecaoZonas({ zonas }: { zonas: ZonaComBairros[] }) {
  const [estadoZona, acaoZona, pendenteZona] = useActionState<ConfigState, FormData>(salvarZona, {})

  const zonasAtivas = zonas.filter((z) => z.is_active).length
  const totalBairros = zonas.reduce((soma, z) => soma + z.bairros.length, 0)
  const zonasVazias = zonas.filter((z) => z.is_active && z.bairros.length === 0).length

  const todosBairros = useMemo(
    () => zonas.flatMap((z) => z.bairros.map((b) => ({ nome: b.name, zona: z.name }))),
    [zonas],
  )

  return (
    <Card>
      <CardTitle>Regioes e taxas de entrega</CardTitle>

      <div className="mb-4 flex flex-wrap gap-2 text-sm font-semibold">
        <span className="rounded-full bg-foreground/5 px-3 py-1">
          {zonas.length} {zonas.length === 1 ? 'regiao' : 'regioes'}
        </span>
        <span className="rounded-full bg-foreground/5 px-3 py-1">{zonasAtivas} ativas</span>
        <span className="rounded-full bg-foreground/5 px-3 py-1">
          {totalBairros} {totalBairros === 1 ? 'bairro' : 'bairros'} cadastrados
        </span>
        {zonasVazias > 0 ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
            {zonasVazias} {zonasVazias === 1 ? 'regiao ativa sem bairro' : 'regioes ativas sem bairro'}
          </span>
        ) : null}
      </div>

      <div className="space-y-4">
        {zonas.map((zona) => (
          <ZonaLinha key={zona.id} zona={zona} todosBairros={todosBairros} />
        ))}

        <form action={acaoZona} className="space-y-2 rounded-xl border border-dashed border-line p-3">
          <p className="font-semibold">Nova regiao</p>
          <div className="flex flex-wrap gap-2">
            <Input name="name" placeholder="Nome da regiao" className="flex-1" required />
            <Input name="fee" placeholder="Taxa (R$)" inputMode="decimal" className="w-32" required />
            <Button type="submit" disabled={pendenteZona}>
              Criar
            </Button>
          </div>
          <Resultado estado={estadoZona} />
        </form>

        <p className="text-sm text-muted">
          O cliente escolhe o bairro numa lista no checkout. Bairro que nao estiver em nenhuma
          regiao aparece como fora da area de entrega.
        </p>
      </div>
    </Card>
  )
}

function ZonaLinha({
  zona,
  todosBairros,
}: {
  zona: ZonaComBairros
  todosBairros: Array<{ nome: string; zona: string }>
}) {
  const [estadoZona, acaoZona, pendenteZona] = useActionState<ConfigState, FormData>(salvarZona, {})
  const [estadoBairro, acaoBairro, pendenteBairro] = useActionState<ConfigState, FormData>(
    adicionarBairro,
    {},
  )
  const [transicao, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [filtroBairro, setFiltroBairro] = useState('')
  const [novoBairro, setNovoBairro] = useState('')

  const bairrosFiltrados = filtroBairro.trim()
    ? zona.bairros.filter((b) =>
        normalizarComparacao(b.name).includes(normalizarComparacao(filtroBairro)),
      )
    : zona.bairros

  // Aviso leve, nao bloqueia: o banco ja recusa nome identico (mesmo com
  // acento/caixa diferente). Isso aqui pega erro de digitacao, tipo "Cetro".
  const parecido = useMemo(() => {
    const alvo = normalizarComparacao(novoBairro)
    if (alvo.length < 4) return null
    let melhor: { nome: string; zona: string; distancia: number } | null = null
    for (const b of todosBairros) {
      if (normalizarComparacao(b.nome) === alvo) continue
      const distancia = distanciaEdicao(alvo, normalizarComparacao(b.nome))
      if (distancia <= 2 && (!melhor || distancia < melhor.distancia)) {
        melhor = { ...b, distancia }
      }
    }
    return melhor
  }, [novoBairro, todosBairros])

  const semBairro = zona.is_active && zona.bairros.length === 0

  return (
    <div className={`space-y-3 rounded-xl border p-3 ${zona.is_active ? 'border-line' : 'border-dashed border-line opacity-60'}`}>
      <form action={acaoZona} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={zona.id} />
        <Input name="name" defaultValue={zona.name} className="min-w-40 flex-1" />
        <Input
          name="fee"
          defaultValue={String(zona.fee).replace('.', ',')}
          inputMode="decimal"
          className="w-28"
        />
        <Button type="submit" variant="secondary" disabled={pendenteZona}>
          Salvar
        </Button>
        <Button
          type="button"
          variant={zona.is_active ? 'ghost' : 'secondary'}
          disabled={transicao}
          onClick={() =>
            startTransition(async () => {
              const r = await alternarZona(zona.id, !zona.is_active)
              setErro(r.erro ?? null)
            })
          }
        >
          {zona.is_active ? 'Desativar' : 'Ativar'}
        </Button>
      </form>
      <Resultado estado={estadoZona} />

      {semBairro ? (
        <Alert tone="info">
          Essa regiao esta ativa mas sem nenhum bairro. Ninguem vai conseguir escolher a taxa de{' '}
          {moeda(zona.fee)} no checkout ate voce adicionar um bairro abaixo.
        </Alert>
      ) : null}

      {zona.bairros.length > 6 ? (
        <Input
          value={filtroBairro}
          onChange={(e) => setFiltroBairro(e.target.value)}
          placeholder={`Buscar entre ${zona.bairros.length} bairros...`}
          className="max-w-xs"
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {bairrosFiltrados.map((b) => (
          <span
            key={b.id}
            className="flex h-10 items-center gap-1 rounded-full border border-line bg-background pl-3 text-sm font-semibold"
          >
            {b.name}
            <button
              type="button"
              aria-label={`Remover ${b.name}`}
              disabled={transicao}
              onClick={() =>
                startTransition(async () => {
                  const r = await removerBairro(b.id)
                  setErro(r.erro ?? null)
                })
              }
              className="flex size-10 items-center justify-center rounded-full text-lg text-muted hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
            >
              ×
            </button>
          </span>
        ))}
        {zona.bairros.length === 0 ? (
          <span className="text-sm text-muted">Nenhum bairro nesta regiao ainda.</span>
        ) : null}
        {zona.bairros.length > 0 && bairrosFiltrados.length === 0 ? (
          <span className="text-sm text-muted">Nenhum bairro bate com essa busca.</span>
        ) : null}
      </div>

      <form
        action={acaoBairro}
        className="flex gap-2"
        onSubmit={() => setNovoBairro('')}
      >
        <input type="hidden" name="zone_id" value={zona.id} />
        <Input
          name="name"
          placeholder="Adicionar bairro"
          className="flex-1"
          required
          value={novoBairro}
          onChange={(e) => setNovoBairro(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={pendenteBairro}>
          Adicionar
        </Button>
      </form>
      {parecido ? (
        <p className="text-sm text-muted">
          Parecido com <span className="font-semibold text-foreground">{parecido.nome}</span> (regiao{' '}
          {parecido.zona}). Confira se nao e o mesmo bairro antes de adicionar.
        </p>
      ) : null}
      <Resultado estado={estadoBairro} />
      {erro ? <Alert tone="error">{erro}</Alert> : null}
    </div>
  )
}
