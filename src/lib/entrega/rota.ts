import 'server-only'

import { conferirCep } from './faixas'
import { kmDeCarro as viaGoogle } from './provedores/google'
import { kmDeCarro as viaHere } from './provedores/here'
import { kmDeCarro as viaMapbox } from './provedores/mapbox'

/**
 * Quem responde "quantos km de carro daqui ate esse endereco".
 *
 * Uma fila de provedores atras da mesma porta. Cada um so e chamado se o
 * anterior falhou, entao o volume dos seguintes e residual.
 *
 * A fila existe por dois motivos diferentes:
 *
 * 1. Disponibilidade. Antes havia so o Google, e uma chave vencida derrubava
 *    a loja inteira para taxa de bairro ate alguem perceber.
 *
 * 2. Endereco errado com cara de certo. Este e o motivo forte, e so apareceu
 *    em producao: a HERE nao conhece a Rua Camilo Angleria e, em vez de dizer
 *    que nao achou, devolveu a Rua Camilo da Lapa marcada como 'PA' - o selo
 *    de maior confianca dela. Um endereco de 4 km virou cobranca de 14 km.
 *
 * Por isso a conferencia de CEP mora AQUI, e nao la na frente no cotar.ts: um
 * CEP que nao bate e tratado como falha do provedor, passando a vez para o
 * proximo da fila, em vez de derrubar o pedido para a taxa generica de
 * bairro. No caso acima, a Mapbox responde na sequencia com os 4 km certos.
 *
 * A ordem sai de ENTREGA_PROVEDORES (lista separada por virgula).
 */

export type OrigemRota = { lat: number; lng: number } | { endereco: string }

export type MotivoFalha = 'sem-chave' | 'nao-encontrado' | 'sem-rota' | 'erro'

export type Provedor = 'here' | 'mapbox' | 'google'

/**
 * `preciso`: o numero da casa existe na base, ou foi estimado pela numeracao.
 * `cep`: o CEP de onde o provedor pos o ponto. O Google devolve sempre null -
 *   a Routes API nao traz CEP, so status, tipo e partialMatch.
 * `cepConfere`: true (bate com o do cliente), false (nao bate), null (nao deu
 *   para conferir, por falta de um dos dois).
 */
export type ResultadoRota =
  | {
      ok: true
      km: number
      preciso: boolean
      cep: string | null
      provedor: Provedor
      cepConfere: boolean | null
    }
  | { ok: false; motivo: MotivoFalha }

const IMPLEMENTACAO: Record<Provedor, (o: OrigemRota, d: string) => Promise<ResultadoRota>> = {
  here: viaHere,
  mapbox: viaMapbox,
  google: viaGoogle,
}

const PADRAO: Provedor[] = ['here', 'mapbox', 'google']

export function filaDeProvedores(): Provedor[] {
  const bruto = (process.env.ENTREGA_PROVEDORES ?? '')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is Provedor => p === 'here' || p === 'mapbox' || p === 'google')
  if (!bruto.length) return PADRAO
  // Os nao citados entram no fim: configurar um provedor nao deve, sem querer,
  // desligar os outros como reserva.
  return [...bruto, ...PADRAO.filter((p) => !bruto.includes(p))]
}

/** Ha chave para pelo menos um provedor? A tela de configuracoes avisa se nao. */
export function algumProvedorConfigurado(): boolean {
  return Boolean(process.env.HERE_API_KEY || process.env.MAPBOX_TOKEN || process.env.GOOGLE_MAPS_API_KEY)
}

export async function kmDeCarro(
  origem: OrigemRota,
  destino: string,
  cepCliente?: string | null,
): Promise<ResultadoRota> {
  // Desenvolvimento sem chave: ENTREGA_KM_FALSO=3.2 simula a resposta.
  // ENTREGA_IMPRECISO=1 e ENTREGA_CEP_FALSO exercitam a politica de endereco
  // estimado sem gastar cota de verdade.
  const falso = process.env.ENTREGA_KM_FALSO
  if (falso && process.env.NODE_ENV !== 'production') {
    const cep = process.env.ENTREGA_CEP_FALSO ?? null
    return {
      ok: true,
      km: Number(falso),
      preciso: process.env.ENTREGA_IMPRECISO !== '1',
      cep,
      provedor: filaDeProvedores()[0],
      cepConfere: conferirCep(cep, cepCliente),
    }
  }

  let reprovado: ResultadoRota | null = null
  let primeiraFalha: ResultadoRota | null = null

  for (const provedor of filaDeProvedores()) {
    const r = await IMPLEMENTACAO[provedor](origem, destino)

    if (!r.ok) {
      // O motivo que interessa e o do primeiro da fila: "sem chave" no
      // terceiro nao explica nada para quem configurou o primeiro.
      primeiraFalha ??= r
      continue
    }

    const confere = conferirCep(r.cep, cepCliente)
    if (confere !== false) return { ...r, cepConfere: confere }

    // CEP de outro lugar: guarda e tenta o proximo. Se ninguem acertar, este
    // volta com cepConfere=false e o cotar.ts cai na taxa do bairro.
    reprovado ??= { ...r, cepConfere: false }
  }

  return reprovado ?? primeiraFalha ?? { ok: false, motivo: 'erro' }
}
