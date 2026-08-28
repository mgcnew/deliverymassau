// Service worker minimo: so cuida do essencial pra instalar como app e dar
// uma resposta melhor que "sem internet" quando a rede falha. NAO cacheia
// nada de dado (produtos, precos, pedidos) -- isso tem que vir sempre
// fresco do Supabase, cache antigo aqui seria ativamente enganoso pro
// cliente (preco errado, produto que ja acabou etc).
const CACHE = 'massa24h-v2'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (evento) => {
  self.skipWaiting()
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request
  if (requisicao.method !== 'GET') return

  // So navegacao de pagina ganha fallback offline. Tudo o mais (API,
  // imagens, js, css) passa direto pra rede, sem interceptar.
  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      fetch(requisicao).catch(() => caches.match(OFFLINE_URL)),
    )
  }
})

// --- Aviso de pedido novo -----------------------------------------------
// Com o app fechado, este e o unico codigo do sistema que ainda roda: o
// navegador acorda o service worker so para entregar o aviso.

self.addEventListener('push', (evento) => {
  // Payload sempre vem do nosso servidor (lib/push/enviar.ts). Se vier
  // quebrado, ainda assim mostra algo -- notificacao vazia e pior que
  // generica, e o Android cobra que TODO push vire notificacao visivel.
  let dados = {}
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = {}
  }

  const titulo = dados.titulo || 'Mercado Massau 24h'
  const opcoes = {
    body: dados.corpo || 'Novo pedido esperando entregador.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Vibra mesmo com o celular no bolso: curto-pausa-curto.
    vibrate: [200, 100, 200],
    // Mesma tag substitui o aviso anterior em vez de empilhar cinco avisos
    // na tela de quem estava dirigindo.
    tag: dados.tag || 'entrega',
    renotify: true,
    requireInteraction: true,
    data: { url: dados.url || '/painel/entregas' },
  }

  evento.waitUntil(self.registration.showNotification(titulo, opcoes))
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = (evento.notification.data && evento.notification.data.url) || '/painel/entregas'

  // Se o painel ja estiver aberto em alguma janela, foca aquela em vez de
  // abrir uma nova - senao o entregador junta abas repetidas ao longo do dia.
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (janela.url.includes('/painel') && 'focus' in janela) {
          janela.navigate(destino)
          return janela.focus()
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})
