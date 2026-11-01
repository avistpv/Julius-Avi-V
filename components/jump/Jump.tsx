'use client';
import { useEffect, useRef, useState } from 'react';
import { store } from '@/lib/store';
import { scramble } from '@/lib/scramble';
import {
  OPENING, PUSH_FROM, PUSH_TO, REVEAL_END, STEPS, VALUES, VALUES_FROM, VALUES_TO,
  range, smooth,
} from './phases';
import styles from './Jump.module.css';

// III · VIRTVTES — a painted triumphal arch revealed under the torn paper of the work grid.
// Scrolling pushes the camera through its opening into the Roman landscape (2.5D: the arch
// grows much faster than the landscape behind it), where Veni / Vidi / Vici and the values appear.
export default function Jump() {
  const [step, setStep] = useState(-1);
  const [values, setValues] = useState(false);
  const [intro, setIntro] = useState(false);
  const archRef = useRef<HTMLDivElement>(null);
  const landRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const latinRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const valueRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll-linked layer transforms, written straight to the DOM every frame.
  useEffect(() => {
    let raf = 0;
    let s = -2, v: boolean | null = null, i: boolean | null = null;
    const m = { x: 0, y: 0 };
    const loop = () => {
      const p = store.jump;
      m.x += (store.mouse.x - m.x) * 0.06;
      m.y += (store.mouse.y - m.y) * 0.06;

      const reveal = smooth(range(p, 0, REVEAL_END));
      const push = range(p, PUSH_FROM, PUSH_TO);
      const after = range(p, PUSH_TO, 1);

      // Arch: settles while the paper tears away, then flies past exponentially fast.
      const archScale = (1.1 - 0.1 * reveal) * Math.pow(14, push * push);
      if (archRef.current) {
        const a = archRef.current;
        a.style.transform =
          `translate(-50%, -50%) translate(${(-m.x * 12 * (1 - push)).toFixed(1)}px, ${(m.y * 8 * (1 - push)).toFixed(1)}px) scale(${archScale.toFixed(4)})`;
        a.style.opacity = (1 - range(push, 0.8, 1)).toFixed(3);
        a.style.visibility = push >= 1 ? 'hidden' : 'visible';
      }
      // Landscape: far away, moves little — a slow zoom-out as we enter, then a gentle drift.
      const landScale = 1.32 - 0.3 * smooth(push) + 0.06 * after;
      if (landRef.current) {
        landRef.current.style.transform =
          `translate(${(-m.x * 5).toFixed(1)}px, ${(m.y * 4 - after * 30).toFixed(1)}px) scale(${landScale.toFixed(4)})`;
      }
      // Seen through the arch the landscape is a touch darker; it brightens once we're through.
      if (shadeRef.current) shadeRef.current.style.opacity = (0.35 * (1 - smooth(push))).toFixed(3);

      const ns = STEPS.findIndex((st) => p >= st.from && p < st.to);
      const nv = p >= VALUES_FROM && p < VALUES_TO;
      const ni = p > REVEAL_END * 0.6 && p < PUSH_FROM + 0.03;
      if (ns !== s) { s = ns; setStep(ns); }
      if (nv !== v) { v = nv; setValues(nv); }
      if (ni !== i) { i = ni; setIntro(ni); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Decode each new line from random glyphs.
  useEffect(() => {
    if (step < 0 || !latinRef.current || !lineRef.current) return;
    const a = scramble(latinRef.current, STEPS[step].latin.toUpperCase(), 520);
    const b = scramble(lineRef.current, STEPS[step].line.toUpperCase(), 760);
    return () => { a(); b(); };
  }, [step]);

  useEffect(() => {
    if (!values) return;
    const stops = VALUES.flatMap((val, k) => {
      const el = valueRefs.current[k];
      if (!el) return [];
      const t = el.querySelector<HTMLElement>('[data-v-title]')!;
      const x = el.querySelector<HTMLElement>('[data-v-text]')!;
      return [scramble(t, val.title, 500 + k * 120), scramble(x, val.text, 800 + k * 120)];
    });
    return () => stops.forEach((f) => f());
  }, [values]);

  return (
    <section className={styles.jump} data-jump aria-label="How we work">
      <div className={styles.stage}>
        <div ref={landRef} className={styles.land} aria-hidden />
        <div ref={shadeRef} className={styles.shade} aria-hidden />
        <div
          ref={archRef}
          className={styles.arch}
          style={{ transformOrigin: `${OPENING.x * 100}% ${OPENING.y * 100}%` }}
          aria-hidden
        >
          <span className={styles.inscription}>Veni · Vidi · Vici</span>
        </div>

        <div className={`${styles.intro} ${intro ? styles.on : ''}`}>
          <span className="roman">III · Virtvtes</span>
          <span className="mono">From idea to launch. Scroll to enter.</span>
        </div>

        <h2 className={`${styles.step} ${step >= 0 ? styles.on : ''}`} aria-live="polite">
          <span className={`roman ${styles.gate}`}>{step >= 0 ? `Porta ${['I', 'II', 'III'][step]}` : ''}</span>
          <span ref={latinRef} className={styles.latin} />
          <span ref={lineRef} className={styles.line} />
        </h2>

        <div className={`${styles.values} ${values ? styles.on : ''}`}>
          {VALUES.map((v, k) => (
            <div
              key={v.title}
              ref={(el) => { valueRefs.current[k] = el; }}
              className={styles.value}
              style={{ transitionDelay: `${k * 0.08}s` }}
            >
              <span className="roman">{['I', 'II', 'III', 'IV'][k]}</span>
              <span data-v-title>{v.title}</span>
              <span data-v-text>{v.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
