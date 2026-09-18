import 'server-only'

import type { MotivoFalha, OrigemRota, ResultadoRota } from '../rota'

/**
 * Km de carro pela HERE: duas chamadas, ao contrario do Google.
 *
 *   1. Geocoding & Search -> endereco vira coordenada
 *   2. Routing v8         -> coordenada vira distancia
 *
 * O Google faz numa so porque a Routes aceita o destino em texto. Aqui o
 * par de chamadas fica escondido atras da mesma assinatura, entao quem
 * chama nao muda.
 *
 * O que a HERE da e o Google nao: o CEP de onde ela colocou o ponto. E esse
 * campo que permite conferir, contra o CEP que o cliente digitou, se ela
 * acertou o trecho da rua - a trava que torna aceitavel usar endereco com
 * numero estimado.
 *
 * houseNumberType:
 *   'PA'           -> ponto de endereco cadastrado, o numero existe mesmo
 *   'interpolated' -> estimado pela numeracao do trecho
 *
 * Medido em 9 ruas da regiao do mercado: 6 exatas, 3 interpoladas, e o CEP
 * devolvido bateu com o do ViaCEP em 8 de 9.
 */

const PRAZO = 8000

type ItemGeocode = {
  position?: { lat: number; lng: number }
  resultType?: string
  houseNumberType?: string
  address?: { postalCode?: string }
}

type Geocodificado =
  | { ok: true; item: ItemGeocode; posicao: { lat: number; lng: number } }
  | { ok: false; motivo: MotivoFalha }

async function geocodificar(
  chave: string,
  endereco: string,
  perto?: { lat: number; lng: number },
): Promise<Geocodificado> {
  const u = new URL('https://geocode.search.hereapi.com/v1/geocode')
  u.searchParams.set('q', endereco)
  u.searchParams.set('in', 'countryCode:BRA')
  u.searchParams.set('lang', 'pt-BR')
  u.searchParams.set('limit', '1')
  // Desempate por proximidade do mercado: "Rua Sao Joao, 100" existe em meia
  // duzia de cidades, e sem isso a HERE pode escolher a errada.
  if (perto) u.searchParams.set('at', `${perto.lat},${perto.lng}`)
  u.searchParams.set('apiKey', chave)

  const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(PRAZO) })
  if (!r.ok) return { ok: false, motivo: r.status === 401 || r.status === 403 ? 'sem-chave' : 'erro' }
  const j = (await r.json().catch(() => null)) as { items?: ItemGeocode[] } | null
  const item = j?.items?.[0]
  if (!item?.position) return { ok: false, motivo: 'nao-encontrado' }
  return { ok: true, item, posicao: item.position }
}

export async function kmDeCarro(origem: OrigemRota, destino: string): Promise<ResultadoRota> {
  const chave = process.env.HERE_API_KEY
  if (!chave) return { ok: false, motivo: 'sem-chave' }

  try {
    // A origem tambem pode ser texto (endereco do mercado, quando nao ha
    // coordenada salva): entao ela precisa virar ponto antes da rota.
    let partida: { lat: number; lng: number }
    if ('lat' in origem) {
      partida = { lat: origem.lat, lng: origem.lng }
    } else {
      const g = await geocodificar(chave, origem.endereco)
      // Endereco do mercado que nao resolve e erro de configuracao, nao um
      // endereco de cliente ruim: nao adianta dizer "nao encontrado".
      if (!g.ok) return { ok: false, motivo: g.motivo === 'nao-encontrado' ? 'erro' : g.motivo }
      partida = g.posicao
    }

    const chegada = await geocodificar(chave, destino, partida)
    if (!chegada.ok) return { ok: false, motivo: chegada.motivo }

    const item = chegada.item
    const posicao = chegada.posicao
    // Sem 'houseNumber' no resultType, nem a rua com numero foi resolvida:
    // e um ponto de bairro ou cidade, que nao serve para cobrar distancia.
    if (item.resultType !== 'houseNumber') return { ok: false, motivo: 'nao-encontrado' }

    const u = new URL('https://router.hereapi.com/v8/routes')
    u.searchParams.set('transportMode', 'car')
    u.searchParams.set('origin', `${partida.lat},${partida.lng}`)
    u.searchParams.set('destination', `${posicao.lat},${posicao.lng}`)
    u.searchParams.set('return', 'summary')
    u.searchParams.set('apiKey', chave)

    const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(PRAZO) })
    if (!r.ok) return { ok: false, motivo: r.status === 401 || r.status === 403 ? 'sem-chave' : 'erro' }

    const j = (await r.json().catch(() => null)) as {
      routes?: Array<{ sections?: Array<{ summary?: { length?: number } }> }>
    } | null
    const metros = j?.routes?.[0]?.sections?.[0]?.summary?.length
    if (typeof metros !== 'number') return { ok: false, motivo: 'sem-rota' }

    return {
      ok: true,
      km: metros / 1000,
      preciso: item.houseNumberType === 'PA',
      cep: item.address?.postalCode ?? null,
      provedor: 'here',
    }
  } catch {
    // Prazo estourado ou rede fora: o chamador tenta o outro provedor.
    return { ok: false, motivo: 'erro' }
  }
}
