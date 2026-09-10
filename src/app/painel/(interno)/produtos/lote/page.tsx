import { redirect } from 'next/navigation'

import { LinkVoltar } from '@/components/ui/link-voltar'
import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { buscarProdutosLote } from './actions'
import { EdicaoEmLote } from './edicao-em-lote'

export const metadata = { title: 'Edicao em lote | Mercado Massa 24h' }

export default async function EdicaoEmLotePage() {
  const staff = await requirePermission(PERMISSIONS.produtosVer)
  const pode = (code: string) => staff.permissions.has(code)

  const podeEditar = pode(PERMISSIONS.produtosEditar)
  const podeDesativar = podeEditar || pode(PERMISSIONS.produtosDesativar)
  const podeExcluir = pode(PERMISSIONS.produtosExcluir)
  // Sem nenhuma dessas, a tela seria so uma lista sem acao.
  if (!podeEditar && !podeDesativar && !podeExcluir) redirect('/painel/produtos')

  const supabase = await createClient()
  // A tela ja abre com os primeiros produtos, sem esperar a primeira busca.
  const [{ data: categorias }, iniciais] = await Promise.all([
    supabase.from('categories').select('id, name, is_active').order('sort_order'),
    buscarProdutosLote('', ''),
  ])

  return (
    <div className="w-full space-y-4">
      <div>
        <LinkVoltar href="/painel/produtos">Produtos</LinkVoltar>
        <h1 className="text-2xl font-black">Edicao em lote</h1>
        <p className="text-muted">
          Mude preco, nome e categoria de varios produtos, ou inative e exclua em grupo. Nada e
          gravado ate voce tocar em Salvar - o rascunho fica guardado neste aparelho.
        </p>
      </div>

      <EdicaoEmLote
        categorias={categorias ?? []}
        iniciais={iniciais}
        podeEditar={podeEditar}
        podeDesativar={podeDesativar}
        podeExcluir={podeExcluir}
      />
    </div>
  )
}
