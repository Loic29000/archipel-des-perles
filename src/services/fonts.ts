// Web: load the families from Google Fonts once; text falls back to system fonts until they arrive.
const HREF = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700&family=Figtree:wght@400;600;700&family=JetBrains+Mono:wght@500;700&display=swap';

export function useGameFonts() {
  if (typeof document !== 'undefined' && !document.querySelector(`link[href="${HREF}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = HREF;
    document.head.appendChild(link);
  }
  return true;
}
