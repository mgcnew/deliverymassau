import Image from 'next/image'

/**
 * Foto do produto dentro de um quadro de proporcao fixa.
 *
 * O problema: as fotos do catalogo vem de todo jeito - foto de estudio
 * quadrada do fornecedor, foto vertical tirada no celular no proprio
 * mercado. Preenchendo o quadro (object-cover), foto vertical perde topo e
 * base: some o gargalo da garrafa, some a marca do pacote. Cabendo inteira
 * (object-contain), nada se perde, mas sobram faixas mortas dos lados.
 *
 * A saida e mostrar a foto inteira por cima e preencher o resto com a
 * PROPRIA foto, desfocada. Nada e cortado, o quadro nunca fica com buraco
 * cinza, e a cor do fundo combina sempre com o produto.
 *
 * As duas camadas usam a mesma URL e o mesmo `sizes` de proposito: o
 * navegador baixa um arquivo so e desenha duas vezes.
 *
 * Quem chama precisa ser `relative` e `overflow-hidden` - o desfoque sangra
 * alem da borda (por causa do scale) e precisa ser aparado ali.
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
  return (
    <>
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        aria-hidden
        // scale-110: sem a folga, o desfoque revela as bordas transparentes
        // da propria imagem e aparece uma moldura clara em volta.
        className="scale-110 object-cover opacity-60 blur-lg"
      />
      <Image src={src} alt="" fill sizes={sizes} priority={priority} className="object-contain" />
    </>
  )
}
