// Respect the OS "reduce motion" setting. `?motion=1` forces animations on (handy for testing).
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('motion') === '1') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
