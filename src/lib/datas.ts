/**
 * Dias no fuso do mercado, nao no do servidor.
 *
 * Num delivery 24h isso nao e detalhe: a Vercel roda em UTC, entao um
 * pedido feito 21h de Sao Paulo ja e "amanha" para o servidor. Filtrar por
 * data usando o relogio do servidor jogaria o pedido no dia errado -- o
 * mesmo motivo pelo qual o dashboard_hoje() calcula o inicio do dia com o
 * settings.timezone la no banco.
 */

/** Quanto o fuso esta deslocado do UTC naquele instante (ms). */
function deslocamentoMs(instante: Date, fuso: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instante)

  const n = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0)
  const comoUtc = Date.UTC(
    n('year'),
    n('month') - 1,
    n('day'),
    n('hour') % 24,
    n('minute'),
    n('second'),
  )

  return comoUtc - instante.getTime()
}

/** Data de hoje no fuso do mercado, no formato AAAA-MM-DD. */
export function diaDeHoje(fuso: string): string {
  // en-CA formata como AAAA-MM-DD, que e exatamente o formato do <input type="date">.
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(new Date())
}

/** AAAA-MM-DD somado de n dias (aceita negativo). */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Instante UTC da meia-noite daquele dia no fuso do mercado.
 * Duas passadas porque o deslocamento a ser aplicado depende do instante
 * que estamos justamente tentando descobrir (importa em fuso com horario
 * de verao; o Brasil nao tem mais, mas o fuso e configuravel).
 */
export function inicioDoDia(dia: string, fuso: string): Date {
  const palpite = new Date(`${dia}T00:00:00Z`)
  const primeira = new Date(palpite.getTime() - deslocamentoMs(palpite, fuso))
  return new Date(palpite.getTime() - deslocamentoMs(primeira, fuso))
}

/** Intervalo [de, ate) que cobre o dia inteiro no fuso do mercado. */
export function intervaloDoDia(dia: string, fuso: string): { de: string; ate: string } {
  return {
    de: inicioDoDia(dia, fuso).toISOString(),
    ate: inicioDoDia(somarDias(dia, 1), fuso).toISOString(),
  }
}

/** AAAA-MM-DD -> "21/08" ou "21/08/2026" quando for de outro ano. */
export function rotuloDoDia(dia: string, fuso: string): string {
  const hoje = diaDeHoje(fuso)
  if (dia === hoje) return 'hoje'
  if (dia === somarDias(hoje, -1)) return 'ontem'

  const [ano, mes, d] = dia.split('-')
  return ano === hoje.slice(0, 4) ? `${d}/${mes}` : `${d}/${mes}/${ano}`
}

/** Aceita so AAAA-MM-DD vindo da URL; qualquer outra coisa vira hoje. */
export function diaValido(valor: unknown, fuso: string): string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? valor
    : diaDeHoje(fuso)
}
