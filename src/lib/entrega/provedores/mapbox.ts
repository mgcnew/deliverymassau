import 'server-only'

import type { MotivoFalha, OrigemRota, ResultadoRota } from '../rota'

/**
 * Km de carro pela Mapbox: geocodifica e depois roteia, como a HERE.
 *
 * Entrou na cadeia por um caso concreto. A HERE nao conhece a Rua Camilo
 * Angleria (Jardim Bandeirantes) e, em vez de dizer que nao achou, devolveu
 * "Avenida dos Bandeirantes" quando o bairro ia junto, e "Rua Camilo" da Lapa
 * quando nao ia - esta ultima marcada como PA, o selo de maior confianca
 * dela. Um pedido de 4 km virou cobranca de 14. A Mapbox acertou o mesmo
 * endereco, com o CEP 04470-310 batendo com o do ViaCEP.
 *
 * Medido em 8 ruas da regiao, o CEP bate 7/8 na HERE e 6/8 na Mapbox - mas os
 * erros sao de naturezas opostas, e e isso que decide a ordem da cadeia:
 * a Mapbox erra por OMISSAO (interpola e nao devolve CEP, entao a conferencia
 * reprova e cai no bairro), a HERE erra por AFIRMACAO (devolve CEP de outra
 * ponta da cidade com cara de acerto).
 *
 * match_code.address_number:
 *   'matched'   -> o numero existe na base
 *   'plausible' -> estimado pela numeracao do trecho
 *
 * Nao usar `confidence` como criterio: ela cai para 'low' so porque o cliente
 * digitou sem acento, devolvendo a MESMA coordenada correta. Medido.
 */

const PRAZO = 8000

type ItemGeocode = {
  properties?: {
    coordinates?: { latitude: number; longitude: number }
    feature_type?: string
    match_code?: { address_number?: string }
    context?: { postcode?: { name?: string } }
    full_address?: string
  }
  geometry?: { coordinates: [number, number] }
}

type Geocodificado =
  | { ok: true; posicao: { lat: number; lng: number }; preciso: boolean; cep: string | null }
  | { ok: false; motivo: MotivoFalha }

async function geocodificar(
  token: string,
  endereco: string,
  perto?: { lat: number; lng: number },
): Promise<Geocodificado> {
  const u = new URL('https://api.mapbox.com/search/geocode/v6/forward')
  u.searchParams.set('q', endereco)
  u.searchParams.set('country', 'br')
  u.searchParams.set('language', 'pt')
  u.searchParams.set('limit', '1')
  // Desempate por proximidade: "Rua Sao Joao, 100" existe em meia duzia de
  // cidades, e sem isto a Mapbox pode escolher a errada.
  if (perto) u.searchParams.set('proximity', `${perto.lng},${perto.lat}`)
  u.searchParams.set('access_token', token)

  const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(PRAZO) })
  if (!r.ok) return { ok: false, motivo: r.status === 401 || r.status === 403 ? 'sem-chave' : 'erro' }

  const j = (await r.json().catch(() => null)) as { features?: ItemGeocode[] } | null
  const f = j?.features?.[0]
  const p = f?.properties
  const coord = p?.coordinates
  const geo = f?.geometry?.coordinates
  if (!coord && !geo) return { ok: false, motivo: 'nao-encontrado' }

  // Sem nivel de endereco e ponto de rua ou bairro: nao serve para cobrar.
  if (p?.feature_type !== 'address') return { ok: false, motivo: 'nao-encontrado' }

  // O CEP vem em context.postcode; o full_address tambem o traz, e serve de
  // reserva quando o contexto nao vem preenchido.
  const doContexto = p?.context?.postcode?.name ?? null
  const doTexto = (p?.full_address?.match(/\d{5}-\d{3}/) ?? [null])[0]

  return {
    ok: true,
    posicao: coord ? { lat: coord.latitude, lng: coord.longitude } : { lat: geo![1], lng: geo![0] },
    preciso: p?.match_code?.address_number === 'matched',
    cep: doContexto ?? doTexto,
  }
}

export async function kmDeCarro(origem: OrigemRota, destino: string): Promise<ResultadoRota> {
  const token = process.env.MAPBOX_TOKEN
  if (!token) return { ok: false, motivo: 'sem-chave' }

  try {
    let partida: { lat: number; lng: number }
    if ('lat' in origem) {
      partida = { lat: origem.lat, lng: origem.lng }
    } else {
      const g = await geocodificar(token, origem.endereco)
      // Endereco do mercado que nao resolve e erro de configuracao nossa, nao
      // endereco de cliente ruim.
      if (!g.ok) return { ok: false, motivo: g.motivo === 'nao-encontrado' ? 'erro' : g.motivo }
      partida = g.posicao
    }

    const chegada = await geocodificar(token, destino, partida)
    if (!chegada.ok) return { ok: false, motivo: chegada.motivo }

    const u =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${partida.lng},${partida.lat};${chegada.posicao.lng},${chegada.posicao.lat}` +
      `?overview=false&alternatives=false&access_token=${token}`

    const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(PRAZO) })
    if (!r.ok) return { ok: false, motivo: r.status === 401 || r.status === 403 ? 'sem-chave' : 'erro' }

    const j = (await r.json().catch(() => null)) as { routes?: Array<{ distance?: number }> } | null
    const metros = j?.routes?.[0]?.distance
    if (typeof metros !== 'number') return { ok: false, motivo: 'sem-rota' }

    return {
      ok: true,
      km: metros / 1000,
      preciso: chegada.preciso,
      cep: chegada.cep,
      provedor: 'mapbox',
      cepConfere: null, // quem confere e o rota.ts, que conhece o CEP do cliente
    }
  } catch {
    return { ok: false, motivo: 'erro' }
  }
}
