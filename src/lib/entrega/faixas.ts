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

/**
 * Quando o numero da casa nao existe na base, o provedor estima a posicao
 * distribuindo a numeracao ao longo do trecho. Medido na regiao do mercado,
 * esse erro vai de ~50 m numa rua curta a ~670 m numa avenida longa.
 *
 * Aceitar a estimativa e melhor que recusar: a maioria das entregas e em rua
 * curta de comunidade, onde dezenas de metros nunca mudam a faixa de 1 km.
 * Mas so aceitamos com conferencia - se o CEP de onde o provedor pos o ponto
 * for diferente do que o cliente digitou, ele errou o trecho da rua, e ai
 * vale a taxa do bairro.
 *
 * A conferencia aperta sozinha onde o risco e maior: avenida longa tem
 * varios CEPs, entao errar de trecho e pego; rua curta tem CEP unico, e a
 * estimativa fica dentro dele.
 */
export const MARGEM_BORDA_KM = 0.15

export function soDigitos(cep: string | null | undefined) {
  return (cep ?? '').replace(/\D/g, '')
}

export type Decisao =
  | { tipo: 'faixa'; faixa: FaixaDistancia }
  | { tipo: 'fora' }
  | { tipo: 'sem-confirmacao' }

/**
 * Km + precisao -> faixa cobrada.
 *
 * Endereco estimado e perto da borda de cima da faixa sobe uma faixa: ali a
 * incerteza da estimativa e maior que a distancia que falta para o degrau
 * seguinte. Decisao do contratante, ciente de que o erro da estimativa e
 * simetrico e de que isso cobra a mais em parte dos casos. Na ultima faixa
 * nao sobe: subir jogaria o cliente para fora da area, recusando uma venda
 * por causa de uma estimativa.
 */
export function decidirFaixa(
  km: number,
  preciso: boolean,
  cepProvedor: string | null,
  cepCliente: string | null | undefined,
  faixas: FaixaDistancia[],
): Decisao {
  const faixa = faixaPara(km, faixas)
  if (!faixa) return { tipo: 'fora' }
  if (preciso) return { tipo: 'faixa', faixa }

  const doCliente = soDigitos(cepCliente)
  const doProvedor = soDigitos(cepProvedor)
  // Sem os dois CEPs nao ha o que conferir, e sem conferir nao aceitamos
  // estimativa. E por isso que o caminho do Google, que nunca devolve CEP,
  // segue caindo na taxa do bairro como antes desta mudanca.
  if (!doCliente || !doProvedor || doCliente !== doProvedor) return { tipo: 'sem-confirmacao' }

  const ordenadas = [...faixas].sort((a, b) => a.up_to_km - b.up_to_km)
  const proxima = ordenadas[ordenadas.findIndex((f) => f.up_to_km === faixa.up_to_km) + 1]
  const naBorda = faixa.up_to_km - km <= MARGEM_BORDA_KM
  return { tipo: 'faixa', faixa: naBorda && proxima ? proxima : faixa }
}
