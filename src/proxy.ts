import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLICO_NO_PAINEL = ['/painel/login', '/painel/setup']

// No Next 16 o antigo middleware chama-se proxy.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Renova a sessao. Checagem otimista: quem manda mesmo sao o layout e a RLS.
  //
  // getClaims() em vez de getUser(): as chaves deste projeto sao ES256
  // (assimetricas), entao a assinatura do JWT e conferida localmente, sem
  // ida de rede ao Supabase Auth. getUser() sempre bate no servidor -- eram
  // ~60-100ms cravados em TODA navegacao do painel, e o proxy roda tambem
  // nas requisicoes RSC. A verificacao continua criptografica (nao e o
  // getSession(), que so le o cookie sem validar), e getClaims renova a
  // sessao sozinho quando o token esta perto de expirar.
  const { data: claims } = await supabase.auth.getClaims()
  const user = claims?.claims ?? null

  const { pathname } = request.nextUrl
  const areaInterna = pathname.startsWith('/painel')
  const liberada = PUBLICO_NO_PAINEL.some((p) => pathname.startsWith(p))

  if (areaInterna && !liberada && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/painel/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (pathname === '/painel/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/painel'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

// So a area interna precisa de sessao/cookie. A loja publica (a maior parte
// do trafego) nao autentica ninguem - fazer o proxy rodar auth.getUser()
// (uma ida de rede ao Supabase Auth) em toda pagina do site custava 100-300ms
// por navegacao mesmo para quem nunca faz login. Restrito a /painel = zero
// custo de autenticacao para clientes.
export const config = {
  matcher: ['/painel/:path*'],
}
