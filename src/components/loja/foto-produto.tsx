import Image from 'next/image'

/**
 * Foto do produto dentro de um quadro de proporcao fixa.
 *
 * O problema: as fotos do catalogo vem de todo jeito. Medindo o acervo, a
 * proporcao vai de 0,37 (embalagem alta e estreita) a 1,42, e so 58% sao
 * quadradas - nenhuma proporcao de quadro serve para todas. Preenchendo o
 * quadro (object-cover), a embalagem alta perde quase tudo. Cabendo inteira
 * (object-contain), nada se perde, mas sobra faixa em volta.
 *
 * A saida nao e escolher entre cortar e sobrar: e fazer a sobra desaparecer.
 * As fotos sao de estudio sobre branco puro (as bordas medem 255,255,255),
 * entao o quadro tambem e branco - nos dois temas, ver --foto. A foto se
 * funde com a chapa e o limite entre uma e outra some.
 *
 * Antes havia aqui uma copia desfocada da propria foto preenchendo a sobra.
 * A ideia era boa e resolvia a minoria de fotos que nao tem fundo branco (as
 * tiradas no proprio mercado), mas cobrava caro pelo resto: desenhava a
 * imagem duas vezes, e o desfoque puxava transparencia de fora da borda, o
 * que sujava a faixa de cinza justamente nas fotos brancas - a maioria. Uma
 * chapa branca acerta a maioria sem efeito nenhum, e deixa a minoria como
 * "foto sobre fundo branco", que e o normal de catalogo.
 */
export function FotoProduto({
  src,
  sizes,
  priority = false,
}: {
  src: string
  sizes: string
  priority?: boolean
}) {
  return <Image src={src} alt="" fill sizes={sizes} priority={priority} className="object-contain" />
}
