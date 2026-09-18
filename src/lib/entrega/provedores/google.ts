import 'server-only'

import type { OrigemRota, ResultadoRota } from '../rota'

/**
 * Km de carro entre o mercado e o endereco do cliente, pela Routes API do
 * Google (computeRoutes).
 *
 * - O destino vai como TEXTO (waypoint.address): a propria Routes acha o
 *   lugar, entao e uma chamada so, sem Geocoding a parte.
 * - Rota sem transito (TRAFFIC_UNAWARE) e de carro: fica no SKU Essentials,
 *   o de 10.000 chamadas gratis por mes. Transito em tempo real ou rota de
 *   moto mudariam para Pro/Enterprise.
 * - Endereco achado so "mais ou menos" (partialMatch, ou so a rua sem o
 *   numero) volta com preciso:false. Quem decide o que fazer com isso e o
 *   cotar.ts, nao este modulo.
 * - `cep` sai sempre null: a Routes devolve, sobre o endereco, apenas
 *   status, tipo e partialMatch - nao ha CEP nem endereco formatado. Obter
 *   o CEP exigiria uma segunda chamada, a Geocoding API, que e outro SKU.
 *   Sem CEP nao ha como conferir o trecho da rua, e por isso o caminho do
 *   Google recusa endereco estimado em vez de aceita-lo.
 *
 * A chave (GOOGLE_MAPS_API_KEY) so existe no servidor. Pelos termos do Google,
 * o resultado nao pode ser guardado para reaproveitar - quem chama usa os km
 * na hora e guarda so a taxa.
 */

type WaypointGeocodificado = { geocoderStatus?: { code?: number }; type?: string[]; partialMatch?: boolean }

// Tipos que apontam para o lote/imovel, nao so para a rua ou o bairro.
const TIPOS_PRECISOS = ['street_address', 'premise', 'subpremise', 'establishment', 'point_of_interest']

export async function kmDeCarro(origem: OrigemRota, destino: string): Promise<ResultadoRota> {
  const chave = process.env.GOOGLE_MAPS_API_KEY
  if (!chave) return { ok: false, motivo: 'sem-chave' }

  let resposta: Response
  try {
    resposta = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': chave,
        // So o necessario: pedir mais campos pode mudar o SKU cobrado.
        'X-Goog-FieldMask': 'routes.distanceMeters,geocodingResults',
      },
      body: JSON.stringify({
        origin:
          'endereco' in origem
            ? { address: origem.endereco }
            : { location: { latLng: { latitude: origem.lat, longitude: origem.lng } } },
        destination: { address: destino },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        languageCode: 'pt-BR',
        regionCode: 'br',
        units: 'METRIC',
      }),
      cache: 'no-store',
      // Checkout nao pode ficar pendurado: sem resposta em 8 s, cai no bairro.
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return { ok: false, motivo: 'erro' }
  }

  if (!resposta.ok) {
    // 400 com endereco que o Google nao entende; 403/429 e chave ou cota.
    return { ok: false, motivo: resposta.status === 400 ? 'nao-encontrado' : 'erro' }
  }

  const dados = (await resposta.json().catch(() => null)) as {
    routes?: Array<{ distanceMeters?: number }>
    geocodingResults?: { origin?: WaypointGeocodificado; destination?: WaypointGeocodificado }
  } | null

  const geo = dados?.geocodingResults?.destination
  if (geo?.geocoderStatus?.code && geo.geocoderStatus.code !== 0) {
    return { ok: false, motivo: 'nao-encontrado' }
  }
  const preciso = !geo || (!geo.partialMatch && !!geo.type?.some((t) => TIPOS_PRECISOS.includes(t)))

  const metros = dados?.routes?.[0]?.distanceMeters
  if (typeof metros !== 'number') return { ok: false, motivo: 'sem-rota' }

  return { ok: true, km: metros / 1000, preciso, cep: null, provedor: 'google' }
}
