/**
 * Formas em que o MESMO codigo de barras pode estar gravado no catalogo.
 *
 * O cadastro veio de planilha do sistema antigo e mistura formatos: a maioria
 * em 13 digitos (EAN-13), mas ha UPC de 12 digitos gravado com e sem o zero
 * da frente ("0070847022015" e "008000006525") e GTIN-14. A camera, por sua
 * vez, le um UPC como 12 digitos. Comparar so o texto exato faria o produto
 * "sumir" dependendo de como foi cadastrado.
 *
 * Por isso compara pelo numero sem zeros a esquerda, completado com zeros em
 * todos os tamanhos de 8 a 14 digitos - a base tem ate codigo de 9, 10 e 11.
 * Devolve lista vazia quando o texto nao parece codigo de barras (letras, ou
 * curto demais).
 */
export function variantesDoCodigo(texto: string): string[] {
  const codigo = texto.replace(/\s/g, '')
  if (!/^\d{8,14}$/.test(codigo)) return []

  const semZeros = codigo.replace(/^0+/, '')
  const variantes = new Set([codigo])
  for (let tamanho = Math.max(semZeros.length, 8); tamanho <= 14; tamanho++) {
    variantes.add(semZeros.padStart(tamanho, '0'))
  }
  return [...variantes]
}
