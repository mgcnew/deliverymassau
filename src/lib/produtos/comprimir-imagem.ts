'use client'

/**
 * Redimensiona e recomprime no navegador antes do upload. Uma foto de
 * celular sai da camera com 3-4000px de largura e 300+ KB so pra aparecer
 * num quadrado de 60-300px na tela - o next/image resolve a EXIBICAO, mas
 * o arquivo original continua pesado no Storage e no tempo de upload (que
 * importa no 4G do balcao). Aqui ataca a causa: manda menor desde o inicio.
 */
export async function comprimirImagem(
  arquivo: File,
  opcoes: { larguraMaxima?: number; qualidade?: number } = {},
): Promise<File> {
  const { larguraMaxima = 1280, qualidade = 0.82 } = opcoes

  // SVG e GIF (animado) nao passam bem por canvas - sobem como vieram.
  if (arquivo.type === 'image/svg+xml' || arquivo.type === 'image/gif') return arquivo

  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, larguraMaxima / bitmap.width)
    const largura = Math.round(bitmap.width * escala)
    const altura = Math.round(bitmap.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) return arquivo

    ctx.drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', qualidade),
    )
    if (!blob) return arquivo

    // So troca se realmente compensou (imagem ja pequena pode nao valer a pena).
    if (blob.size >= arquivo.size) return arquivo

    const nome = arquivo.name.replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], nome, { type: 'image/jpeg' })
  } catch {
    // Navegador sem createImageBitmap/canvas: sobe do jeito que veio.
    return arquivo
  }
}
