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
  themeColor: '#d61f2b',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
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
