'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { RolagemHorizontal } from '@/components/ui/rolagem-horizontal'

/**
 * Abas de uma tela comprida. Usado nas Configuracoes e na edicao de produto:
 * quem vinha mudar uma coisa so rolava por todo o resto ate chegar la.
 *
 * - A troca e so no navegador, sem ir ao servidor: instantanea.
 * - As abas escondidas continuam montadas (hidden), entao o que foi digitado
 *   numa aba e nao salvo nao se perde ao olhar outra - e, dentro de um
 *   <form>, os campos de todas as abas vao juntos no envio.
 * - A aba vai para a URL (?aba=preco) com replaceState: recarregar, salvar
 *   (a action revalida a pagina) ou mandar o link mantem a aba, sem encher o
 *   historico do "voltar" com cada clique.
 * - Controlada (ativa + aoTrocar) quando quem usa precisa trocar de aba por
 *   conta propria, como o formulario de produto ao achar campo invalido
 *   numa aba escondida.
 */
export type Aba = { id: string; rotulo: string; conteudo: ReactNode }

export function Abas({
  abas,
  inicial = '',
  rotulo,
  ativa: ativaControlada,
  aoTrocar,
}: {
  abas: Aba[]
  /** Aba aberta de inicio (ex.: vinda de ?aba=). Invalida ou vazia = a primeira. */
  inicial?: string
  /** Nome do conjunto para leitor de tela, ex.: "Secoes das configuracoes". */
  rotulo: string
  ativa?: string
  aoTrocar?: (id: string) => void
}) {
  const [ativaInterna, setAtivaInterna] = useState(
    abas.some((a) => a.id === inicial) ? inicial : abas[0]?.id,
  )
  const ativa = ativaControlada ?? ativaInterna
  const botoes = useRef<Map<string, HTMLButtonElement>>(new Map())

  // No celular as abas nem sempre cabem e a faixa desliza: a selecionada
  // rola para dentro da tela - senao quem abre direto numa aba do fim via a
  // aba ativa cortada na borda.
  useEffect(() => {
    botoes.current.get(ativa ?? '')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [ativa])

  // A URL segue a aba ativa - inclusive quando quem controla troca sozinho
  // (ex.: formulario pulando para o campo invalido). So depois do primeiro
  // render: abrir a pagina sem ?aba= nao precisa reescrever o endereco.
  const primeiroRender = useRef(true)
  useEffect(() => {
    if (primeiroRender.current) {
      primeiroRender.current = false
      return
    }
    const url = new URL(window.location.href)
    if (ativa && url.searchParams.get('aba') !== ativa) {
      url.searchParams.set('aba', ativa)
      window.history.replaceState(null, '', url)
    }
  }, [ativa])

  function abrir(id: string) {
    setAtivaInterna(id)
    aoTrocar?.(id)
  }

  // Setas trocam de aba, como o padrao de abas do leitor de tela espera.
  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = abas.findIndex((a) => a.id === ativa)
    const proxima = abas[(i + (e.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length]
    abrir(proxima.id)
    botoes.current.get(proxima.id)?.focus()
  }

  if (abas.length === 0) return null

  return (
    <div className="space-y-4">
      <RolagemHorizontal>
        <div role="tablist" aria-label={rotulo} className="flex w-max gap-2">
          {abas.map((aba) => {
            const selecionada = aba.id === ativa
            return (
              <button
                key={aba.id}
                ref={(el) => {
                  if (el) botoes.current.set(aba.id, el)
                  else botoes.current.delete(aba.id)
                }}
                type="button"
                role="tab"
                id={`aba-${aba.id}`}
                aria-selected={selecionada}
                aria-controls={`painel-${aba.id}`}
                tabIndex={selecionada ? 0 : -1}
                onClick={() => abrir(aba.id)}
                onKeyDown={aoTeclar}
                className={`rounded-full px-4 py-2.5 text-sm font-bold ${
                  selecionada ? 'bg-brand text-brand-foreground' : 'border border-line bg-surface'
                }`}
              >
                {aba.rotulo}
              </button>
            )
          })}
        </div>
      </RolagemHorizontal>

      {abas.map((aba) => (
        <div
          key={aba.id}
          role="tabpanel"
          id={`painel-${aba.id}`}
          aria-labelledby={`aba-${aba.id}`}
          hidden={aba.id !== ativa}
          className="space-y-4"
        >
          {aba.conteudo}
        </div>
      ))}
    </div>
  )
}
