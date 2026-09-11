/**
 * Faixas da taxa por distancia: "ate 2 km -> R$ 5", "ate 4 km -> R$ 7"...
 * Alem da ultima faixa, fora da area de entrega.
 */

export type FaixaDistancia = { up_to_km: number; fee: number }

/** 3.24 -> "3,2" (uma casa; inteiro sai sem casa: 4 -> "4"). */
export function kmTexto(km: number) {
  return km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function rotuloFaixa(ateKm: number) {
  return `Ate ${kmTexto(ateKm)} km`
}

/** A primeira faixa que cobre a distancia, ou null (fora da area). */
export function faixaPara(km: number, faixas: FaixaDistancia[]): FaixaDistancia | null {
  return [...faixas].sort((a, b) => a.up_to_km - b.up_to_km).find((f) => km <= f.up_to_km) ?? null
}
