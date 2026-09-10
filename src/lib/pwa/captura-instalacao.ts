/**
 * Roda inline no <head>, antes da hidratacao.
 *
 * O Chrome/Edge do Android avisa que a loja pode ser instalada disparando
 * `beforeinstallprompt` UMA vez por carregamento - muitas vezes antes de o
 * React montar qualquer componente. Quem ouvisse so depois perderia o evento
 * e o botao "Instalar" nunca funcionaria. Aqui ele fica guardado em
 * window.__pedidoInstalacao ate o convite da loja (convite-instalar.tsx) usar.
 *
 * O preventDefault troca a faixinha generica do Chrome pelo nosso convite,
 * que fala a lingua do cliente.
 */
export const CAPTURA_INSTALACAO_SCRIPT = `
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__pedidoInstalacao = e;
  window.dispatchEvent(new Event('massa24h-instalavel'));
});
window.addEventListener('appinstalled', function () {
  window.__pedidoInstalacao = null;
  window.dispatchEvent(new Event('massa24h-instalavel'));
});
`
