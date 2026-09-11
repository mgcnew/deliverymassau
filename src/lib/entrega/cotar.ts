import 'server-only'

import { createHash } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { faixaPara, rotuloFaixa, type FaixaDistancia } from './faixas'
import { kmDeCarro, type OrigemRota, type ResultadoRota } from './rota-google'

/**
 * Cotacao da entrega por distancia (migration 0041).
 *
 * 1. Mesmo endereco ja cotado ha pouco: reaproveita (sem nova chamada).
 * 2. Dentro dos limites de uso: pergunta os km ao Google e acha a faixa.
 * 3. Google indisponivel, sem chave, limite batido ou endereco impreciso:
 *    reserva pela taxa do bairro, se o bairro estiver cadastrado.
 * 4. Grava a cotacao (so o servidor pode) e devolve o id que vai no pedido -
 *    o banco confere a taxa pela cotacao, nao pelo que o navegador mandar.
 */

export type EnderecoCotacao = { rua: string; numero: string; bairro: string; cep?: string }

export type Cotacao =
  | { modo: 'bairro' }
  | { ok: true; cotacao: string; taxa: number; rotulo: string; km?: number; reserva?: boolean }
  | { fora: true; km?: number; limiteKm?: number }
  | { erro: string }

// Chamadas ao Google: 250 em 24 h cabem folgado nas 10.000 gratis do mes;
// 20 por hora por aparelho barra quem tenta esgotar a cota de proposito.
const LIMITE_24H = Number(process.env.ENTREGA_LIMITE_DIA ?? 250)
const LIMITE_IP_HORA = 20

type ConfigEntrega = {
  delivery_fee_mode: 'bairro' | 'distancia'
  market_address: string | null
  market_city: string | null
  market_lat: number | null
  market_lng: number | null
}

function textoDestino(e: EnderecoCotacao, cidade: string | null) {
  const partes = [`${e.rua.trim()}, ${e.numero.trim()}`, e.bairro.trim()]
  if (cidade) partes.push(cidade.replace('/', ' - '))
  if (e.cep?.replace(/\D/g, '')) partes.push(e.cep)
  partes.push('Brasil')
  return partes.join(', ')
}

function origemDa(config: ConfigEntrega): OrigemRota | null {
  if (config.market_lat !== null && config.market_lng !== null) {
    return { lat: config.market_lat, lng: config.market_lng }
  }
  if (!config.market_address) return null
  const cidade = config.market_city ? `, ${config.market_city.replace('/', ' - ')}` : ''
  return { endereco: `${config.market_address}${cidade}, Brasil` }
}

/**
 * Modo que vale de fato. ENTREGA_MODO_FORCADO=distancia (so em
 * desenvolvimento) testa o checkout por distancia sem ligar o modo no banco
 * - que e compartilhado com a loja em producao.
 */
export function modoEfetivo(modoBanco: string | null | undefined): 'bairro' | 'distancia' {
  if (process.env.NODE_ENV !== 'production' && process.env.ENTREGA_MODO_FORCADO === 'distancia') {
    return 'distancia'
  }
  return modoBanco === 'distancia' ? 'distancia' : 'bairro'
}

export async function lerConfigEntrega() {
  const admin = createAdminClient()
  const [{ data: config }, { data: faixas }] = await Promise.all([
    admin
      .from('settings')
      .select('delivery_fee_mode, market_address, market_city, market_lat, market_lng')
      .eq('id', 1)
      .maybeSingle(),
    admin.from('delivery_distance_bands').select('up_to_km, fee').order('up_to_km'),
  ])
  return {
    config: config as ConfigEntrega | null,
    faixas: (faixas ?? []).map((f) => ({ up_to_km: Number(f.up_to_km), fee: Number(f.fee) })) as FaixaDistancia[],
  }
}

/** So a distancia, sem gravar cotacao: usado pelo "Testar endereco" do painel. */
export async function medirEndereco(endereco: EnderecoCotacao): Promise<ResultadoRota | { ok: false; motivo: 'sem-origem' }> {
  const { config } = await lerConfigEntrega()
  const origem = config ? origemDa(config) : null
  if (!config || !origem) return { ok: false, motivo: 'sem-origem' }
  return kmDeCarro(origem, textoDestino(endereco, config.market_city))
}

export async function cotarEntrega(endereco: EnderecoCotacao, ip: string): Promise<Cotacao> {
  const { config, faixas } = await lerConfigEntrega()
  if (!config || modoEfetivo(config.delivery_fee_mode) !== 'distancia') return { modo: 'bairro' }

  const admin = createAdminClient()
  const e = {
    p_street: endereco.rua,
    p_number: endereco.numero,
    p_district: endereco.bairro,
    p_cep: endereco.cep ?? '',
  }

  // 1. Ja cotado ha pouco (o cliente voltou uma etapa, trocou o pagamento...).
  const { data: vigentes } = await admin.rpc('cotacao_vigente', e)
  const vigente = (vigentes as Array<{ id: string; origem: string; fee: number | null; zone_name: string | null }> | null)?.[0]
  if (vigente) {
    if (vigente.origem === 'fora' || vigente.fee === null) {
      return { fora: true, limiteKm: faixas.at(-1)?.up_to_km }
    }
    return {
      ok: true,
      cotacao: vigente.id,
      taxa: Number(vigente.fee),
      rotulo: vigente.zone_name ?? 'Entrega',
      reserva: vigente.origem === 'bairro',
    }
  }

  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
  const registrar = async (
    origem: 'distancia' | 'bairro' | 'fora' | 'falha',
    taxa: number | null,
    zonaId: string | null,
    rotulo: string | null,
    consultouGoogle: boolean,
  ) => {
    const { data } = await admin.rpc('registrar_cotacao', {
      ...e,
      p_origem: origem,
      p_fee: taxa,
      p_zone_id: zonaId,
      p_zone_name: rotulo,
      p_consultou_google: consultouGoogle,
      p_ip_hash: ipHash,
    })
    return data as string | null
  }

  // 2. Google, se couber nos limites.
  const origem = origemDa(config)
  const { data: uso } = await admin.rpc('uso_google', { p_ip_hash: ipHash })
  const usoAtual = (uso as { dia: number; ip_hora: number } | null) ?? { dia: 0, ip_hora: 0 }
  const podeChamar = origem !== null && usoAtual.dia < LIMITE_24H && usoAtual.ip_hora < LIMITE_IP_HORA

  let chamou = false
  if (podeChamar && faixas.length) {
    const rota = await kmDeCarro(origem, textoDestino(endereco, config.market_city))
    chamou = rota.ok || rota.motivo !== 'sem-chave'

    if (rota.ok) {
      const faixa = faixaPara(rota.km, faixas)
      if (!faixa) {
        await registrar('fora', null, null, null, true)
        return { fora: true, km: rota.km, limiteKm: faixas.at(-1)?.up_to_km }
      }
      const rotulo = rotuloFaixa(faixa.up_to_km)
      const id = await registrar('distancia', faixa.fee, null, rotulo, true)
      if (!id) return { erro: 'Nao foi possivel calcular a entrega agora. Tente de novo.' }
      return { ok: true, cotacao: id, taxa: faixa.fee, rotulo, km: rota.km }
    }
  }

  // 3. Reserva: taxa do bairro, se ele estiver na lista.
  const { data: zonas } = await admin.rpc('resolve_delivery_fee', { p_district: endereco.bairro })
  const zona = (zonas as Array<{ zone_id: string | null; zone_name: string | null; fee: number | null; served: boolean }> | null)?.[0]
  if (zona?.served && zona.fee !== null) {
    const rotulo = `Taxa do bairro ${endereco.bairro.trim()}`
    const id = await registrar('bairro', Number(zona.fee), zona.zone_id, rotulo, chamou)
    if (id) return { ok: true, cotacao: id, taxa: Number(zona.fee), rotulo, reserva: true }
  }

  await registrar('falha', null, null, null, chamou)
  return {
    erro: 'Nao conseguimos calcular a entrega para este endereco. Confira rua e numero, ou chame o mercado no WhatsApp.',
  }
}
