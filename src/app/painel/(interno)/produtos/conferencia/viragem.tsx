'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Store, Undo2 } from 'lucide-react'

import { Button, buttonClass } from '@/components/ui/button'
import { Alert, Card, CardTitle } from '@/components/ui/card'
import { ConfirmarAcao } from '@/components/ui/confirmar-acao'
import { aplicarConferencia, desfazerViragem, verPrevia, type Previa } from './actions'

/**
 * A viragem: a lista conferida passa a ser o catalogo da loja.
 *
 * Uma acao que muda milhares de produtos de uma vez nao pode ser um botao
 * solto. Aqui ela tem tres travas, e as tres estao a vista:
 *
 *   1. a previa e obrigatoria - o botao de aplicar so aparece depois dela;
 *   2. produto sem codigo de barras da para conferir pelo nome, mas nao de
 *      passagem pela gondola; por padrao ele nao sai (padaria, fatiados,
 *      hortifruti, dose - 120 itens ativos do cadastro);
 *   3. o que a viragem mudou fica guardado, e desfazer devolve tudo.
 *
 * E uma quarta, que e a mais perigosa das quatro: enquanto houver leitura na
 * fila do aparelho, nao da para aplicar. A previa e a viragem sao calculadas
 * no SERVIDOR, a partir do que chegou la. Aplicar com a fila subindo trataria
 * o que ainda esta no celular como "nunca foi bipado" - e esses produtos
 * sairiam do catalogo justamente por terem sido conferidos por ultimo.
 */
export function Viragem({
  conferenciaId,
  conferidos,
  naFila,
}: {
  conferenciaId: string
  conferidos: number
  naFila: number
}) {
  const router = useRouter()
  const [manterSemCodigo, setManterSemCodigo] = useState(true)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, startCarregar] = useTransition()

  function pedirPrevia(manter: boolean) {
    startCarregar(async () => {
      const r = await verPrevia(conferenciaId, manter)
      setErro(r.erro ?? null)
      setPrevia(r.previa ?? null)
      setConferidosNaPrevia(conferidos)
    })
  }

  // Mudar a protecao muda os numeros: a previa antiga deixaria a pessoa
  // aplicando algo diferente do que leu na tela.
  function alternarProtecao(manter: boolean) {
    setManterSemCodigo(manter)
    if (previa) pedirPrevia(manter)
  }

  // Bipou mais coisa depois de pedir a previa: os numeros na tela nao valem
  // mais, e aplicar por eles seria aplicar as cegas.
  const [conferidosNaPrevia, setConferidosNaPrevia] = useState(conferidos)
  const previaVencida = previa !== null && conferidosNaPrevia !== conferidos

  return (
    <Card className="space-y-3">
      <CardTitle>Usar esta lista como o catalogo da loja</CardTitle>
      <p className="text-muted">
        O que foi bipado fica na vitrine. O que <strong>nao</strong> foi bipado sai do catalogo -
        sem perder preco, foto nem categoria, entao bipar na proxima conferencia traz de volta.
      </p>

      <label className="flex items-start gap-3 rounded-xl border border-line p-3">
        <input
          type="checkbox"
          checked={manterSemCodigo}
          onChange={(e) => alternarProtecao(e.target.checked)}
          className="mt-1 size-5 shrink-0"
        />
        <span className="text-sm">
          <span className="font-semibold">Manter os produtos sem codigo de barras</span>
          <span className="block text-muted">
            Padaria, fatiados, hortifruti, dose. Da para conferir pelo nome, mas nao da para bipar
            passando pela gondola - entao, se esta conferencia foi so de bipagem, eles ficam em vez
            de sair por um motivo que nao tem a ver com a prateleira.
          </span>
        </span>
      </label>

      {erro ? <Alert tone="error">{erro}</Alert> : null}

      {naFila > 0 ? (
        <Alert tone="error">
          {naFila} leitura{naFila > 1 ? 's' : ''} ainda no aparelho, esperando sinal. A viragem le o
          que chegou ao servidor - aplicar agora tiraria do catalogo justamente os produtos que
          voce acabou de bipar. Espere terminar de subir.
        </Alert>
      ) : previa && !previaVencida ? (
        <div className="space-y-3">
          <ul className="divide-y divide-line rounded-xl border border-line">
            <LinhaPrevia numero={previa.fica} texto="ficam na vitrine" />
            {previa.voltam > 0 ? (
              <LinhaPrevia numero={previa.voltam} texto="estavam inativos e voltam" />
            ) : null}
            {previa.acabou > 0 ? (
              <LinhaPrevia numero={previa.acabou} texto="seguem no catalogo, marcados como esgotados" />
            ) : null}
            {previa.voltam_a_vender > 0 ? (
              <LinhaPrevia
                numero={previa.voltam_a_vender}
                texto="estavam marcados como esgotados e voltam a ser vendidos"
                destaque
              />
            ) : null}
            <LinhaPrevia numero={previa.sai} texto="saem do catalogo" destaque />
            {previa.sempre_tem > 0 ? (
              <LinhaPrevia
                numero={previa.sempre_tem}
                texto={'ficam por estarem marcados como "sempre tem"'}
              />
            ) : null}
            {previa.mantidos_sem_codigo > 0 ? (
              <LinhaPrevia
                numero={previa.mantidos_sem_codigo}
                texto="ficam por nao terem codigo de barras"
              />
            ) : null}
          </ul>

          <p className="text-sm text-muted">
            A loja passa a ter <strong>{previa.vitrine_depois}</strong> produtos.
            {previa.para_cadastrar > 0
              ? ` ${previa.para_cadastrar} codigo${previa.para_cadastrar > 1 ? 's' : ''} bipado${
                  previa.para_cadastrar > 1 ? 's' : ''
                } sem cadastro continua${previa.para_cadastrar > 1 ? 'm' : ''} na lista para cadastrar depois.`
              : ''}
          </p>

          <ConfirmarAcao
            titulo="Aplicar na vitrine"
            descricao={`${previa.sai} produtos saem do catalogo e ${previa.fica} ficam. Da para desfazer depois, mas a loja muda na hora.`}
            rotuloConfirmar="Aplicar"
            className={buttonClass('primary', 'lg')}
            onConfirmar={async () => {
              const r = await aplicarConferencia(conferenciaId, manterSemCodigo)
              if (r.erro) return r
              router.refresh()
            }}
          >
            <Store size={20} aria-hidden />
            Aplicar na vitrine
          </ConfirmarAcao>
        </div>
      ) : (
        <Button
          size="lg"
          variant="secondary"
          disabled={carregando || conferidos === 0}
          onClick={() => pedirPrevia(manterSemCodigo)}
        >
          {carregando
            ? 'Calculando...'
            : previaVencida
              ? 'Voce bipou mais - recalcular'
              : 'Ver o que vai mudar'}
        </Button>
      )}

      {conferidos === 0 ? (
        <p className="text-sm text-muted">
          Bipe pelo menos um produto antes - aplicar uma lista vazia tiraria a loja inteira do ar.
        </p>
      ) : null}
    </Card>
  )
}

function LinhaPrevia({
  numero,
  texto,
  destaque = false,
}: {
  numero: number
  texto: string
  destaque?: boolean
}) {
  return (
    <li className="flex items-baseline gap-3 px-4 py-3">
      <span className={`text-xl font-black ${destaque ? 'text-[var(--tone-error-fg)]' : ''}`}>
        {numero}
      </span>
      <span className="text-sm text-muted">{texto}</span>
    </li>
  )
}

/**
 * Desfazer, depois de aplicada.
 *
 * Devolve cada produto ao estado anterior tal e qual - inclusive por cima de
 * alteracoes feitas na mao entre uma coisa e outra. Por isso a tela diz para
 * usar logo, e nao dias depois.
 */
export function DesfazerViragem({
  conferenciaId,
  aplicadaEm,
}: {
  conferenciaId: string
  aplicadaEm: string
}) {
  const router = useRouter()

  return (
    <Card className="space-y-3">
      <CardTitle>Conferencia aplicada</CardTitle>
      <p className="text-muted">
        A vitrine passou a seguir esta lista em {new Date(aplicadaEm).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        })}
        . Desfazer devolve todos os produtos ao estado anterior e reabre a conferencia para
        continuar bipando.
      </p>
      <Alert tone="info">
        Desfazer devolve o estado de antes da viragem. Se alguem mexeu na disponibilidade de algum
        produto depois, essa mudanca se perde - entao use logo, nao dias depois.
      </Alert>
      <ConfirmarAcao
        titulo="Desfazer a viragem"
        descricao="Todos os produtos voltam ao estado anterior e a conferencia reabre. A loja muda na hora."
        rotuloConfirmar="Desfazer"
        variante="secondary"
        className={buttonClass('secondary', 'lg')}
        onConfirmar={async () => {
          const r = await desfazerViragem(conferenciaId)
          if (r.erro) return r
          router.refresh()
        }}
      >
        <Undo2 size={20} aria-hidden />
        Desfazer a viragem
      </ConfirmarAcao>
    </Card>
  )
}
