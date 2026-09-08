/**
 * Busca foto de produto por codigo de barras num zip de 12,5 GB guardado no
 * Google Drive, sem baixar o zip.
 *
 * Fonte: img_288k_jpg500_v1.zip -- 288.569 fotos 500x500, nomeadas pelo
 * proprio EAN (jpg/7891000100103.jpg). Complementa o fotos.js: as bases
 * abertas ja foram varridas ate o fim e o que sobrou nao existe la.
 *
 * Uso: node fotos-pdv.js [quantos] [--aplicar]
 *   quantos    quantos produtos processar nesta execucao (padrao: tudo)
 *   --aplicar  sem isso, so relata o que encontraria, sem tocar em nada
 *
 * COMO NAO BAIXAR 12,5 GB
 *
 * Um zip guarda o indice no fim do arquivo, e o Drive aceita Range nessa
 * URL. Entao da para ler so o indice (32 MB), descobrir em que byte mora
 * cada foto, e depois pedir apenas as faixas das fotos que interessam --
 * ~93 MB para as 1.906 que casam com o catalogo, em vez do arquivo inteiro.
 *
 * O indice fica em pdv-indice.json depois da primeira execucao. E grande
 * demais para o git (fora pelo .gitignore) e se refaz em cerca de um minuto.
 *
 * POR QUE ESTE NAO TEM CACHE DE TENTATIVAS
 *
 * O fotos.js precisa de cache porque so descobre se existe foto depois de
 * uma requisicao de 1,4 s que quase sempre volta vazia. Aqui o indice esta
 * na memoria: saber se um EAN tem foto e uma consulta local. Nao ha
 * tentativa perdida para lembrar -- so se pede o que se sabe que existe.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const RAIZ = path.resolve(__dirname, '..')
const INDICE = path.join(__dirname, 'pdv-indice.json')

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL
const CHAVE = env.SUPABASE_SERVICE_ROLE_KEY
const h = { apikey: CHAVE, Authorization: 'Bearer ' + CHAVE, 'Content-Type': 'application/json' }

const ID_DRIVE = '1j3IR9aLMPlKSVr8ntLqba7y5vtFzoFsO'
const URL_ZIP = `https://drive.usercontent.google.com/download?id=${ID_DRIVE}&export=download&confirm=t`
const TAM_ZIP = 12526837460
const PAGINA = 1000

// O fetch do Node nao tem prazo por padrao: um servidor que aceita a conexao
// e nunca responde travaria o lote inteiro, calado, para sempre.
const PRAZO = 60000
const espera = (ms) => new Promise((s) => setTimeout(s, ms))

async function faixa(ini, fim) {
  const r = await fetch(URL_ZIP, {
    headers: { Range: `bytes=${ini}-${fim}` },
    signal: AbortSignal.timeout(PRAZO),
  })
  if (!r.ok && r.status !== 206) throw new Error('faixa ' + r.status)
  return Buffer.from(await r.arrayBuffer())
}

// ---------------------------------------------------------------- indice

/**
 * Le o indice do zip pelo fim do arquivo. O zip passa de 4 GB, entao os
 * campos de tamanho estouraram o formato classico e o que vale e o EOCD64.
 */
async function montarIndice() {
  process.stdout.write('montando indice do zip (uma vez so)... ')

  const cauda = await faixa(TAM_ZIP - 65536, TAM_ZIP - 1)
  const pLoc = cauda.lastIndexOf(Buffer.from('PK\x06\x07', 'latin1'))
  if (pLoc < 0) throw new Error('zip sem localizador ZIP64')
  const offEocd64 = Number(cauda.readBigUInt64LE(pLoc + 8))

  const bloco = await faixa(offEocd64, offEocd64 + 55)
  if (bloco.subarray(0, 4).toString('latin1') !== 'PK\x06\x06') throw new Error('EOCD64 nao confere')
  const tamCd = Number(bloco.readBigUInt64LE(40))
  const offCd = Number(bloco.readBigUInt64LE(48))

  const cd = await faixa(offCd, offCd + tamCd - 1)
  const mapa = {}
  let p = 0
  while (p + 46 <= cd.length && cd.subarray(p, p + 4).toString('latin1') === 'PK\x01\x02') {
    const metodo = cd.readUInt16LE(p + 10)
    let comp = cd.readUInt32LE(p + 20)
    let desc = cd.readUInt32LE(p + 24)
    const ln = cd.readUInt16LE(p + 28)
    const le = cd.readUInt16LE(p + 30)
    const lc = cd.readUInt16LE(p + 32)
    const nome = cd.subarray(p + 46, p + 46 + ln).toString('utf8')
    let off = cd.readUInt32LE(p + 42)

    // Campo que estourou 4 GB vira 0xFFFFFFFF e o valor real fica no extra
    // 0x0001, na ordem descompactado / compactado / offset.
    if (comp === 0xFFFFFFFF || desc === 0xFFFFFFFF || off === 0xFFFFFFFF) {
      const extra = cd.subarray(p + 46 + ln, p + 46 + ln + le)
      let q = 0
      while (q + 4 <= extra.length) {
        const tid = extra.readUInt16LE(q)
        const tam = extra.readUInt16LE(q + 2)
        if (tid === 1) {
          let v = q + 4
          if (desc === 0xFFFFFFFF) { desc = Number(extra.readBigUInt64LE(v)); v += 8 }
          if (comp === 0xFFFFFFFF) { comp = Number(extra.readBigUInt64LE(v)); v += 8 }
          if (off === 0xFFFFFFFF) { off = Number(extra.readBigUInt64LE(v)) }
          break
        }
        q += 4 + tam
      }
    }

    const m = nome.match(/^jpg\/(\d+)\.jpg$/)
    if (m) mapa[m[1]] = [off, comp, metodo]
    p += 46 + ln + le + lc
  }

  fs.writeFileSync(INDICE, JSON.stringify(mapa))
  console.log(`${Object.keys(mapa).length.toLocaleString('pt-BR')} fotos`)
  return mapa
}

// ---------------------------------------------------------------- fotos

/**
 * Puxa a foto numa requisicao so. O cabecalho local tem tamanho variavel,
 * entao pede-se folga na frente e corta-se depois de ler quanto ele ocupa --
 * duas requisicoes por foto dobrariam o tempo do lote a troco de nada.
 */
const FOLGA = 512

async function baixarFoto([off, comp, metodo]) {
  let buf = await faixa(off, off + 30 + FOLGA + comp - 1)
  const ln = buf.readUInt16LE(26)
  const le = buf.readUInt16LE(28)
  const ini = 30 + ln + le
  // Cabecalho maior que a folga e raro; quando acontece, pede o que faltou.
  if (ini + comp > buf.length) buf = await faixa(off + ini, off + ini + comp - 1).then((b) => Buffer.concat([buf.subarray(0, ini), b]))
  const bruto = buf.subarray(ini, ini + comp)
  return metodo === 8 ? zlib.inflateRawSync(bruto) : bruto
}

async function aplicarFoto(produto, ean, img) {
  if (img[0] !== 0xFF || img[1] !== 0xD8) return 'nao e jpeg'
  if (img.length > 3 * 1024 * 1024) return 'acima de 3 MB' // o bucket recusa

  const nomeArquivo = `pdv-${ean}.jpg`
  const up = await fetch(`${URL_SB}/storage/v1/object/produtos/${nomeArquivo}`, {
    method: 'POST',
    headers: { apikey: CHAVE, Authorization: 'Bearer ' + CHAVE, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: img,
    signal: AbortSignal.timeout(PRAZO),
  })
  if (!up.ok) return 'upload: ' + (await up.text()).slice(0, 120)

  const patch = await fetch(`${URL_SB}/rest/v1/products?id=eq.${produto.id}`, {
    method: 'PATCH', headers: h, body: JSON.stringify({ image_path: nomeArquivo }),
    signal: AbortSignal.timeout(PRAZO),
  })
  if (!patch.ok) return 'patch: ' + (await patch.text()).slice(0, 120)
  return null
}

// ---------------------------------------------------------------- catalogo

/**
 * A mesma mercadoria aparece ora como UPC-A de 12 digitos, ora como EAN-13
 * com zero na frente, ora como GTIN-14 da caixa. Conferir as variantes nao
 * custa requisicao nenhuma -- o indice esta na memoria.
 */
function variantes(c) {
  const l = [c]
  if (c.length === 12) l.push('0' + c)
  if (c.length === 13) { l.push('0' + c); if (c[0] === '0') l.push(c.slice(1)) }
  if (c.length === 14 && c[0] === '0') l.push(c.slice(1))
  return l
}

async function produtosPendentes() {
  const todos = []
  for (let off = 0; ; off += PAGINA) {
    const r = await fetch(
      `${URL_SB}/rest/v1/products?select=id,name,barcode&barcode=not.is.null&image_path=is.null&order=id&limit=${PAGINA}&offset=${off}`,
      { headers: h, signal: AbortSignal.timeout(PRAZO) },
    )
    if (!r.ok) throw new Error('consulta falhou: ' + (await r.text()).slice(0, 200))
    const p = await r.json()
    todos.push(...p)
    if (p.length < PAGINA) return todos
  }
}

// ---------------------------------------------------------------- execucao

;(async () => {
  const arg = process.argv[2]
  const limite = arg && !arg.startsWith('--') ? Number(arg) : Infinity
  const aplicar = process.argv.includes('--aplicar')

  const mapa = fs.existsSync(INDICE)
    ? JSON.parse(fs.readFileSync(INDICE, 'utf8'))
    : await montarIndice()

  const pendentes = await produtosPendentes()

  const casados = []
  for (const p of pendentes) {
    const c = String(p.barcode).trim()
    for (const v of variantes(c)) {
      if (mapa[v]) { casados.push({ ...p, ean: v, entrada: mapa[v] }); break }
    }
  }

  const bytes = casados.reduce((s, c) => s + c.entrada[1], 0)
  console.log(
    `${aplicar ? 'APLICANDO' : 'simulacao'} | sem foto: ${pendentes.length} | ` +
    `com foto na base: ${casados.length} (${(casados.length / pendentes.length * 100).toFixed(1)}%) | ` +
    `${(bytes / 1e6).toFixed(0)} MB no total` +
    (limite === Infinity ? '' : ` | limite desta rodada: ${limite}`),
  )

  const fila = casados.slice(0, limite === Infinity ? undefined : limite)
  const inicio = Date.now()
  let subiu = 0, falhou = 0

  for (const [i, p] of fila.entries()) {
    try {
      const img = await baixarFoto(p.entrada)
      if (!aplicar) {
        console.log(`  ${p.ean}  ${String(Math.round(img.length / 1024)).padStart(4)} KB  ${p.name.slice(0, 45)}`)
        subiu++
      } else {
        const erro = await aplicarFoto(p, p.ean, img)
        if (erro) { falhou++; console.log('  falhou', p.ean, erro) } else { subiu++ }
      }
    } catch (e) {
      falhou++
      console.log('  erro', p.ean, String(e).slice(0, 100))
    }
    await espera(150) // nao castiga o Drive
    if (aplicar && (i + 1) % 50 === 0) {
      const min = (Date.now() - inicio) / 60000
      console.log(`  ... ${i + 1}/${fila.length} em ${min.toFixed(1)} min | ${((i + 1) / min).toFixed(0)}/min`)
    }
  }

  const min = (Date.now() - inicio) / 60000
  console.log(
    `\nfim em ${min.toFixed(1)} min | ${aplicar ? 'subiram' : 'encontradas'}: ${subiu} | falharam: ${falhou}`,
  )
})()
