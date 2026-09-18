'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ClipboardCheck } from 'lucide-react'

import { Button, buttonClass } from '@/components/ui/button'
import { Alert } from '@/components/ui/card'
import { ConfirmarAcao } from '@/components/ui/confirmar-acao'
import { cancelarConferencia, criarConferencia, publicarParcial } from './actions'

/** Nome que ja vem preenchido: a data resolve o caso comum sem ninguem digitar. */
function nomeSugerido() {
  return `Conferencia de ${new Date().toLocaleDateString('pt-BR')}`
}

export function AbrirConferencia() {
  const router = useRouter()
  const [nome, setNome] = useState(nomeSugerido)
  const [erro, setErro] = useState<string | null>(null)
  const [abrindo, startAbrir] = useTransition()

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label="Nome da conferencia"
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base"
        />
        <Button
          size="lg"
          disabled={abrindo || !nome.trim()}
          onClick={() =>
            startAbrir(async () => {
              setErro(null)
              const r = await criarConferencia(nome)
              if (r.erro) setErro(r.erro)
              else router.refresh()
            })
          }
        >
          <ClipboardCheck size={20} aria-hidden />
          {abrindo ? 'Abrindo...' : 'Comecar conferencia'}
        </Button>
      </div>
      {erro ? <Alert tone="error">{erro}</Alert> : null}
    </div>
  )
}

/**
 * Encerra sem mexer na vitrine. As leituras ficam: a conferencia entra no
 * historico e continua servindo de base para a viragem depois.
 */
export function EncerrarConferencia({ conferenciaId }: { conferenciaId: string }) {
  const router = useRouter()

  return (
    <ConfirmarAcao
      titulo="Encerrar conferencia"
      descricao="As leituras continuam guardadas e a vitrine nao muda. Usar esta lista como o catalogo da loja e uma acao separada."
      rotuloConfirmar="Encerrar"
      className={buttonClass('secondary')}
      onConfirmar={async () => {
        const r = await cancelarConferencia(conferenciaId)
        if (r.erro) return r
        router.refresh()
      }}
    >
      Encerrar
    </ConfirmarAcao>
  )
}

/**
 * Publica na vitrine o que ja foi bipado, sem encerrar a conferencia.
 *
 * Fica ao lado de "Encerrar" porque as duas sao acoes da conferencia inteira,
 * nao da bipagem. A diferenca entre elas e o que o dono precisa entender:
 * publicar ACRESCENTA (liga o que foi bipado e nao toca no resto) e pode ser
 * repetido; a viragem PODA (tira da vitrine o que nao foi encontrado) e
 * acontece uma vez, no fim.
 */
export function PublicarParcial({ conferenciaId }: { conferenciaId: string }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [resultado, setResultado] = useState<{ ok?: string; erro?: string } | null>(null)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await publicarParcial(conferenciaId)
            if (r.erro) {
              setResultado({ erro: r.erro })
              return
            }
            setResultado({
              ok:
                r.publicados === 0
                  ? 'Tudo que voce bipou ja estava na vitrine.'
                  : `${r.publicados} ${r.publicados === 1 ? 'produto entrou' : 'produtos entraram'} na vitrine.`,
            })
            router.refresh()
          })
        }
      >
        {pendente ? 'Publicando...' : 'Publicar o que ja conferi'}
      </Button>
      {resultado?.erro ? <Alert tone="error">{resultado.erro}</Alert> : null}
      {resultado?.ok ? <Alert tone="success">{resultado.ok}</Alert> : null}
    </div>
  )
}
