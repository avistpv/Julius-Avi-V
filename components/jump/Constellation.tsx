'use client';
import { useEffect, useRef } from 'react';
import { store } from '@/lib/store';
import { scramble } from '@/lib/scramble';
import { VALUES, VALUES_FROM, VALUES_TO, range, smooth } from './phases';
import styles from './Constellation.module.css';

// The four values as a constellation in the night we flew into. As you scroll, a line is drawn
// from star to star; each star flares when the line reaches it and its value decodes beside it.
// The whole chart drifts a little with the mouse (nearer stars more).
const STARS = [
  { x: 14, y: 42, depth: 1.0 },
  { x: 38, y: 24, depth: 0.6 },
  { x: 63, y: 46, depth: 1.3 },
  { x: 86, y: 28, depth: 0.8 },
];

export default function Constellation() {
  const layer = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const line = useRef<SVGPolylineElement>(null);
  const starRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lit = useRef<boolean[]>(STARS.map(() => false));

  useEffect(() => {
    let raf = 0;
    const m = { x: 0, y: 0 };
    const stops: (() => void)[] = [];
    let sized = '';
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = store.jump;
      // Lines live in pixel space (a stretched viewBox would break the dash animation).
      if (svg.current && line.current && layer.current) {
        const W = layer.current.clientWidth, H = layer.current.clientHeight;
        const key = `${W}x${H}`;
        if (key !== sized) {
          sized = key;
          svg.current.setAttribute('viewBox', `0 0 ${W} ${H}`);
          line.current.setAttribute('points', STARS.map((s) => `${(s.x / 100) * W},${(s.y / 100) * H}`).join(' '));
        }
      }
      m.x += (store.mouse.x - m.x) * 0.05;
      m.y += (store.mouse.y - m.y) * 0.05;
      const t = range(p, VALUES_FROM, VALUES_FROM + 0.1); // 0..1 across the values beat (done well before the resting point)
      if (layer.current) {
        layer.current.style.opacity = (range(p, VALUES_FROM - 0.02, VALUES_FROM + 0.03) * (1 - range(p, 0.995, 1.01))).toFixed(3);
        layer.current.style.visibility = p > VALUES_FROM - 0.03 ? 'visible' : 'hidden';
      }
      // The line is drawn in three legs, one per gap between stars.
      if (line.current) line.current.style.strokeDashoffset = (1 - smooth(t)).toFixed(4);
      STARS.forEach((s, k) => {
        const el = starRefs.current[k];
        if (!el) return;
        const on = t >= k / 3 - 0.02;
        el.style.setProperty('--on', on ? '1' : '0');
        el.style.transform = `translate(${(m.x * 26 * s.depth).toFixed(1)}px, ${(-m.y * 18 * s.depth).toFixed(1)}px)`;
        if (on !== lit.current[k]) {
          lit.current[k] = on;
          if (on) {
            const title = el.querySelector<HTMLElement>('[data-title]')!;
            const text = el.querySelector<HTMLElement>('[data-text]')!;
            stops.push(scramble(title, VALUES[k].title, 520), scramble(text, VALUES[k].text, 820));
          }
        }
      });
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); stops.forEach((f) => f()); };
  }, []);

  return (
    <div ref={layer} className={styles.layer} aria-hidden>
      <svg ref={svg} className={styles.lines} viewBox="0 0 100 100">
        <polyline ref={line} pathLength={1} className={styles.line} />
      </svg>
      {STARS.map((s, k) => (
        <div
          key={k}
          ref={(el) => { starRefs.current[k] = el; }}
          className={styles.star}
          style={{ left: `${s.x}%`, top: `${s.y}%`, ['--on' as string]: 0 }}
        >
          <span className={styles.core} />
          <span className={styles.halo} />
          <div className={styles.label}>
            <span className={`roman ${styles.num}`}>{['I', 'II', 'III', 'IV'][k]}</span>
            <span className={styles.title} data-title />
            <span className={styles.text} data-text />
          </div>
        </div>
      ))}
    </div>
  );
}
