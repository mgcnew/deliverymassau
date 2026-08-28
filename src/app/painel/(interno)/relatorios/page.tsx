import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { diaDeHoje, somarDias } from '@/lib/datas'
import { getFuso } from '@/lib/painel/mercado'
import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/card'
import { FiltroPeriodo } from './filtro-periodo'
import { Bairros, Indicadores, Pagamentos, PorDia, PorHora, Produtos } from './secoes'
import type { Relatorio } from './tipos'

export const metadata = { title: 'Relatorios | Mercado Massa 24h' }

const FORMATO = /^\d{4}-\d{2}-\d{2}$/
/** Mesmo teto do banco (migration 0026): acima disso a RPC recusa. */
const MAX_DIAS = 366

function diaValido(valor: unknown, padrao: string): string {
  return typeof valor === 'string' && FORMATO.test(valor) ? valor : padrao
}

/** Quantidade de dias no intervalo, incluindo os dois extremos. */
function totalDeDias(de: string, ate: string): number {
  const ms = Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)
  return Math.round(ms / 86_400_000) + 1
}

export default async function RelatoriosPage({ searchParams }: PageProps<'/painel/relatorios'>) {
  const [, fuso, params] = await Promise.all([
    requirePermission(PERMISSIONS.relatoriosVer),
    getFuso(),
    searchParams,
  ])

  const hoje = diaDeHoje(fuso)

  // A URL e digitavel e compartilhavel, entao chega qualquer coisa nela. Em
  // vez de mostrar erro, o periodo e corrigido para o mais proximo que faz
  // sentido - so o teto de dias e da RPC, e ele e respeitado aqui antes de
  // virar erro do banco.
  let ate = diaValido(params.ate, hoje)
  let de = diaValido(params.de, somarDias(hoje, -29))

  if (de > ate) [de, ate] = [ate, de]
  if (ate > hoje) ate = hoje
  if (de > ate) de = ate
  if (totalDeDias(de, ate) > MAX_DIAS) de = somarDias(ate, -(MAX_DIAS - 1))

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('relatorio_vendas', { p_inicio: de, p_fim: ate })
  const relatorio = data as Relatorio | null

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Relatorios</h1>
        <FiltroPeriodo de={de} ate={ate} hoje={hoje} />
      </div>

      {error || !relatorio ? (
        <Alert tone="error">
          Nao foi possivel montar o relatorio desse periodo. Tente novamente em instantes.
        </Alert>
      ) : (
        <>
          <Indicadores dados={relatorio} />

          <PorDia dados={relatorio.por_dia} />

          <div className="grid gap-3 lg:grid-cols-2">
            <Produtos dados={relatorio.produtos} />
            <Bairros dados={relatorio.bairros} />
            <Pagamentos dados={relatorio.pagamentos} />
            <PorHora dados={relatorio.horas} />
          </div>
        </>
      )}
    </div>
  )
}
