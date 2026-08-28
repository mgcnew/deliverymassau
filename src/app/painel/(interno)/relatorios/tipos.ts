/** Formato do jsonb devolvido por public.relatorio_vendas (migration 0026). */
export type Relatorio = {
  fuso: string
  inicio: string
  fim: string
  dias: number

  resumo: {
    pedidos: number
    entregues: number
    cancelados: number
    em_andamento: number
    faturamento: number
    ticket_medio: number
    taxas: number
    itens: number
    itens_em_falta: number
    pecas: number
    retiradas: number
    media_diaria: number
  }

  anterior: {
    inicio: string
    fim: string
    entregues: number
    faturamento: number
    /** null quando o periodo anterior nao teve faturamento (nao da pra comparar). */
    variacao_faturamento: number | null
    variacao_pedidos: number | null
  }

  por_dia: Array<{ dia: string; pedidos: number; entregues: number; faturamento: number }>
  produtos: Array<{
    nome: string
    unidade: string
    por_peso: boolean
    quantidade: number
    pedidos: number
    faturamento: number
  }>
  bairros: Array<{ bairro: string; zona: string; pedidos: number; faturamento: number; taxas: number }>
  pagamentos: Array<{ metodo: string; pedidos: number; faturamento: number }>
  horas: Array<{ hora: number; pedidos: number; faturamento: number }>
}
