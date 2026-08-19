import Link from 'next/link'

import { Card } from '@/components/ui/card'
import { moeda } from '@/lib/format'

export type Indicadores = {
  fuso: string
  pedidos_hoje: number
  entregues_hoje: number
  cancelados_hoje: number
  faturamento_hoje: number
  ticket_medio: number
  em_aberto: number
  novos: number
  em_separacao: number
  aguardando_entregador: number
  saiu_para_entrega: number
}

function Numero({
  titulo,
  valor,
  destaque,
  href,
}: {
  titulo: string
  valor: string
  destaque?: boolean
  href?: string
}) {
  const conteudo = (
    <Card className={`h-full ${destaque ? 'border-brand' : ''}`}>
      <p className="text-sm font-semibold text-muted">{titulo}</p>
      <p className={`text-3xl font-black ${destaque ? 'text-brand' : ''}`}>{valor}</p>
    </Card>
  )

  return href ? <Link href={href}>{conteudo}</Link> : conteudo
}

export function PainelIndicadores({ dados }: { dados: Indicadores }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero titulo="Pedidos hoje" valor={String(dados.pedidos_hoje)} />
        <Numero titulo="Faturamento hoje" valor={moeda(Number(dados.faturamento_hoje))} />
        <Numero titulo="Ticket medio" valor={moeda(Number(dados.ticket_medio))} />
        <Numero titulo="Entregues hoje" valor={String(dados.entregues_hoje)} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero
          titulo="Novos esperando"
          valor={String(dados.novos)}
          destaque={dados.novos > 0}
          href="/painel/pedidos"
        />
        <Numero titulo="Em separacao" valor={String(dados.em_separacao)} href="/painel/pedidos" />
        <Numero
          titulo="Aguardando entregador"
          valor={String(dados.aguardando_entregador)}
          destaque={dados.aguardando_entregador > 0}
          href="/painel/entregas"
        />
        <Numero titulo="Cancelados hoje" valor={String(dados.cancelados_hoje)} />
      </div>

      <p className="text-sm text-muted">
        &quot;Hoje&quot; conta a partir da meia-noite no fuso {dados.fuso}. Faturamento e ticket
        medio consideram apenas pedidos entregues.
      </p>
    </div>
  )
}
