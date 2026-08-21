import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { THEME_INIT_SCRIPT } from '@/lib/theme-script'
import { RegistrarServiceWorker } from '@/components/pwa/registrar-sw'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mercado Massa 24h',
  description: 'Delivery do Mercado Massa 24h',
  // Loja e painel sao dois apps diferentes pra quem instala (publico e
  // start_url diferentes) -- cada layout troca esse manifest pelo seu.
  manifest: '/manifest-loja.webmanifest',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mercado Massa 24h',
  },
}

export const viewport: Viewport = {
  // Cor da barra de status do celular. Era o vermelho da marca, sobra da
  // epoca em que o topo do app era vermelho -- hoje o cabecalho e bg-surface,
  // entao a barra combina com ele em cada tema em vez de destoar.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a20' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // data-scroll-behavior: o Next 16 parou de neutralizar sozinho o
    // `scroll-behavior: smooth` do globals.css durante troca de rota, entao
    // a rolagem pro topo virava uma animacao -- navegacao parecia lenta. O
    // atributo devolve o comportamento antigo (rolagem instantanea na
    // navegacao, suave so nas ancoras da loja).
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  )
}
