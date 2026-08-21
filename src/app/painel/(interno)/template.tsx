/**
 * Transicao entre telas do painel.
 *
 * template.tsx (e nao layout.tsx) porque o Next da uma key nova a cada
 * navegacao: o elemento remonta e a animacao CSS roda de novo. Layout
 * persiste entre rotas, entao nunca reanimaria.
 *
 * O cabecalho e o menu ficam de fora (estao no layout) -- so o conteudo
 * troca, que e o que se espera de uma navegacao.
 */
export default function TemplatePainel({ children }: { children: React.ReactNode }) {
  return <div className="transicao-pagina">{children}</div>
}
