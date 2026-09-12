'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'
import { CloudOff, PackageX, RefreshCw, ScanBarcode } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Alert, Card, Empty } from '@/components/ui/card'
import { LeitorCodigoBarras, useLeitorDisponivel } from '@/components/ui/leitor-codigo-barras'
import { chaveDoCodigo } from '@/lib/produtos/codigo-barras'
import { baixarCatalogo, carregarLeituras, enviarLeituras, apagarLeitura } from './actions'
import {
  assinarCatalogo,
  catalogoVencido,
  guardarCatalogo,
  indexarCatalogo,
  lerCatalogo,
  lerCatalogoNoServidor,
  type ProdutoCatalogo,
} from './catalogo-local'
import { LinhaConferida } from './linha-conferida'
import { Viragem } from './viragem'
import {
  assinarSessao,
  chaveDaLeitura,
  contagem,
  definirQuantidade,
  emOrdem,
  gravarSessao,
  lerSessao,
  lerSessaoNoServidor,
  marcarSincronizadas,
  pendentes,
  registrar,
  remover,
  type Leitura,
} from './sessao'

/**
 * Conferencia de estoque: andar pela loja bipando o que existe na prateleira.
 *
 * A tela e feita para uma mao segurando o aparelho e o olho na gondola, nao no
 * visor. Por isso a camera fica ligada lendo um item atras do outro, a
 * confirmacao de cada leitura e a vibracao, e nada trava esperando rede: o
 * catalogo inteiro desce uma vez e mora no aparelho, as leituras se acumulam
 * localmente e sobem quando da.
 *
 * Enquanto a conferencia esta aberta a vitrine nao muda em nada. A viragem -
 * o que ficou de fora sai do catalogo - e uma acao separada, com previa e
 * desfazer.
 */

/** Quantas leituras sobem por vez. O banco aceita ate 500 por chamada. */
const LOTE = 200

/** De quanto em quanto tempo a fila tenta subir sozinha, alem do disparo por leitura. */
const INTERVALO_SINCRONIA = 15_000

export type ConferenciaAberta = { id: string; name: string; started_at: string }

export function Conferencia({
  conferencia,
  podeAplicar,
}: {
  conferencia: ConferenciaAberta
  podeAplicar: boolean
}) {
  const sessao = useSyncExternalStore(
    assinarSessao,
    () => lerSessao(conferencia.id),
    lerSessaoNoServidor,
  )
  const leitorDisponivel = useLeitorDisponivel()

  const guardado = useSyncExternalStore(assinarCatalogo, lerCatalogo, lerCatalogoNoServidor)
  const catalogo = guardado?.produtos ?? null

  const [baixando, startBaixar] = useTransition()
  const [erroCatalogo, setErroCatalogo] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [ultima, setUltima] = useState<string | null>(null)
  // Codigo que cai em mais de um produto: quem bipou escolhe (ver catalogo-local).
  const [escolha, setEscolha] = useState<{ codigo: string; produtos: ProdutoCatalogo[] } | null>(null)
  const [erroFila, setErroFila] = useState<string | null>(null)
  const [digitado, setDigitado] = useState('')
  const [busca, setBusca] = useState('')

  const indice = useMemo(() => indexarCatalogo(catalogo ?? []), [catalogo])
  const numeros = contagem(sessao)
  const sessaoPronta = sessao.conferenciaId === conferencia.id

  // --- Catalogo ------------------------------------------------------------

  const baixar = useCallback(() => {
    startBaixar(async () => {
      const r = await baixarCatalogo()
      setErroCatalogo(r.produtos ? null : (r.erro ?? 'Nao foi possivel baixar o catalogo.'))
      if (r.produtos) guardarCatalogo(r.produtos)
    })
  }, [])

  // O que ja esta no aparelho vale desde o primeiro render, mesmo vencido: com
  // rede ruim, bipar usando o catalogo de ontem e muito melhor que nao bipar.
  // O download so repoe por cima.
  const conferiuValidade = useRef(false)
  useEffect(() => {
    if (conferiuValidade.current) return
    conferiuValidade.current = true
    if (catalogoVencido(lerCatalogo())) baixar()
  }, [baixar])

  // --- Fila ----------------------------------------------------------------

  const sincronizando = useRef(false)

  const sincronizar = useCallback(async () => {
    if (sincronizando.current || !navigator.onLine) return
    const atual = lerSessao(conferencia.id)
    const fila = pendentes(atual)
    if (!fila.length) return

    sincronizando.current = true
    try {
      const lote = fila.slice(0, LOTE)
      const r = await enviarLeituras(
        conferencia.id,
        lote.map(([, l]) => ({
          produto: l.produtoId,
          codigo: l.codigo,
          quantidade: l.quantidade,
          em: l.em,
        })),
      )
      if (r.erro) {
        setErroFila(r.erro)
      } else {
        setErroFila(null)
        // Le de novo: a pessoa pode ter bipado mais enquanto o lote viajava.
        gravarSessao(marcarSincronizadas(lerSessao(conferencia.id), lote))
      }
    } finally {
      sincronizando.current = false
    }
  }, [conferencia.id])

  // Sobe quando a fila cresce, quando o sinal volta e de tempos em tempos -
  // esta ultima cobre o caso de o envio ter falhado com a fila parada.
  useEffect(() => {
    sincronizar()
    const relogio = setInterval(sincronizar, INTERVALO_SINCRONIA)
    window.addEventListener('online', sincronizar)
    return () => {
      clearInterval(relogio)
      window.removeEventListener('online', sincronizar)
    }
  }, [sincronizar, numeros.naFila])

  // --- Retomar de outro aparelho -------------------------------------------
  //
  // Quem trocou de celular no meio da conferencia (ou limpou o navegador) veria
  // a lista vazia e recomecaria a loja inteira. Traz o que o servidor ja tem e
  // junta com o que houver aqui, sem sobrescrever o local - o que esta no
  // aparelho e mais novo por definicao.
  const retomou = useRef(false)
  useEffect(() => {
    if (retomou.current || !catalogo) return
    retomou.current = true
    ;(async () => {
      const r = await carregarLeituras(conferencia.id)
      if (!r.leituras?.length) return

      const porId = new Map(catalogo.map((p) => [p.id, p]))
      const atual = lerSessao(conferencia.id)
      const leituras = { ...atual.leituras }
      let mudou = false

      for (const vinda of r.leituras) {
        const chave = chaveDaLeitura({ produtoId: vinda.produto, codigo: vinda.codigo })
        if (leituras[chave]) continue
        const produto = vinda.produto ? porId.get(vinda.produto) : undefined
        leituras[chave] = {
          produtoId: vinda.produto,
          codigo: vinda.codigo,
          nome: produto?.nome ?? vinda.codigo,
          inativo: produto?.inativo ?? false,
          quantidade: vinda.quantidade,
          em: vinda.em,
          sincronizada: true,
        }
        mudou = true
      }
      if (mudou) gravarSessao({ ...atual, leituras })
    })()
  }, [catalogo, conferencia.id])

  // --- Bipar ---------------------------------------------------------------

  const conferir = useCallback(
    (produto: ProdutoCatalogo | null, codigo: string) => {
      const proxima = registrar(lerSessao(conferencia.id), produto, codigo)
      gravarSessao(proxima)
      setUltima(chaveDaLeitura({ produtoId: produto?.id ?? null, codigo }))
      setEscolha(null)
    },
    [conferencia.id],
  )

  const aoBipar = useCallback(
    (codigo: string) => {
      const chave = chaveDoCodigo(codigo)
      const achados = chave ? (indice.get(chave) ?? []) : []

      if (achados.length > 1) {
        setEscolha({ codigo, produtos: achados })
        return
      }
      conferir(achados[0] ?? null, codigo)
    },
    [indice, conferir],
  )

  function aoDigitar(e: React.FormEvent) {
    e.preventDefault()
    const codigo = digitado.trim()
    if (!codigo) return
    aoBipar(codigo)
    setDigitado('')
  }

  // --- Lista ---------------------------------------------------------------

  const todas = sessaoPronta ? emOrdem(sessao) : []
  const filtro = busca.trim().toLowerCase()
  const visiveis = filtro
    ? todas.filter(([, l]) => l.nome.toLowerCase().includes(filtro) || l.codigo.includes(filtro))
    : todas

  async function tirarDaLista(chave: string, leitura: Leitura) {
    gravarSessao(remover(lerSessao(conferencia.id), chave))
    // Se ja tinha subido, some tambem do servidor. Falhou? A linha volta na
    // proxima vez que a conferencia for carregada - melhor que sumir calado.
    if (leitura.sincronizada) {
      await apagarLeitura(conferencia.id, leitura.produtoId, leitura.codigo)
    }
  }

  const ultimaLeitura = ultima ? sessao.leituras[ultima] : undefined

  /**
   * Codigo que cai em mais de um produto. Aparece nos dois lugares onde da
   * para bipar - no rodape da camera e na propria pagina - porque a leitura
   * tambem chega por leitor bluetooth e por codigo digitado, e nesses casos a
   * camera esta fechada: sem isto a leitura sumiria sem dizer nada.
   */
  const seletorDeProduto = escolha ? (
    <div className="space-y-2">
      <p className="text-sm font-semibold">
        Esse codigo esta em {escolha.produtos.length} produtos. Qual esta na prateleira?
      </p>
      {escolha.produtos.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => conferir(p, escolha.codigo)}
          className="block w-full truncate rounded-xl border border-line px-3 py-3 text-left font-semibold"
        >
          {p.nome}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setEscolha(null)}
        className="block w-full rounded-xl px-3 py-2 text-sm font-semibold text-muted"
      >
        Nenhum desses
      </button>
    </div>
  ) : null

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-3xl font-black">{numeros.conferidos}</p>
          <p className="text-muted">
            conferidos
            {numeros.acabaram > 0
              ? ` - ${numeros.acabaram} marcado${numeros.acabaram > 1 ? 's' : ''} como acabou`
              : ''}
            {numeros.desconhecidos > 0 ? ` - ${numeros.desconhecidos} para cadastrar` : ''}
          </p>
        </div>

        <p className="flex items-center gap-2 text-sm text-muted">
          {numeros.naFila > 0 ? (
            <>
              <CloudOff size={16} aria-hidden />
              {numeros.naFila} leitura{numeros.naFila > 1 ? 's' : ''} guardada
              {numeros.naFila > 1 ? 's' : ''} no aparelho, subindo quando houver sinal
            </>
          ) : (
            'Tudo salvo no servidor.'
          )}
        </p>

        {erroFila ? <Alert tone="error">{erroFila}</Alert> : null}

        {catalogo === null ? (
          <Alert tone="info">
            {baixando
              ? 'Baixando o catalogo para bipar sem internet...'
              : (erroCatalogo ?? 'Catalogo ainda nao baixado.')}
          </Alert>
        ) : null}
        {catalogo !== null && erroCatalogo ? (
          <Alert tone="error">{erroCatalogo} Bipando com o catalogo que ja estava no aparelho.</Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {leitorDisponivel ? (
            <Button size="lg" onClick={() => setLendo(true)} disabled={catalogo === null}>
              <ScanBarcode size={20} aria-hidden />
              Bipar produtos
            </Button>
          ) : (
            <Alert tone="info">
              Este navegador nao le codigo pela camera - so Chrome ou Edge no Android e no
              computador. Um leitor bluetooth funciona aqui: ele digita o codigo no campo abaixo.
            </Alert>
          )}

          <Button variant="secondary" size="lg" onClick={baixar} disabled={baixando}>
            <RefreshCw size={18} aria-hidden />
            {baixando ? 'Baixando...' : 'Atualizar catalogo'}
          </Button>
        </div>

        {/* Leitor bluetooth "digita" o codigo e da Enter - e o caminho mais
            rapido de todos, e o unico que funciona no iPhone. */}
        {!lendo && seletorDeProduto ? seletorDeProduto : null}

        <form onSubmit={aoDigitar} className="flex gap-2">
          <input
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            placeholder="Ou digite o codigo / use leitor bluetooth"
            inputMode="numeric"
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base"
          />
          <Button type="submit" variant="secondary" disabled={!digitado.trim() || catalogo === null}>
            Conferir
          </Button>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Conferidos</h2>
          {todas.length > 8 ? (
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Procurar na lista"
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-base sm:w-64"
            />
          ) : null}
        </div>

        {visiveis.length === 0 ? (
          <Empty>
            {todas.length === 0
              ? leitorDisponivel
                ? 'Nada conferido ainda. Toque em "Bipar produtos" e passe pela prateleira.'
                : 'Nada conferido ainda. Use o leitor bluetooth ou digite o codigo acima.'
              : 'Nenhum item da lista bate com essa busca.'}
          </Empty>
        ) : (
          <ul>
            {visiveis.map(([chave, leitura]) => (
              <LinhaConferida
                key={chave}
                leitura={leitura}
                onQuantidade={(q) => gravarSessao(definirQuantidade(lerSessao(conferencia.id), chave, q))}
                onRemover={() => tirarDaLista(chave, leitura)}
              />
            ))}
          </ul>
        )}
      </Card>

      {podeAplicar ? (
        <Viragem
          conferenciaId={conferencia.id}
          conferidos={numeros.conferidos}
          naFila={numeros.naFila}
        />
      ) : null}

      {lendo ? (
        <LeitorCodigoBarras
          continuo
          titulo={`${numeros.conferidos} conferidos`}
          onDetectar={aoBipar}
          onFechar={() => {
            setLendo(false)
            setEscolha(null)
          }}
        >
          {seletorDeProduto ? (
            seletorDeProduto
          ) : ultimaLeitura ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{ultimaLeitura.nome}</p>
                <p className="truncate text-sm text-muted">
                  {ultimaLeitura.produtoId === null
                    ? 'Nao esta no cadastro - fica na lista para cadastrar'
                    : ultimaLeitura.quantidade === 0
                      ? 'Marcado como acabou'
                      : ultimaLeitura.inativo
                        ? 'Inativo - vai voltar para a vitrine'
                        : 'Conferido'}
                </p>
              </div>
              {/* Contar exige teclado, que cobre a camera: aqui fica so o
                  "acabou", que e um toque. A quantidade se digita na lista. */}
              <button
                type="button"
                onClick={() =>
                  gravarSessao(
                    definirQuantidade(
                      lerSessao(conferencia.id),
                      ultima!,
                      ultimaLeitura.quantidade === 0 ? null : 0,
                    ),
                  )
                }
                className={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${
                  ultimaLeitura.quantidade === 0 ? 'border-brand bg-brand text-brand-foreground' : 'border-line'
                }`}
              >
                <PackageX size={16} aria-hidden />
                Acabou
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">Aponte para o codigo de barras do primeiro produto.</p>
          )}
        </LeitorCodigoBarras>
      ) : null}
    </div>
  )
}
