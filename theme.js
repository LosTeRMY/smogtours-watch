// Chargé en <head> (script classique) pour appliquer le thème avant le premier affichage.
// localStorage est partagé entre toutes les pages de l'extension.
(() => {
  let theme = null;
  try { theme = localStorage.getItem('theme'); } catch {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;

  window.setTheme = (t) => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch {}
  };

  // Le popup suit un changement fait depuis la bibliothèque.
  addEventListener('storage', (e) => {
    if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
      document.documentElement.dataset.theme = e.newValue;
    }
  });
})();
