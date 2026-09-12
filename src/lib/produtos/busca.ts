import { normalizarBusca } from '@/lib/format'
import { variantesDoCodigo } from '@/lib/produtos/codigo-barras'

/**
 * Filtro das telas de produto do painel: acha por nome ou por codigo de barras
 * no mesmo campo.
 *
 * O nome e comparado pela coluna normalizada (0049), nao pelo nome cru. O
 * cadastro veio do PDV sem acento, entao procurar "café" no nome original
 * nao achava nada enquanto "cafe" achava dezenas - e quem esta no balcao com
 * o cliente na frente nao deveria ter que adivinhar como o produto foi
 * digitado la atras.
 *
 * `like` e nao `ilike` porque a coluna ja e minuscula: assim o indice
 * trigrama e usado de verdade.
 *
 * O numero com cara de codigo de barras entra tambem pelo codigo (digitado ou
 * vindo de leitor bluetooth), com e sem o zero da frente - ver
 * variantesDoCodigo. Como o termo normalizado so tem letra, numero e espaco,
 * nao ha virgula nem parentese que possa quebrar a sintaxe do or().
 */
export function comBuscaDeProduto<
  T extends {
    or: (filtro: string) => T
    like: (coluna: string, padrao: string) => T
  },
>(query: T, busca: string): T {
  const termo = normalizarBusca(busca)
  if (!termo) return query

  const codigos = variantesDoCodigo(busca)
  return codigos.length
    ? query.or(`name_normalized.like."%${termo}%",barcode.in.(${codigos.join(',')})`)
    : query.like('name_normalized', `%${termo}%`)
}
