'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { RolagemHorizontal } from '@/components/ui/rolagem-horizontal'

/**
 * Configuracoes em abas: eram quatro blocos empilhados (mercado, delivery,
 * bairros e taxas, pagamentos) e quem vinha mudar a chave PIX rolava por
 * todo o resto ate chegar la.
 *
 * - A troca e so no navegador, sem ir ao servidor: instantanea.
 * - As abas escondidas continuam montadas (hidden), entao o que foi digitado
 *   numa aba e nao salvo nao se perde ao olhar outra.
 * - A aba vai para a URL (?aba=pagamentos) com replaceState: recarregar,
 *   salvar (a action revalida a pagina) ou mandar o link mantem a aba, sem
 *   encher o historico do "voltar" com cada clique.
 */
export type Aba = { id: string; rotulo: string; conteudo: ReactNode }

export function AbasConfiguracoes({ abas, inicial }: { abas: Aba[]; inicial: string }) {
  const [ativa, setAtiva] = useState(abas.some((a) => a.id === inicial) ? inicial : abas[0]?.id)
  const botoes = useRef<Map<string, HTMLButtonElement>>(new Map())

  // No celular as quatro abas nao cabem e a faixa desliza: a selecionada
  // rola para dentro da tela - senao quem abre direto em ?aba=pagamentos via
  // a aba ativa cortada na borda.
  useEffect(() => {
    botoes.current.get(ativa ?? '')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [ativa])

  function abrir(id: string) {
    setAtiva(id)
    const url = new URL(window.location.href)
    url.searchParams.set('aba', id)
    window.history.replaceState(null, '', url)
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
        <div role="tablist" aria-label="Secoes das configuracoes" className="flex w-max gap-2">
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
