import { moeda } from '@/lib/format'

/**
 * "Onde entregamos" no pe da vitrine.
 *
 * Um chip por bairro funcionava com tres bairros; com algumas dezenas vira
 * um bloco amontoado no fim da pagina e ninguem le. Aqui os bairros sao
 * agrupados PELA TAXA - que e o que o cliente quer saber ("quanto vou
 * pagar?") - e viram texto corrido dentro de cada faixa, o que ocupa uma
 * fracao do espaco e ainda deixa procurar o proprio bairro de relance.
 *
 * A lista fica recolhida quando e longa: <details> nativo, sem JavaScript,
 * e o resumo ja adianta o que importa (quantos bairros e a taxa a partir de).
 */
export function BairrosAtendidos({ bairros }: { bairros: Array<{ bairro: string; taxa: number }> }) {
  if (!bairros.length) return null

  const porTaxa = new Map<number, string[]>()
  for (const { bairro, taxa } of bairros) {
    const lista = porTaxa.get(taxa)
    if (lista) lista.push(bairro)
    else porTaxa.set(taxa, [bairro])
  }

  const faixas = [...porTaxa.entries()].sort(([a], [b]) => a - b)
  const menorTaxa = faixas[0][0]
  // Ate uma dezena de bairros a lista cabe aberta sem atrapalhar.
  const aberto = bairros.length <= 10

  return (
    <section className="pt-2">
      <details open={aberto} className="group rounded-2xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="text-lg font-black">Onde entregamos</h2>
            <p className="text-sm text-muted">
              {bairros.length} {bairros.length === 1 ? 'bairro' : 'bairros'} - entrega a partir de{' '}
              {moeda(menorTaxa)}
            </p>
          </div>
          <span
            aria-hidden
            className="shrink-0 text-sm font-bold text-muted transition-transform group-open:rotate-180"
          >
            ▼
          </span>
        </summary>

        <div className="space-y-3 border-t border-line p-4">
          {faixas.map(([taxa, nomes]) => (
            <div key={taxa}>
              <p className="text-sm font-black text-brand">{moeda(taxa)}</p>
              <p className="text-sm leading-relaxed text-muted">{nomes.join(' · ')}</p>
            </div>
          ))}
          <p className="text-xs text-muted">
            Nao achou o seu bairro? A taxa aparece de novo no fechamento do pedido.
          </p>
        </div>
      </details>
    </section>
  )
}
