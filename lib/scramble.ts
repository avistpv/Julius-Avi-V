// Text "decodes" from random glyphs into the final string, left to right (like the reference's SOMETHIN#).
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=/<>0123456789';

export function scramble(el: HTMLElement, text: string, duration = 700): () => void {
  const start = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const settled = Math.floor(t * text.length);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (i < settled || ch === ' ' || ch === '.' || ch === '—') out += ch;
      else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
