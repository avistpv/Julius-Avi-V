'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { store } from '@/lib/store';
import { scramble } from '@/lib/scramble';
import { CROSS, STEPS, VALUES, VALUES_FROM, VALUES_TO, worldAt } from './phases';
import SceneBoundary from '@/components/hero/SceneBoundary';
import styles from './Jump.module.css';

const JumpScene = dynamic(() => import('./JumpScene'), { ssr: false });

// III · VIRTVTES — "Roman gates". A pinned stage several screens long: the camera flies through
// three glass triumphal arches (Veni, Vidi, Vici); each one teleports the world behind it
// (light sky -> golden hour -> violet dusk -> open space). In space, the values float around
// the laurel, and we land on the team ("Legio").
export default function Jump() {
  const [step, setStep] = useState(-1);
  const [values, setValues] = useState(false);
  const [intro, setIntro] = useState(true);
  const [dark, setDark] = useState(false);
  const latinRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const valueRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Watch scroll progress; touch React state only when a phase actually changes.
  useEffect(() => {
    let raf = 0;
    let s = -2, v: boolean | null = null, i: boolean | null = null, d: boolean | null = null;
    const loop = () => {
      const j = store.jump;
      const ns = STEPS.findIndex((st) => j >= st.from && j < st.to);
      const nv = j >= VALUES_FROM && j < VALUES_TO;
      const ni = j < 0.05;
      const nd = worldAt(j) > 1.5; // violet dusk and space -> light text
      if (ns !== s) { s = ns; setStep(ns); }
      if (nv !== v) { v = nv; setValues(nv); }
      if (ni !== i) { i = ni; setIntro(ni); }
      if (nd !== d) { d = nd; setDark(nd); }
      // A short white flash as the camera crosses each gate.
      let f = 0;
      for (const c of CROSS) f = Math.max(f, Math.exp(-Math.abs(j - c) / 0.005));
      if (flashRef.current) flashRef.current.style.opacity = (f * 0.85).toFixed(3);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Decode the new line from random glyphs each time the step changes.
  useEffect(() => {
    if (step < 0 || !latinRef.current || !lineRef.current) return;
    // At the gates the Latin word is carved on the arch itself; only the finale shows it as text.
    const latin = step === STEPS.length - 1 ? STEPS[step].latin.toUpperCase() : '';
    latinRef.current.textContent = '';
    const a = latin ? scramble(latinRef.current, latin, 520) : () => {};
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
    <section className={`${styles.jump} ${dark ? styles.dark : ''}`} data-jump aria-label="How we work">
      <div className={styles.stage}>
        <SceneBoundary fallback={<div className={styles.fallback} aria-hidden />}>
          <JumpScene />
        </SceneBoundary>

        <div className={`${styles.intro} ${intro ? styles.on : ''}`}>
          <span className="roman">III · Virtvtes</span>
          <span className="mono">Three gates from idea to launch. Scroll to pass.</span>
        </div>

        <h2 className={`${styles.step} ${step >= 0 ? styles.on : ''}`} aria-live="polite">
          <span className={`roman ${styles.gate}`}>{step >= 0 && step < 3 ? `Porta ${['I', 'II', 'III'][step]}` : ''}</span>
          <span ref={latinRef} className={styles.latin} />
          <span ref={lineRef} className={styles.line} />
        </h2>

        <div className={`${styles.values} ${values ? styles.on : ''}`}>
          {VALUES.map((v, k) => (
            <div
              key={v.title}
              ref={(el) => { valueRefs.current[k] = el; }}
              className={styles.value}
              style={{ left: `${v.x}%`, top: `${v.y}%`, transitionDelay: `${k * 0.08}s` }}
            >
              <span data-v-title>{v.title}</span>
              <span data-v-text>{v.text}</span>
            </div>
          ))}
        </div>

        <div ref={flashRef} className={styles.flash} aria-hidden />
      </div>
    </section>
  );
}
