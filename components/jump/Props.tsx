'use client';
import { useEffect, useRef } from 'react';
import { store } from '@/lib/store';
import { STEPS, range } from './phases';
import styles from './Props.module.css';

// Floating objects for each word, like the Editions' UI cards drifting over the paintings.
// Each one lives at a depth: deeper = smaller moves. They rise with the scroll and follow the mouse.
// VENI (we listen): the client's words. VIDI (we design): Figma. VICI (we ship): the release.
type Prop = {
  step: number;
  x: number; // % of the stage
  y: number;
  depth: number; // 0.4 (far) .. 1.4 (near)
  rot?: number;
  node: React.ReactNode;
};

const PROPS: Prop[] = [
  // VENI — we listen
  { step: 0, x: 9, y: 46, depth: 0.9, rot: -3, node: (
    <div className={`${styles.card} ${styles.note}`}>
      <span className={`mono ${styles.small}`}>Brief · 09:14</span>
      <p>“We need a CRM our sales team will actually open.”</p>
    </div>
  ) },
  { step: 0, x: 68, y: 44, depth: 1.2, node: (
    <div className={`${styles.card} ${styles.wave}`} aria-hidden>
      {Array.from({ length: 22 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 7) * -0.13}s`, height: `${30 + ((i * 37) % 60)}%` }} />)}
      <span className={`mono ${styles.small}`}>00:42 · rec</span>
    </div>
  ) },
  { step: 0, x: 62, y: 66, depth: 0.6, rot: 2, node: (
    <div className={`${styles.bubble}`}>Can it sync with Priority? <span className={`mono ${styles.small}`}>Nevo</span></div>
  ) },
  { step: 0, x: 22, y: 72, depth: 1.3, node: (
    <div className={`${styles.pill} mono`}>12 questions · 1 call</div>
  ) },

  // VIDI — we design
  { step: 1, x: 8, y: 44, depth: 0.7, node: (
    <div className={styles.frame} style={{ width: 'clamp(150px, 16vw, 260px)', height: 'clamp(100px, 10.5vw, 170px)' }}>
      <i /><i /><i /><i />
      <span className={`mono ${styles.size}`}>1440 × 900</span>
    </div>
  ) },
  { step: 1, x: 68, y: 46, depth: 1.1, rot: 1.5, node: (
    <div className={`${styles.card} ${styles.panel}`}>
      <div className={styles.panelRow}><span>Fill</span><b><i style={{ background: '#2f6bff' }} /> 2F6BFF</b></div>
      <div className={styles.panelRow}><span>Stroke</span><b><i style={{ background: '#0b0c0c' }} /> 1px</b></div>
      <div className={styles.panelRow}><span>Radius</span><b>24</b></div>
      <div className={styles.panelRow}><span>Auto layout</span><b>↓ 16</b></div>
    </div>
  ) },
  { step: 1, x: 31, y: 61, depth: 1.4, node: (
    <div className={styles.cursor}><svg viewBox="0 0 16 20" width="16" height="20"><path d="M1 1l5.5 17 2.5-7 7-2.5z" fill="#2f6bff" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" /></svg><span className="mono">Vlad</span></div>
  ) },
  { step: 1, x: 76, y: 66, depth: 0.8, node: (
    <div className={styles.swatches}>
      {['#c3dcf0', '#f3f2ee', '#2f6bff', '#d6ff3d', '#0b0c0c'].map((c) => <i key={c} style={{ background: c }} />)}
    </div>
  ) },
  { step: 1, x: 52, y: 74, depth: 0.5, rot: -4, node: <div className={styles.shape} /> },

  // VICI — we ship
  { step: 2, x: 10, y: 40, depth: 0.9, node: (
    <div className={`${styles.card} ${styles.terminal} mono`}>
      <span>$ git push origin main</span>
      <span>▸ build · 42s · 0 errors</span>
      <span className={styles.ok}>✓ deployed · prod</span>
    </div>
  ) },
  { step: 2, x: 68, y: 46, depth: 1.3, node: <div className={`${styles.pill} ${styles.lime} mono`}>v1.0.0 · shipped</div> },
  { step: 2, x: 62, y: 64, depth: 0.7, rot: 2, node: (
    <div className={`${styles.card} ${styles.toast}`}>
      <b>Launch day.</b><span className="mono">+1,240 users · first 24h</span>
    </div>
  ) },
  { step: 2, x: 30, y: 70, depth: 1.1, node: (
    <div className={styles.progress}><i /><span className={`mono ${styles.small}`}>100%</span></div>
  ) },
];

export default function Props() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const m = { x: 0, y: 0 };
    const loop = () => {
      const p = store.jump;
      m.x += (store.mouse.x - m.x) * 0.05;
      m.y += (store.mouse.y - m.y) * 0.05;
      PROPS.forEach((pr, k) => {
        const el = refs.current[k];
        if (!el) return;
        const st = STEPS[pr.step];
        // Props live a little longer than the word: enter just before it, leave just after.
        const t = range(p, st.from - 0.02, st.to + 0.02);
        if (t <= 0 || t >= 1) { el.style.opacity = '0'; el.style.visibility = 'hidden'; return; }
        el.style.visibility = 'visible';
        const fade = Math.min(range(t, 0, 0.18), range(t, 1, 0.84));
        el.style.opacity = fade.toFixed(3);
        const rise = (0.5 - t) * 220 * pr.depth; // rises with the scroll, nearer = faster
        const px = m.x * 34 * pr.depth;
        const py = -m.y * 22 * pr.depth;
        const sc = 0.9 + 0.2 * pr.depth * t + 0.1 * fade;
        el.style.transform = `translate(${px.toFixed(1)}px, ${(rise + py).toFixed(1)}px) rotate(${pr.rot ?? 0}deg) scale(${sc.toFixed(3)})`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={styles.layer} aria-hidden>
      {PROPS.map((pr, k) => (
        <div
          key={k}
          ref={(el) => { refs.current[k] = el; }}
          className={styles.prop}
          style={{ left: `${pr.x}%`, top: `${pr.y}%`, zIndex: Math.round(pr.depth * 10) }}
        >
          {pr.node}
        </div>
      ))}
    </div>
  );
}
