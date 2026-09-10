'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ScanBarcode } from 'lucide-react'

import { Button, buttonClass } from '@/components/ui/button'
import { LeitorCodigoBarras, useLeitorDisponivel } from '@/components/ui/leitor-codigo-barras'
import { moeda } from '@/lib/format'
import { linkEdicao } from '@/lib/produtos/volta'
import { produtoPorCodigo, type ProdutoLido } from './actions'

/**
 * Busca da lista de produtos, com leitura pela camera.
 *
 * Feito para o celular na mao, na gondola: bipou, abre a edicao do produto -
 * trocar preco vira apontar e digitar, sem procurar pelo nome num catalogo
 * de milhares de itens. Codigo que nao esta no sistema oferece cadastrar um
 * produto novo ja com o codigo preenchido.
 *
 * Digitar o numero no campo (ou usar leitor bluetooth, que "digita" o codigo)
 * tambem acha pelo codigo: a busca do servidor compara nome e codigo.
 */

type Leitura =
  | { fase: 'lendo'; tentativa: number }
  | { fase: 'buscando'; codigo: string; tentativa: number }
  | { fase: 'abrindo'; nome: string; tentativa: number }
  | { fase: 'varios'; codigo: string; produtos: ProdutoLido[]; tentativa: number }
  | { fase: 'nao-encontrado'; codigo: string; tentativa: number }
  | { fase: 'erro'; mensagem: string; tentativa: number }

export function BuscaProdutos({
  busca,
  filtro,
  categoria,
  podeCriar,
}: {
  busca: string
  filtro: string
  categoria: string
  podeCriar: boolean
}) {
  const router = useRouter()
  const leitorDisponivel = useLeitorDisponivel()
  const [leitura, setLeitura] = useState<Leitura | null>(null)

  const tentativa = leitura?.tentativa ?? 0
  // A lista como esta agora: quem bipou e salvou volta para ela.
  const aqui = () => `${window.location.pathname}${window.location.search}`
  const lerDeNovo = () => setLeitura({ fase: 'lendo', tentativa: tentativa + 1 })

  async function aoDetectar(codigo: string) {
    setLeitura({ fase: 'buscando', codigo, tentativa })
    const resultado = await produtoPorCodigo(codigo)

    if ('produto' in resultado) {
      setLeitura({ fase: 'abrindo', nome: resultado.produto.name, tentativa })
      router.push(linkEdicao(resultado.produto.id, aqui()))
    } else if ('varios' in resultado) {
      setLeitura({ fase: 'varios', codigo, produtos: resultado.varios, tentativa })
    } else if ('naoEncontrado' in resultado) {
      setLeitura({ fase: 'nao-encontrado', codigo, tentativa })
    } else {
      setLeitura({ fase: 'erro', mensagem: resultado.erro, tentativa })
    }
  }

  return (
    <>
      <form className="flex gap-2 lg:max-w-xl" action="/painel/produtos">
        <input type="hidden" name="f" value={filtro} />
        {categoria ? <input type="hidden" name="c" value={categoria} /> : null}
        <input
          name="q"
          defaultValue={busca}
          placeholder="Nome ou codigo"
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base"
        />
        {leitorDisponivel ? (
          <button
            type="button"
            onClick={lerDeNovo}
            aria-label="Ler codigo de barras com a camera"
            title="Ler codigo de barras"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground"
          >
            <ScanBarcode size={22} aria-hidden />
          </button>
        ) : null}
        <button className="h-12 shrink-0 rounded-xl border border-line bg-surface px-4 font-semibold">
          Buscar
        </button>
      </form>

      {leitura ? (
        <LeitorCodigoBarras
          // Nova tentativa = leitor novo, com a camera ligada de novo.
          key={leitura.tentativa}
          titulo="Aponte para o codigo do produto"
          onDetectar={aoDetectar}
          onFechar={() => setLeitura(null)}
        >
          {leitura.fase === 'buscando' ? (
            <p className="text-center font-semibold">Procurando o codigo {leitura.codigo}...</p>
          ) : null}

          {leitura.fase === 'abrindo' ? (
            <p className="text-center font-semibold">Abrindo {leitura.nome}...</p>
          ) : null}

          {leitura.fase === 'varios' ? (
            <>
              <div className="text-center">
                <p className="text-lg font-bold">
                  {leitura.produtos.length} produtos com este codigo
                </p>
                <p className="text-sm text-muted">
                  Parece cadastro duplicado. Confira o preco de todos antes de sair.
                </p>
              </div>
              <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {leitura.produtos.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={linkEdicao(p.id, aqui())}
                      className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-foreground/5"
                    >
                      <span className="min-w-0 font-semibold">{p.name}</span>
                      <span className="shrink-0 font-bold">{moeda(p.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="secondary" size="lg" className="w-full" onClick={lerDeNovo}>
                Ler outro codigo
              </Button>
            </>
          ) : null}

          {leitura.fase === 'nao-encontrado' ? (
            <>
              <div className="text-center">
                <p className="text-lg font-bold">Produto nao cadastrado</p>
                <p className="text-muted">Nenhum produto tem o codigo {leitura.codigo}.</p>
              </div>
              <div className="flex flex-col gap-2">
                {podeCriar ? (
                  <Link
                    href={`/painel/produtos/novo?codigo=${encodeURIComponent(leitura.codigo)}&volta=${encodeURIComponent(aqui())}`}
                    className={buttonClass('primary', 'lg', 'w-full')}
                  >
                    Cadastrar com este codigo
                  </Link>
                ) : null}
                <Button type="button" variant="secondary" size="lg" onClick={lerDeNovo}>
                  Ler outro codigo
                </Button>
              </div>
            </>
          ) : null}

          {leitura.fase === 'erro' ? (
            <>
              <p className="text-center font-semibold text-[var(--tone-error-fg)]">
                {leitura.mensagem}
              </p>
              <Button type="button" variant="secondary" size="lg" className="w-full" onClick={lerDeNovo}>
                Tentar de novo
              </Button>
            </>
          ) : null}
        </LeitorCodigoBarras>
      ) : null}
    </>
  )
}
