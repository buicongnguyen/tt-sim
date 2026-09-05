// Runs before styles/React on every chapter to avoid a light flash on navigation.
(() => {
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try {
    const saved = localStorage.getItem('ttsim-theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch { /* System preference remains usable without storage. */ }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
