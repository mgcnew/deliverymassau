'use client'

import { useEffect } from 'react'

/**
 * Voltando da edicao para a lista (#produto-<id> na URL): rola ate o produto
 * que acabou de ser salvo e acende a linha, com o selo "Salvo".
 *
 * Nao da para contar com o navegador: a volta e navegacao do proprio app
 * (pushState), que nao aciona o :target do CSS nem a rolagem de ancora - e
 * a lista rola dentro do <main> do painel, nao na janela. A rolagem repete
 * um instante depois porque o roteador ainda pode levar a tela ao topo
 * depois de montar a pagina.
 *
 * O # sai da URL em seguida: recarregar a lista nao deve piscar de novo.
 */
export function ProdutoSalvo() {
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id.startsWith('produto-')) return
    const linha = document.getElementById(id)
    if (!linha) return

    const rolar = () => linha.scrollIntoView({ behavior: 'instant', block: 'center' })
    rolar()
    const depois = setTimeout(rolar, 120)
    linha.classList.add('produto-salvo')
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)

    return () => clearTimeout(depois)
  }, [])

  return null
}
