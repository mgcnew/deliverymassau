/** Distancia de edicao (Levenshtein) simples, usada so pra avisar de nomes parecidos. */
export function distanciaEdicao(a: string, b: string): number {
  const linhas = a.length
  const colunas = b.length
  const d: number[][] = Array.from({ length: linhas + 1 }, () => new Array(colunas + 1).fill(0))

  for (let i = 0; i <= linhas; i++) d[i][0] = i
  for (let j = 0; j <= colunas; j++) d[0][j] = j

  for (let i = 1; i <= linhas; i++) {
    for (let j = 1; j <= colunas; j++) {
      d[i][j] =
        a[i - 1] === b[j - 1]
          ? d[i - 1][j - 1]
          : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1])
    }
  }

  return d[linhas][colunas]
}
