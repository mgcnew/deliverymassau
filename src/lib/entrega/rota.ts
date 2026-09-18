import 'server-only'

import { kmDeCarro as viaGoogle } from './provedores/google'
import { kmDeCarro as viaHere } from './provedores/here'

/**
 * Quem responde "quantos km de carro daqui ate esse endereco".
 *
 * Dois provedores atras da mesma porta, com um sendo a reserva do outro.
 * Antes havia so o Google, e uma chave vencida ou uma instabilidade dele
 * derrubava a loja inteira para taxa de bairro ate alguem perceber.
 *
 * O principal sai de ENTREGA_PROVEDOR (padrao: here). Qualquer falha do
 * principal tenta o segundo - inclusive "nao encontrei o endereco", que e
 * justamente onde o outro pode acertar. O segundo so e chamado quando o
 * primeiro falha, entao o volume dele e residual.
 */

export type OrigemRota = { lat: number; lng: number } | { endereco: string }

export type MotivoFalha = 'sem-chave' | 'nao-encontrado' | 'sem-rota' | 'erro'

/**
 * `preciso` diz se o numero da casa foi achado de verdade ou estimado pela
 * numeracao da rua. `cep` e o CEP de onde o provedor colocou o ponto - e o
 * que permite conferir, contra o CEP que o cliente digitou, se ele acertou
 * o trecho da rua. O Google nao devolve CEP pela Routes API (so status,
 * tipo e partialMatch), entao ali vem null e a conferencia nao acontece.
 */
export type ResultadoRota =
  | { ok: true; km: number; preciso: boolean; cep: string | null; provedor: Provedor }
  | { ok: false; motivo: MotivoFalha }

export type Provedor = 'here' | 'google'

const IMPLEMENTACAO: Record<Provedor, (o: OrigemRota, d: string) => Promise<ResultadoRota>> = {
  here: viaHere,
  google: viaGoogle,
}

export function provedorPrincipal(): Provedor {
  return process.env.ENTREGA_PROVEDOR === 'google' ? 'google' : 'here'
}

/** Ha chave para pelo menos um provedor? A tela de configuracoes avisa se nao. */
export function algumProvedorConfigurado(): boolean {
  return Boolean(process.env.HERE_API_KEY || process.env.GOOGLE_MAPS_API_KEY)
}

export async function kmDeCarro(origem: OrigemRota, destino: string): Promise<ResultadoRota> {
  // Desenvolvimento sem chave: ENTREGA_KM_FALSO=3.2 simula a resposta para
  // testar o checkout. ENTREGA_CEP_FALSO e ENTREGA_IMPRECISO=1 servem para
  // exercitar a politica de endereco estimado sem gastar cota de verdade.
  const falso = process.env.ENTREGA_KM_FALSO
  if (falso && process.env.NODE_ENV !== 'production') {
    return {
      ok: true,
      km: Number(falso),
      preciso: process.env.ENTREGA_IMPRECISO !== '1',
      cep: process.env.ENTREGA_CEP_FALSO ?? null,
      provedor: provedorPrincipal(),
    }
  }

  const principal = provedorPrincipal()
  const segundo: Provedor = principal === 'here' ? 'google' : 'here'

  const primeira = await IMPLEMENTACAO[principal](origem, destino)
  if (primeira.ok) return primeira

  const reserva = await IMPLEMENTACAO[segundo](origem, destino)
  // Se o segundo tambem falhou, o motivo que interessa e o do principal:
  // "sem chave no segundo" nao explica nada para quem configurou o primeiro.
  return reserva.ok ? reserva : primeira
}
