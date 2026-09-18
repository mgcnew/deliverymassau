import { kmTexto } from '@/lib/entrega/faixas'
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
              <p className="text-sm font-black text-brand-ink">{moeda(taxa)}</p>
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

/**
 * "Onde entregamos" quando a taxa e por distancia.
 *
 * Mostra o alcance, nao a tabela de precos. A tabela saiu de proposito: a
 * taxa agora e arredondada para cima quando a posicao do endereco e
 * estimada, entao publicar "ate 2 km -> R$ 3" ao lado de uma cobranca de
 * R$ 4 criaria uma contradicao aparente na propria vitrine. O cliente ve o
 * valor exato no fechamento do pedido, antes de confirmar.
 */
export function FaixasDeEntrega({ faixas }: { faixas: Array<{ up_to_km: number; fee: number }> }) {
  if (!faixas.length) return null
  const ordenadas = [...faixas].sort((a, b) => a.up_to_km - b.up_to_km)

  const alcance = ordenadas.at(-1)!.up_to_km
  const menor = ordenadas[0].fee

  return (
    <section className="pt-2">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-lg font-black">Onde entregamos</h2>
        <p className="text-sm text-muted">
          Entregamos em ate {kmTexto(alcance)} km do mercado. A taxa depende da distancia e comeca
          em {menor === 0 ? 'zero' : moeda(menor)}.
        </p>
        <p className="mt-3 text-xs text-muted">
          O valor da entrega aparece no fechamento do pedido, depois do endereco, antes de voce
          confirmar.
        </p>
      </div>
    </section>
  )
}
