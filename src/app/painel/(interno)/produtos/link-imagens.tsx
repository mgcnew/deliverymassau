import { Images } from 'lucide-react'

/**
 * Atalho para achar foto do produto na web.
 *
 * Quase metade do catalogo esta sem foto (em "Casa e utilidades" sao 351 de
 * 514), e completar isso e trabalho de digitar o nome numa aba nova, procurar,
 * copiar a imagem e voltar. O primeiro passo desse ciclo e sempre o mesmo, e
 * e o unico que da para o sistema fazer: abrir a busca ja preenchida.
 *
 * Fica ao lado do campo de colar de proposito. O resto do ciclo continua na
 * mao - copiar a imagem na pagina que abriu e apertar Ctrl+V aqui - e ter as
 * duas pontas na mesma tela e o que faz a repeticao render.
 *
 * A busca abre sempre na MESMA aba, e nao numa nova a cada clique: ver o
 * target abaixo.
 *
 * Nao devolve nada quando o termo esta vazio: produto sem nome ou sem codigo
 * nao tem o que procurar, e um link que busca o vazio so frustra.
 */
export function LinkImagens({ termo, children }: { termo: string; children: string }) {
  const limpo = termo.trim()
  if (!limpo) return null

  return (
    <a
      href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(limpo)}`}
      // Aba NOMEADA, e nao _blank: completar catalogo e uma sequencia de
      // produtos, e cada clique abrindo mais uma aba enche o navegador. Com
      // nome, a segunda busca troca o conteudo da aba que ja esta aberta.
      // Os dois atalhos (nome e codigo) usam o mesmo nome de proposito: e uma
      // aba de "procurar imagem", nao uma por campo.
      target="massa24h-imagens"
      // rel="noopener" ficaria bonito aqui, mas ele FORCA contexto novo e
      // desfaz o reaproveitamento - o navegador passaria a ignorar o nome.
      // Como o destino e um endereco que este codigo monta, sempre no Google,
      // nao ha pagina desconhecida para se preocupar. O referrerPolicy cobre
      // a outra metade sem esse efeito: o Google nao recebe o endereco do
      // painel nem o id do produto.
      referrerPolicy="no-referrer"
      className="inline-flex h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-ink"
    >
      <Images size={16} aria-hidden />
      {children}
    </a>
  )
}
