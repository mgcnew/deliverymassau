import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'
import { LinkVoltar } from '@/components/ui/link-voltar'
import { ImportarForm } from './importar-form'

export const metadata = { title: 'Importar produtos | Mercado Massa 24h' }

export default async function ImportarProdutosPage() {
  await requirePermission(PERMISSIONS.produtosCriar)

  return (
    <div className="w-full max-w-3xl space-y-4">
      <div>
        <LinkVoltar href="/painel/produtos">Produtos</LinkVoltar>
        <h1 className="text-2xl font-black">Importar produtos</h1>
        <p className="text-muted">
          Suba uma planilha CSV com o catalogo do seu sistema atual. Produto com nome ja
          cadastrado tem o preco atualizado; produto novo entra sem foto e disponivel para venda.
        </p>
      </div>

      <ImportarForm />
    </div>
  )
}
