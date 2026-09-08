/**
 * Busca foto de produto por codigo de barras nas bases abertas da familia
 * Open Food Facts e sobe para o Storage do projeto.
 *
 * Tres bases porque um mercado nao vende so comida:
 *   world.openfoodfacts.org     -> alimentos e bebidas
 *   world.openbeautyfacts.org   -> higiene e beleza
 *   world.openproductsfacts.org -> o resto (limpeza, bazar, pet)
 *
 * Licenca: dados em ODbL, fotos em CC-BY-SA. Uso comercial e permitido com
 * atribuicao - por isso a loja ganha um credito no rodape.
 *
 * Uso: node fotos.js [quantos] [--aplicar] [--setores "A,B,C"]
 *   quantos    quantos produtos processar nesta execucao (padrao: tudo)
 *   --aplicar  sem isso, so relata o que encontraria, sem tocar em nada
 *   --setores  limita a essas categorias, pelo nome exato na tabela
 *              categories. Sem isso, varre o catalogo inteiro.
 *
 * Rodar por setor nao economiza tempo - o total e o mesmo. O que muda e a
 * ordem em que a vitrine ganha foto: primeiro os setores que a base cobre
 * melhor (bebida, doce, biscoito), por ultimo bazar e limpeza, onde a
 * Open Products Facts e rala.
 *
 * Duas coisas que a primeira versao nao fazia:
 *
 * 1. Paginacao com janela que anda. O PostgREST corta qualquer consulta em
 *    1000 linhas, entao pedir 5000 produtos rendia 1000.
 *
 *    Comecar sempre do zero tambem nao serve: os codigos ja tentados sem
 *    sucesso ficam nas posicoes baixas por id e, conforme o cache enche,
 *    passam a ocupar as 1000 vagas inteiras. A pagina vira "nada a fazer" e
 *    o laco conclui que acabou, enquanto os nao-tentados esperam da posicao
 *    1001 em diante, fora do alcance da consulta.
 *
 *    Por isso a janela avanca. E avanca descontando quem ganhou foto: esses
 *    saem do conjunto (o filtro pede image_path nulo) e empurram todo o
 *    resto para tras. Somar 1000 cru pularia exatamente essa quantidade de
 *    produto sem olhar.
 *
 * 2. Cache de tentativas. So ~10% dos codigos tem foto nas bases. Sem
 *    memoria, cada nova rodada gastaria horas repetindo as 90% de buscas que
 *    ja deram nada. O cache e gravado a cada 25 novas tentativas, para uma
 *    interrupcao no meio nao jogar fora o trabalho da rodada.
 */
const fs = require('fs')
const path = require('path')

const RAIZ = path.resolve(__dirname, '..')
const CACHE = path.join(__dirname, 'fotos-tentadas.json')

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const CHAVE = env.SUPABASE_SERVICE_ROLE_KEY
const UA = 'MercadoMassau24h/1.0 (catalogo interno; contato massau24hrs@gmail.com)'
const BASES = ['world.openfoodfacts.org', 'world.openbeautyfacts.org', 'world.openproductsfacts.org']
const PAGINA = 1000
// Codigo que a loja antiga inventou para produto sem EAN de fabrica. Nao
// existe em base publica nenhuma: procurar e so gastar 1,4 s por item.
const PREFIXOS_INTERNOS = ['7770000', '2']

const h = { apikey: CHAVE, Authorization: 'Bearer ' + CHAVE, 'Content-Type': 'application/json' }
const espera = (ms) => new Promise((s) => setTimeout(s, ms))

// O fetch do Node nao tem prazo por padrao: uma base que aceita a conexao e
// nunca responde trava o lote inteiro, calado, para sempre. Com prazo, o
// item vira uma falha e a fila continua.
const PRAZO = 20000
const buscar = (url, opcoes = {}) => fetch(url, { ...opcoes, signal: AbortSignal.timeout(PRAZO) })

// Codigos ja procurados sem resultado. Ficam em disco entre execucoes.
const tentados = new Set(fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : [])
let novasTentativas = 0
function guardarTentativa(codigo) {
  tentados.add(codigo)
  if (++novasTentativas % 25 === 0) salvarCache()
}
function salvarCache() {
  fs.writeFileSync(CACHE, JSON.stringify([...tentados]))
}

/**
 * A mesma mercadoria aparece nas bases ora como UPC-A de 12 digitos, ora
 * como EAN-13 com zero na frente, ora como GTIN-14 da caixa. Tentar as
 * variantes custa uma requisicao a mais e resgata codigo que existe la sob
 * outro formato.
 */
function buscavel(bruto) {
  const c = String(bruto).trim()
  if (!/^\d{8,14}$/.test(c)) return false
  return !PREFIXOS_INTERNOS.some((p) => c.startsWith(p))
}

function variantes(bruto) {
  const c = String(bruto).trim()
  if (!/^\d+$/.test(c)) return []
  const lista = [c]
  if (c.length === 12) lista.push('0' + c)
  if (c.length === 14 && c[0] === '0') lista.push(c.slice(1))
  if (c.length === 13 && c[0] === '0') lista.push(c.slice(1))
  return lista
}

async function buscarFoto(codigo) {
  for (const ean of variantes(codigo)) {
    for (const base of BASES) {
      try {
        const r = await buscar(`https://${base}/api/v2/product/${ean}.json?fields=product_name,image_front_url,image_url`, { headers: { 'User-Agent': UA } })
        if (!r.ok) continue
        const j = await r.json()
        if (j.status !== 1) continue
        const url = j.product?.image_front_url || j.product?.image_url
        if (url) return { url, base, ean }
      } catch {
        // base fora do ar nao interrompe o lote: tenta a proxima
      }
    }
  }
  return null
}

async function aplicarFoto(produto, foto) {
  const img = await buscar(foto.url, { headers: { 'User-Agent': UA } })
  const tipo = img.headers.get('content-type') || 'image/jpeg'
  if (!/^image\/(jpeg|png|webp|avif)$/.test(tipo)) return 'tipo recusado: ' + tipo
  const bytes = Buffer.from(await img.arrayBuffer())
  // O bucket recusa acima de 3 MB; as fotos da base ficam bem abaixo disso.
  if (bytes.length > 3 * 1024 * 1024) return 'acima de 3 MB'

  const nomeArquivo = `off-${foto.ean}.${tipo.split('/')[1]}`
  const up = await buscar(`${URL}/storage/v1/object/produtos/${nomeArquivo}`, {
    method: 'POST',
    headers: { apikey: CHAVE, Authorization: 'Bearer ' + CHAVE, 'Content-Type': tipo, 'x-upsert': 'true' },
    body: bytes,
  })
  if (!up.ok) return 'upload: ' + (await up.text()).slice(0, 120)

  const patch = await buscar(`${URL}/rest/v1/products?id=eq.${produto.id}`, {
    method: 'PATCH', headers: h, body: JSON.stringify({ image_path: nomeArquivo }),
  })
  if (!patch.ok) return 'patch: ' + (await patch.text()).slice(0, 120)
  return null
}

async function buscarPagina(filtroCategoria, janela) {
  const r = await buscar(
    `${URL}/rest/v1/products?select=id,name,barcode&barcode=not.is.null&image_path=is.null${filtroCategoria}&order=id&limit=${PAGINA}&offset=${janela}`,
    { headers: h },
  )
  if (!r.ok) throw new Error('consulta falhou: ' + (await r.text()).slice(0, 200))
  return r.json()
}

async function idsDosSetores(nomes) {
  const cats = await (await buscar(`${URL}/rest/v1/categories?select=id,name`, { headers: h })).json()
  const ids = []
  for (const nome of nomes) {
    const c = cats.find((x) => x.name.toLowerCase() === nome.toLowerCase())
    if (!c) throw new Error(`setor nao encontrado: "${nome}". Existem: ${cats.map((x) => x.name).join(', ')}`)
    ids.push(c.id)
  }
  return ids
}

;(async () => {
  const arg = process.argv[2]
  const limite = arg && !arg.startsWith('--') ? Number(arg) : Infinity
  const aplicar = process.argv.includes('--aplicar')

  const iSetores = process.argv.indexOf('--setores')
  const nomesSetores = iSetores >= 0 ? process.argv[iSetores + 1].split(',').map((s) => s.trim()).filter(Boolean) : []
  const filtroCategoria = nomesSetores.length
    ? `&category_id=in.(${(await idsDosSetores(nomesSetores)).join(',')})`
    : ''

  console.log(
    `${aplicar ? 'aplicando' : 'simulacao'} | ja tentados antes: ${tentados.size}` +
    (limite === Infinity ? ' | sem limite de quantidade' : ` | limite: ${limite}`) +
    (nomesSetores.length ? ` | setores: ${nomesSetores.join(', ')}` : ' | catalogo inteiro'),
  )

  const inicio = Date.now()
  let processados = 0, internos = 0, achou = 0, subiu = 0, falhou = 0

  let janela = 0

  while (processados < limite) {
    const pagina = await buscarPagina(filtroCategoria, janela)
    const pendentes = pagina.filter((p) => {
      const c = String(p.barcode).trim()
      if (tentados.has(c)) return false
      // Codigo interno vai direto para o cache: sai do filtro de uma vez e
      // nao volta a aparecer nas proximas paginas nem nas proximas rodadas.
      if (!buscavel(c)) { guardarTentativa(c); internos++; return false }
      return true
    })

    if (pagina.length === 0) {
      console.log('\nacabou: nao ha mais produto com codigo e sem foto')
      break
    }
    if (pendentes.length === 0) {
      // Pagina so de descartados. Se ela veio cheia, ainda ha catalogo
      // depois dela: anda a janela em vez de dar o servico por encerrado.
      if (pagina.length < PAGINA) {
        console.log('\nacabou: o que sobrou ja foi tentado antes ou e codigo interno')
        break
      }
      janela += pagina.length
      continue
    }

    const subiuAntes = subiu

    for (const p of pendentes) {
      if (processados >= limite) break
      processados++

      const foto = await buscarFoto(p.barcode)
      await espera(350) // respeita o limite das bases publicas

      if (!foto) {
        guardarTentativa(String(p.barcode).trim())
      } else {
        achou++
        if (!aplicar) {
          console.log('  encontrada', p.barcode, p.name.slice(0, 40))
        } else {
          try {
            const erro = await aplicarFoto(p, foto)
            if (erro) {
              falhou++
              // Marca como tentado mesmo assim: se a foto de la nao serve
              // (tipo ou tamanho), repetir na proxima rodada da no mesmo.
              guardarTentativa(String(p.barcode).trim())
              console.log('  falhou', p.barcode, erro)
            } else {
              subiu++
            }
          } catch (e) {
            falhou++
            console.log('  erro', p.barcode, String(e).slice(0, 100))
          }
        }
      }

      if (processados % 50 === 0) {
        const min = (Date.now() - inicio) / 60000
        console.log(`  ... ${processados} processados em ${min.toFixed(1)} min | com foto: ${aplicar ? subiu : achou} | ${(processados / min).toFixed(0)}/min`)
      }
    }

    // Quem ganhou foto saiu do conjunto e puxou o resto para tras; a janela
    // anda so pelo que continua la.
    janela += pagina.length - (subiu - subiuAntes)

    // Em simulacao nada sai do filtro, entao a proxima pagina viria igual:
    // uma volta so ja diz o que precisava dizer.
    if (!aplicar) break
  }

  salvarCache()
  const min = (Date.now() - inicio) / 60000
  console.log(
    `\nfim em ${min.toFixed(1)} min | processados: ${processados} | encontradas: ${achou}` +
    (aplicar ? ` | subiram: ${subiu} | falharam: ${falhou}` : '') +
    ` | codigo interno pulado: ${internos} | cache de tentados: ${tentados.size}`,
  )
})()
