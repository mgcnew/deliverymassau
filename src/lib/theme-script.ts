/**
 * Roda inline, antes do primeiro paint, para decidir claro/escuro sem piscar:
 * usa a escolha salva ou, na ausencia dela, o tema do sistema.
 */
export const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('theme');
  var escuro = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', escuro);
} catch (e) {}
`
