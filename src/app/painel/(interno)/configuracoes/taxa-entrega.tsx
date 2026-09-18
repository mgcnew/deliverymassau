'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Alert, Card, CardTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { kmTexto, rotuloFaixa } from '@/lib/entrega/faixas'
import { moeda } from '@/lib/format'
import {
  salvarFaixas,
  salvarModoTaxa,
  salvarOrigem,
  testarEndereco,
  type ConfigState,
  type FaixaEntrada,
  type TesteEndereco,
} from './actions'

/**
 * Taxa de entrega por distancia (km pela rota de carro do Google) ou por
 * bairro. A lista de bairros continua valendo como reserva quando o Google
 * nao consegue calcular (sem chave, fora do ar, endereco impreciso).
 */

export type ConfigTaxa = {
  modo: 'bairro' | 'distancia'
  faixas: Array<{ up_to_km: number; fee: number }>
  mercadoEndereco: string | null
  mercadoCidade: string | null
  lat: number | null
  lng: number | null
  mapaConfigurado: boolean
}

function Resultado({ estado }: { estado: ConfigState }) {
  if (estado.erro) return <Alert tone="error">{estado.erro}</Alert>
  if (estado.ok) return <Alert tone="success">{estado.ok}</Alert>
  return null
}

const escrever = (n: number) => String(n).replace('.', ',')

export function TaxaEntrega({ config }: { config: ConfigTaxa }) {
  return (
    <>
      <ModoTaxa config={config} />
      <FaixasDistancia faixas={config.faixas} />
      <PontoDeSaida config={config} />
      <TestarEndereco />
    </>
  )
}

function ModoTaxa({ config }: { config: ConfigTaxa }) {
  const [pendente, startTransition] = useTransition()
  const [estado, setEstado] = useState<ConfigState>({})
  const semFaixas = config.faixas.length === 0

  function escolher(modo: 'bairro' | 'distancia') {
    if (modo === config.modo) return
    startTransition(async () => setEstado(await salvarModoTaxa(modo)))
  }

  const opcao = (modo: 'bairro' | 'distancia', titulo: string, texto: string, desabilitado = false) => (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
        config.modo === modo ? 'border-brand bg-brand/5' : 'border-line'
      } ${desabilitado ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <input
        type="radio"
        name="modo-taxa"
        checked={config.modo === modo}
        disabled={pendente || desabilitado}
        onChange={() => escolher(modo)}
        className="mt-1 size-5 accent-[var(--brand)]"
      />
      <span>
        <span className="block font-bold">{titulo}</span>
        <span className="block text-sm text-muted">{texto}</span>
      </span>
    </label>
  )

  return (
    <Card>
      <CardTitle>Como cobrar a entrega</CardTitle>
      <div className="space-y-2">
        {opcao('bairro', 'Por bairro', 'Cada bairro tem sua taxa (lista abaixo).')}
        {opcao(
          'distancia',
          'Por distancia',
          semFaixas
            ? 'Cadastre as faixas de km abaixo para poder ativar.'
            : 'O cliente informa o endereco e a taxa sai pela distancia de carro ate o mercado.',
          semFaixas && config.modo !== 'distancia',
        )}
      </div>
      {config.modo === 'distancia' && !config.mapaConfigurado ? (
        <Alert tone="error">
          A chave do Google ainda nao esta configurada no servidor. Enquanto isso, o checkout usa a
          taxa do bairro (quando o bairro esta na lista) ou pede para o cliente chamar no WhatsApp.
        </Alert>
      ) : null}
      <div className="mt-3">
        <Resultado estado={estado} />
      </div>
    </Card>
  )
}

function FaixasDistancia({ faixas }: { faixas: ConfigTaxa['faixas'] }) {
  const [linhas, setLinhas] = useState<FaixaEntrada[]>(() =>
    faixas.length
      ? faixas.map((f) => ({ up_to_km: escrever(f.up_to_km), fee: escrever(f.fee) }))
      : [
          { up_to_km: '2', fee: '' },
          { up_to_km: '4', fee: '' },
          { up_to_km: '6', fee: '' },
        ],
  )
  const [pendente, startTransition] = useTransition()
  const [estado, setEstado] = useState<ConfigState>({})

  function mudar(i: number, campo: keyof FaixaEntrada, valor: string) {
    setEstado({})
    setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)))
  }

  function salvar() {
    startTransition(async () => setEstado(await salvarFaixas(linhas)))
  }

  return (
    <Card>
      <CardTitle>Faixas de distancia</CardTitle>
      <p className="-mt-1 mb-3 text-sm text-muted">
        Distancia pela rota de carro, do mercado ate o endereco. Depois da ultima faixa, o endereco
        fica fora da area de entrega.
      </p>

      <ul className="space-y-2">
        {linhas.map((l, i) => (
          <li key={i} className="flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-semibold text-muted">Ate (km)</span>
              <Input
                value={l.up_to_km}
                onChange={(e) => mudar(i, 'up_to_km', e.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 2"
              />
            </label>
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-semibold text-muted">Taxa (R$)</span>
              <Input
                value={l.fee}
                onChange={(e) => mudar(i, 'fee', e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </label>
            <button
              type="button"
              onClick={() => setLinhas((atual) => atual.filter((_, j) => j !== i))}
              aria-label={`Remover faixa ${i + 1}`}
              className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:bg-foreground/5"
            >
              <Trash2 size={18} aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setLinhas((atual) => [...atual, { up_to_km: '', fee: '' }])}
        >
          <Plus size={18} aria-hidden />
          Faixa
        </Button>
        <Button type="button" onClick={salvar} disabled={pendente}>
          {pendente ? 'Salvando...' : 'Salvar faixas'}
        </Button>
      </div>
      <div className="mt-3">
        <Resultado estado={estado} />
      </div>
    </Card>
  )
}

function PontoDeSaida({ config }: { config: ConfigTaxa }) {
  const [lat, setLat] = useState(config.lat === null ? '' : escrever(config.lat))
  const [lng, setLng] = useState(config.lng === null ? '' : escrever(config.lng))
  const [pendente, startTransition] = useTransition()
  const [estado, setEstado] = useState<ConfigState>({})

  return (
    <Card>
      <CardTitle>Ponto de saida</CardTitle>
      <p className="-mt-1 mb-3 text-sm text-muted">
        Sem coordenadas, a rota sai do endereco do mercado:{' '}
        <strong className="text-foreground">
          {config.mercadoEndereco
            ? `${config.mercadoEndereco}${config.mercadoCidade ? `, ${config.mercadoCidade}` : ''}`
            : 'nao preenchido (aba Mercado)'}
        </strong>
        . Para mais precisao, cole as coordenadas da porta: no Google Maps, toque e segure no lugar
        e copie os dois numeros que aparecem.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Latitude">
          <Input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="-23,6721" />
        </Field>
        <Field label="Longitude">
          <Input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" placeholder="-46,7421" />
        </Field>
      </div>
      <div className="mt-3 space-y-3">
        <Resultado estado={estado} />
        <Button
          type="button"
          disabled={pendente}
          onClick={() => startTransition(async () => setEstado(await salvarOrigem(lat, lng)))}
        >
          {pendente ? 'Salvando...' : 'Salvar ponto de saida'}
        </Button>
      </div>
    </Card>
  )
}

function TestarEndereco() {
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [cepTeste, setCepTeste] = useState('')
  const [pendente, startTransition] = useTransition()
  const [teste, setTeste] = useState<TesteEndereco | null>(null)

  return (
    <Card>
      <CardTitle>Testar um endereco</CardTitle>
      <p className="-mt-1 mb-3 text-sm text-muted">
        Confira a distancia e a faixa antes de ativar. Cada teste consome uma
        consulta da cota gratis do provedor de mapas.
      </p>
      {/* O CEP fica aqui porque o checkout tambem o exige: e ele que confere
          se o provedor acertou o trecho da rua. Sem ele, este teste mostraria
          um numero que o cliente nunca veria. */}
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem_1fr_9rem]">
        <Field label="Rua">
          <Input value={rua} onChange={(e) => setRua(e.target.value)} />
        </Field>
        <Field label="Numero">
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
        </Field>
        <Field label="Bairro">
          <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
        </Field>
        <Field label="CEP">
          <Input
            value={cepTeste}
            onChange={(e) => setCepTeste(e.target.value)}
            inputMode="numeric"
            placeholder="00000-000"
            maxLength={9}
          />
        </Field>
      </div>
      <div className="mt-3 space-y-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pendente}
          onClick={() => startTransition(async () => setTeste(await testarEndereco(rua, numero, bairro, cepTeste)))}
        >
          {pendente ? 'Calculando...' : 'Calcular'}
        </Button>
        {teste?.erro ? <Alert tone="error">{teste.erro}</Alert> : null}
        {teste?.km !== undefined ? (
          <Alert tone={teste.faixa ? 'success' : 'error'}>
            {kmTexto(teste.km)} km de carro -{' '}
            {teste.faixa
              ? `${rotuloFaixa(teste.faixa.up_to_km)}: ${moeda(teste.faixa.fee)}`
              : 'fora da area de entrega'}
            {/*
              O cliente nao ve nada disso; aqui a equipe precisa saber se o
              numero foi achado ou estimado, porque e o que explica uma taxa
              diferente da esperada em uma reclamacao de balcao.
            */}
            {teste.preciso === false ? (
              <span className="mt-1 block text-sm font-normal">
                Numero estimado pela numeracao da rua
                {teste.cep ? ` (CEP ${teste.cep})` : ', e o provedor nao devolveu CEP para conferir'}
                {teste.cep
                  ? '. No checkout, so vale se bater com o CEP do cliente; perto da borda, sobe uma faixa.'
                  : '. No checkout, cairia na taxa do bairro.'}
              </span>
            ) : null}
          </Alert>
        ) : null}
      </div>
    </Card>
  )
}
