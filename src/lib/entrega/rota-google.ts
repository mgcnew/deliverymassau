import 'server-only'

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
 *   numero) vira 'impreciso': taxa calculada para o lugar errado seria pior
 *   que cair na taxa do bairro.
 *
 * A chave (GOOGLE_MAPS_API_KEY) so existe no servidor. Pelos termos do Google,
 * o resultado nao pode ser guardado para reaproveitar - quem chama usa os km
 * na hora e guarda so a taxa.
 */

export type OrigemRota = { lat: number; lng: number } | { endereco: string }

export type ResultadoRota =
  | { ok: true; km: number }
  | { ok: false; motivo: 'sem-chave' | 'nao-encontrado' | 'impreciso' | 'sem-rota' | 'erro' }

type WaypointGeocodificado = { geocoderStatus?: { code?: number }; type?: string[]; partialMatch?: boolean }

// Tipos que apontam para o lote/imovel, nao so para a rua ou o bairro.
const TIPOS_PRECISOS = ['street_address', 'premise', 'subpremise', 'establishment', 'point_of_interest']

export async function kmDeCarro(origem: OrigemRota, destino: string): Promise<ResultadoRota> {
  // Desenvolvimento sem chave: ENTREGA_KM_FALSO=3.2 no .env.local simula a
  // resposta para testar o checkout. Nunca vale em producao.
  const falso = process.env.ENTREGA_KM_FALSO
  if (falso && process.env.NODE_ENV !== 'production') return { ok: true, km: Number(falso) }

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
  if (geo) {
    if (geo.geocoderStatus?.code && geo.geocoderStatus.code !== 0) return { ok: false, motivo: 'nao-encontrado' }
    if (geo.partialMatch || !geo.type?.some((t) => TIPOS_PRECISOS.includes(t))) {
      return { ok: false, motivo: 'impreciso' }
    }
  }

  const metros = dados?.routes?.[0]?.distanceMeters
  if (typeof metros !== 'number') return { ok: false, motivo: 'sem-rota' }

  return { ok: true, km: metros / 1000 }
}
