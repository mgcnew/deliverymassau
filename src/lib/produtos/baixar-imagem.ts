import 'server-only'

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * Baixa uma imagem a partir de uma URL que o usuario digitou.
 *
 * Fazer o servidor buscar uma URL escolhida por quem usa o sistema e um
 * buraco conhecido (SSRF): sem trava, o campo vira um jeito de usar o nosso
 * servidor como sonda para dentro da nossa propria rede -- 127.0.0.1, a
 * faixa 10.x da VPC, ou o endereco de metadados da nuvem (169.254.169.254),
 * que em varios provedores entrega credencial para quem perguntar.
 *
 * O painel e so da equipe, entao o risco aqui e baixo. As travas ficam
 * porque sao baratas, nao porque a ameaca e grande:
 *
 *   - so https (http em rede interna e justamente o caso perigoso)
 *   - o nome e resolvido ANTES de conectar, e endereco privado, de loopback,
 *     link-local ou reservado e recusado
 *   - redirecionamento e seguido a mao, revalidando cada parada: seguir
 *     automatico deixaria um site externo empurrar a conexao para dentro
 *   - o tamanho e contado enquanto baixa, sem confiar no Content-Length,
 *     que o outro lado escreve como quiser
 *   - prazo curto, para uma URL que aceita e nunca responde nao segurar o
 *     formulario para sempre
 *
 * Fica de fora o DNS rebinding: entre a nossa checagem e a conexao do fetch
 * ha uma segunda resolucao, e um servidor hostil pode responder diferente
 * nas duas. Fechar isso exigiria fixar o IP na conexao, o que quebra a
 * validacao do certificado TLS. Para um campo que so a equipe alcanca, o
 * custo nao paga.
 */

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const TAMANHO_MAXIMO = 3 * 1024 * 1024
const PRAZO = 15000
const MAXIMO_REDIRECIONAMENTOS = 3

export type ResultadoDownload = { arquivo: File } | { erro: string }

/** Faixas que nunca devem ser alcancadas a partir de uma URL digitada. */
function enderecoProibido(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase()
    // ::1 (loopback), fc00::/7 (unico local), fe80::/10 (link-local)
    if (v6 === '::1' || v6 === '::') return true
    if (/^f[cd]/.test(v6)) return true
    if (/^fe[89ab]/.test(v6)) return true
    // ::ffff:10.0.0.1 e afins: IPv4 disfarcado de IPv6
    const embutido = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (embutido) return enderecoProibido(embutido[1])
    return false
  }

  const [a, b] = ip.split('.').map(Number)
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // link-local e metadados da nuvem
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast e reservado
  return false
}

async function validarDestino(url: URL): Promise<string | null> {
  if (url.protocol !== 'https:') return 'Use um endereco https.'

  // IP escrito direto na URL nao passa por DNS. Sem este caso, "https://[::1]/"
  // seria recusado so porque o lookup falha com os colchetes -- funcionaria
  // por acidente, e um IPv6 publico literal cairia junto.
  const literal = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(literal)) {
    return enderecoProibido(literal) ? 'Esse endereco aponta para a rede interna e foi recusado.' : null
  }

  // Todos os enderecos do nome, nao so o primeiro: um nome pode apontar
  // para um endereco publico e outro interno ao mesmo tempo.
  let enderecos: Array<{ address: string }>
  try {
    enderecos = await lookup(url.hostname, { all: true })
  } catch {
    return 'Nao consegui resolver esse endereco.'
  }

  if (enderecos.length === 0) return 'Nao consegui resolver esse endereco.'
  if (enderecos.some((e) => enderecoProibido(e.address))) {
    return 'Esse endereco aponta para a rede interna e foi recusado.'
  }
  return null
}

/** Confere o comeco do arquivo: o Content-Type e so o que o outro lado diz. */
function pareceImagem(bytes: Uint8Array): boolean {
  const eq = (pos: number, ...esperado: number[]) => esperado.every((b, i) => bytes[pos + i] === b)
  if (eq(0, 0xff, 0xd8, 0xff)) return true // jpeg
  if (eq(0, 0x89, 0x50, 0x4e, 0x47)) return true // png
  if (eq(0, 0x47, 0x49, 0x46, 0x38)) return true // gif
  if (eq(0, 0x52, 0x49, 0x46, 0x46) && eq(8, 0x57, 0x45, 0x42, 0x50)) return true // webp
  if (eq(4, 0x66, 0x74, 0x79, 0x70)) return true // avif e outros do familia ISO-BMFF
  return false
}

export async function baixarImagemDeUrl(endereco: string): Promise<ResultadoDownload> {
  let url: URL
  try {
    url = new URL(endereco)
  } catch {
    return { erro: 'Endereco de imagem invalido.' }
  }

  let resposta: Response
  for (let salto = 0; ; salto++) {
    const problema = await validarDestino(url)
    if (problema) return { erro: problema }

    try {
      resposta = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(PRAZO),
        headers: { Accept: 'image/*' },
      })
    } catch {
      return { erro: 'Nao consegui baixar a imagem desse endereco.' }
    }

    if (resposta.status < 300 || resposta.status >= 400) break

    const destino = resposta.headers.get('location')
    if (!destino) return { erro: 'O endereco respondeu com um redirecionamento sem destino.' }
    if (salto >= MAXIMO_REDIRECIONAMENTOS) return { erro: 'Redirecionamentos demais nesse endereco.' }
    try {
      url = new URL(destino, url)
    } catch {
      return { erro: 'O endereco redirecionou para um destino invalido.' }
    }
  }

  if (!resposta.ok) return { erro: `O endereco respondeu com erro ${resposta.status}.` }

  const tipo = (resposta.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!TIPOS_ACEITOS.includes(tipo)) {
    return { erro: 'Esse endereco nao devolveu uma imagem (JPG, PNG, WEBP, AVIF ou GIF).' }
  }

  // Le em pedacos contando o tamanho: o Content-Length pode vir mentindo, ou
  // nem vir, e ai um arquivo enorme entraria inteiro na memoria.
  const corpo = resposta.body
  if (!corpo) return { erro: 'Esse endereco nao devolveu conteudo.' }

  const pedacos: Uint8Array[] = []
  let total = 0
  const leitor = corpo.getReader()
  try {
    for (;;) {
      const { done, value } = await leitor.read()
      if (done) break
      total += value.length
      if (total > TAMANHO_MAXIMO) {
        await leitor.cancel()
        return { erro: 'A imagem desse endereco passa de 3 MB.' }
      }
      pedacos.push(value)
    }
  } catch {
    return { erro: 'A conexao caiu durante o download da imagem.' }
  }

  if (total === 0) return { erro: 'Esse endereco devolveu um arquivo vazio.' }

  const bytes = new Uint8Array(total)
  let posicao = 0
  for (const pedaco of pedacos) {
    bytes.set(pedaco, posicao)
    posicao += pedaco.length
  }

  if (!pareceImagem(bytes)) {
    return { erro: 'O arquivo desse endereco nao e uma imagem de verdade.' }
  }

  const extensao = tipo === 'image/jpeg' ? 'jpg' : tipo.split('/')[1]
  return { arquivo: new File([bytes], `url.${extensao}`, { type: tipo }) }
}
