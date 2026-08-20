// Service worker minimo: so cuida do essencial pra instalar como app e dar
// uma resposta melhor que "sem internet" quando a rede falha. NAO cacheia
// nada de dado (produtos, precos, pedidos) -- isso tem que vir sempre
// fresco do Supabase, cache antigo aqui seria ativamente enganoso pro
// cliente (preco errado, produto que ja acabou etc).
const CACHE = 'massa24h-v1'
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
