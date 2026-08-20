'use server'

import { revalidatePath } from 'next/cache'

import { PERMISSIONS } from '@/lib/permissions'
import { getStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { lerPlanilhaProdutos, type LinhaPlanilha } from '@/lib/produtos/csv'

export type LinhaResultado = {
  linha: string
  status: 'novo' | 'atualizado'
  nome: string
  categoria: string
  categoria_nova: boolean
  preco_novo: number
  preco_atual?: number
}

export type LinhaErro = { linha: string; motivo: string }

export type ResultadoImportacao = {
  criados: number
  atualizados: number
  categorias_criadas: number
  erros: LinhaErro[]
  linhas: LinhaResultado[]
}

export type ImportacaoState = {
  erro?: string
  resultado?: ResultadoImportacao
  linhasEnviadas?: LinhaPlanilha[]
  concluido?: boolean
}

async function exigirPermissao(): Promise<string | null> {
  const staff = await getStaff()
  if (!staff) return 'Sessao expirada. Entre novamente.'
  if (!staff.permissions.has(PERMISSIONS.produtosCriar)) {
    return 'Voce nao tem permissao para cadastrar produtos.'
  }
  return null
}

export async function analisarPlanilha(
  _prev: ImportacaoState,
  formData: FormData,
): Promise<ImportacaoState> {
  const erroPermissao = await exigirPermissao()
  if (erroPermissao) return { erro: erroPermissao }

  const arquivo = formData.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: 'Escolha um arquivo CSV.' }
  }
  if (arquivo.size > 2 * 1024 * 1024) {
    return { erro: 'O arquivo precisa ter no maximo 2 MB.' }
  }

  const texto = await arquivo.text()
  const leitura = lerPlanilhaProdutos(texto)
  if (!leitura.ok) return { erro: leitura.erro }
  if (leitura.linhas.length === 0) return { erro: 'Nenhuma linha de produto encontrada no arquivo.' }
  if (leitura.linhas.length > 2000) {
    return { erro: 'Muitas linhas de uma vez (limite de 2000). Divida a planilha em partes menores.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('import_products', {
    p_rows: leitura.linhas,
    p_dry_run: true,
  })

  if (error) return { erro: traduzirErro(error.message) }

  return { resultado: data as ResultadoImportacao, linhasEnviadas: leitura.linhas }
}

export async function confirmarImportacao(linhas: LinhaPlanilha[]): Promise<ImportacaoState> {
  const erroPermissao = await exigirPermissao()
  if (erroPermissao) return { erro: erroPermissao }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('import_products', {
    p_rows: linhas,
    p_dry_run: false,
  })

  if (error) return { erro: traduzirErro(error.message) }

  revalidatePath('/painel/produtos')
  revalidatePath('/painel/categorias')
  revalidatePath('/loja')
  return { resultado: data as ResultadoImportacao, concluido: true }
}

function traduzirErro(mensagem: string): string {
  if (mensagem.trim() === 'SEM_PERMISSAO') {
    return 'Voce nao tem permissao para cadastrar produtos.'
  }
  return 'Nao foi possivel processar a planilha. Tente novamente.'
}
