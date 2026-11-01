// Respect the OS "reduce motion" setting — in production only. While developing, motion is always
// on so the site can be checked without flipping Windows settings; `?motion=1` forces it on anywhere.
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV !== 'production') return false;
  if (new URLSearchParams(window.location.search).get('motion') === '1') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
