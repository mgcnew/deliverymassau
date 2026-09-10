/**
 * Textos do horario do delivery: "aberto ate as 22h", "abre amanha as 8h",
 * "Seg a Sex: 8h as 22h". Quem decide se esta aberto e o banco
 * (delivery_estado, migration 0038); aqui so se conta isso para as pessoas,
 * sempre no fuso do mercado - o celular do cliente pode estar em outro.
 */

export type EstadoDelivery = {
  aberto: boolean
  /** 'sempre' = todos os dias 24h; 'manual' = alguem abriu/fechou por cima do horario. */
  motivo: 'sempre' | 'horario' | 'manual'
  /** Ate quando vale o manual. Nulo com motivo 'manual' = ate alguem desfazer. */
  manual_ate: string | null
  /** Quando para de aceitar pedido. Nulo = nao fecha. */
  fecha_em: string | null
  /** Quando volta a aceitar. Nulo = sem previsao. */
  abre_em: string | null
  /** Proxima troca do horario, sem contar o manual. */
  troca_horario: string | null
  fuso: string
}

export type ModoDia = 'horario' | '24h' | 'fechado'

/** Um dia da semana. weekday 0 = domingo, como no banco. Horas em "HH:MM". */
export type DiaHorario = {
  weekday: number
  mode: ModoDia
  opens_at: string | null
  closes_at: string | null
}

export const NOMES_DIAS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado']
const CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

/** Semana comecando na segunda, como se le no Brasil. */
export const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]

/** "08:00" -> "8h", "18:30" -> "18h30". */
export function hora(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/** Data (AAAA-MM-DD), dia da semana e hora de um instante, no fuso do mercado. */
function partes(data: Date, fuso: string) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(data)
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  const semana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(v('weekday'))
  return { dia: `${v('year')}-${v('month')}-${v('day')}`, semana, hhmm: `${v('hour')}:${v('minute')}` }
}

/**
 * "hoje as 22h", "amanha as 8h", "sexta as 8h30" ou "12/09 as 8h".
 * O "agora" padrao e o do relogio; so os testes precisam passar outro.
 */
export function quando(iso: string, fuso: string, agora: Date = new Date()) {
  const alvo = partes(new Date(iso), fuso)
  const hoje = partes(agora, fuso)
  const dias = Math.round(
    (Date.parse(`${alvo.dia}T00:00:00Z`) - Date.parse(`${hoje.dia}T00:00:00Z`)) / 86_400_000,
  )
  const as = `as ${hora(alvo.hhmm)}`
  if (dias <= 0) return `hoje ${as}`
  if (dias === 1) return `amanha ${as}`
  if (dias < 7) return `${NOMES_DIAS[alvo.semana].toLowerCase()} ${as}`
  const [, mes, dia] = alvo.dia.split('-')
  return `${dia}/${mes} ${as}`
}

/** Linha curta para o cabecalho da loja. */
export function resumoLoja(estado: EstadoDelivery) {
  if (estado.aberto) {
    if (!estado.fecha_em) return 'Delivery aberto 24 horas'
    return `Aberto ate ${quando(estado.fecha_em, estado.fuso).replace(/^hoje /, '')}`
  }
  return estado.abre_em ? `Fechado agora - abre ${quando(estado.abre_em, estado.fuso)}` : 'Fechado agora'
}

function descreverDia(d: DiaHorario) {
  if (d.mode === '24h') return '24 horas'
  if (d.mode === 'fechado' || !d.opens_at || !d.closes_at) return 'fechado'
  return `${hora(d.opens_at)} as ${hora(d.closes_at)}`
}

/**
 * Semana agrupada para o rodape da loja: dias seguidos com o mesmo horario
 * viram uma linha ("Seg a Sex: 8h as 22h"). Vazio quando e tudo 24h - ai o
 * cabecalho ja diz "aberto 24 horas".
 */
export function semanaAgrupada(dias: DiaHorario[]) {
  const porDia = new Map(dias.map((d) => [d.weekday, d]))
  const ordenados = ORDEM_DIAS.map((w) => porDia.get(w)).filter((d): d is DiaHorario => !!d)
  if (ordenados.every((d) => d.mode === '24h')) return []

  const linhas: Array<{ dias: string; horario: string }> = []
  let inicio = 0
  for (let i = 1; i <= ordenados.length; i++) {
    const mudou = i === ordenados.length || descreverDia(ordenados[i]) !== descreverDia(ordenados[inicio])
    if (!mudou) continue
    const primeiro = CURTOS[ordenados[inicio].weekday]
    const ultimo = CURTOS[ordenados[i - 1].weekday]
    linhas.push({
      dias: i - 1 === inicio ? primeiro : `${primeiro} a ${ultimo}`,
      horario: descreverDia(ordenados[inicio]),
    })
    inicio = i
  }
  return linhas
}
