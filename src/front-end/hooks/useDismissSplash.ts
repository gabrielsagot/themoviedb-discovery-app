import { useEffect } from 'react';

// Timestamp of the first module evaluation: the splash screen stays up for
// at least a moment after it, so a fast page load doesn't make it flash
// past before anyone can read it.
const APP_STARTED_AT = Date.now();
const MIN_SPLASH_MS = 700;
const SPLASH_FADE_MS = 450;

/**
 * Takes down the splash screen once `ready` is true. It's plain DOM work
 * because the splash lives in index.html, painted before React even boots,
 * and is taken down the same way regardless of which "page" ends up
 * rendering (the main app once its first load settles, or a page with
 * nothing to wait for, like the 404 page, right away).
 */
export function useDismissSplash(ready: boolean) {
  useEffect(() => {
    if (!ready) return;

    const splash = document.getElementById('splash');
    if (!splash || splash.dataset.hiding === '1') return;

    const remaining = Math.max(
      0,
      MIN_SPLASH_MS - (Date.now() - APP_STARTED_AT),
    );
    const timer = window.setTimeout(() => {
      splash.dataset.hiding = '1';
      window.setTimeout(() => splash.remove(), SPLASH_FADE_MS);
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [ready]);
}
