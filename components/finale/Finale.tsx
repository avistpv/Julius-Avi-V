'use client';
import { useEffect, useRef, useState } from 'react';
import { store } from '@/lib/store';
import styles from './Finale.module.css';

// IV · NUMERI → V · COLLOQUIUM. One pinned stage, two layers: the dark night with the numbers
// and the testimonial, and the light paper with the call form. Scrolling grows a light disc out
// of the dot beside the heading until it swallows the screen (the base1 reveal), and the page
// stays light from there on.
const NUMBERS = [
  { value: 140, suffix: '+', label: 'products launched' },
  { value: 5, suffix: '', label: 'years, one roof' },
  { value: 11, suffix: '', label: 'people, start to finish' },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);

export default function Finale() {
  const root = useRef<HTMLElement>(null);
  const light = useRef<HTMLDivElement>(null);
  const dark = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const numRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [counted, setCounted] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { window.dispatchEvent(new Event('layout')); }, []);

  useEffect(() => {
    let raf = 0;
    let last = -1;
    let countedLocal = false;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!store.finaleOn) return;
      const vh = window.innerHeight, vw = window.innerWidth;
      const p = store.finale;
      if (p === last) return;
      last = p;
      if (!countedLocal && p > 0.02) { countedLocal = true; setCounted(true); }

      // The disc grows out of the dot until it covers the farthest corner.
      const cx = store.dot.x || vw / 2;
      const cy = store.dot.y || vh / 2;
      const maxR = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy)) + 20;
      const grow = smooth(range(p, 0.3, 0.72));
      const rad = grow * maxR;
      if (light.current) {
        light.current.style.clipPath = `circle(${rad.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
        light.current.style.setProperty('--in', smooth(range(p, 0.55, 0.9)).toFixed(3));
      }
      if (dark.current) {
        // The night recedes a touch as the light takes over.
        dark.current.style.setProperty('--out', grow.toFixed(3));
        dark.current.style.setProperty('--mx', (store.mouse.x * 10).toFixed(1));
        dark.current.style.setProperty('--my', (store.mouse.y * -8).toFixed(1));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Count up once the section arrives.
  useEffect(() => {
    if (!counted) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      const e = 1 - Math.pow(1 - t, 3);
      NUMBERS.forEach((n, k) => {
        const el = numRefs.current[k];
        if (el) el.textContent = `${Math.round(n.value * e)}${n.suffix}`;
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [counted]);

  return (
    <section ref={root} className={styles.finale} data-finale aria-label="Numbers and contact">
      {/* Nav target: sits one screen above the section end, so #contact lands on the open form. */}
      <span id="contact" className={styles.contactAnchor} aria-hidden />
      <div className={styles.stage}>
        {/* ---------- dark: numbers + testimonial ---------- */}
        <div ref={dark} className={styles.dark} data-cursor="ring">
          <div className={styles.stars} aria-hidden />
          <div className={styles.darkInner}>
            <span className={`roman ${styles.kicker}`}>IV · Numeri</span>
            <h2 className={styles.darkTitle}>
              <span ref={dot} className={styles.dot} data-finale-dot aria-hidden />
              Five years in.
            </h2>
            <div className={styles.numbers}>
              {NUMBERS.map((n, k) => (
                <div key={n.label} className={styles.num}>
                  <span ref={(el) => { numRefs.current[k] = el; }} className={styles.value}>0{n.suffix}</span>
                  <span className={`mono ${styles.numLabel}`}>{n.label}</span>
                </div>
              ))}
            </div>
            <blockquote className={styles.quote}>
              <p>
                “I've been working with Julius for four years. They built several internal systems
                that run across our group of companies.”
              </p>
              <footer className="mono">— Nevo Adisol, CEO</footer>
            </blockquote>
          </div>
        </div>

        {/* ---------- light: the call form (revealed by the disc) ---------- */}
        <div ref={light} className={styles.light} data-cursor="default">
          <div className={styles.lightInner}>
            <div className={styles.lightCol}>
              <span className={`roman ${styles.kicker}`}>V · Colloquium</span>
              <h2 className={styles.lightTitle}>
                <span>Got an idea?</span>
                <span>Let's ship it.</span>
              </h2>
              <p className={`mono ${styles.lead}`}>
                A 30-minute call. You talk, we listen — then we tell you what it takes to launch.
                Reply within one working day.
              </p>
              <p className={`mono ${styles.meta}`}>Petah Tikva · Israel · Est. MMXXI</p>
            </div>

            <form
              className={styles.form}
              onSubmit={(e) => { e.preventDefault(); setSent(true); }}
              aria-label="Book a call"
            >
              <label className={styles.field}>
                <span className={`mono ${styles.label}`}>Name</span>
                <input name="name" type="text" autoComplete="name" required placeholder="Gaius Julius" />
              </label>
              <label className={styles.field}>
                <span className={`mono ${styles.label}`}>Email or phone</span>
                <input name="contact" type="text" autoComplete="email" required placeholder="you@company.com" />
              </label>
              <label className={styles.field}>
                <span className={`mono ${styles.label}`}>Company</span>
                <input name="company" type="text" autoComplete="organization" placeholder="Optional" />
              </label>
              <label className={`${styles.field} ${styles.wide}`}>
                <span className={`mono ${styles.label}`}>What are you building?</span>
                <textarea name="idea" rows={3} placeholder="A CRM, a marketplace, an app — or just a hunch." />
              </label>
              <fieldset className={`${styles.field} ${styles.wide} ${styles.when}`}>
                <legend className={`mono ${styles.label}`}>Best time to call</legend>
                {['Morning', 'Afternoon', 'Evening'].map((t, i) => (
                  <label key={t} className={`mono ${styles.chip}`}>
                    <input type="radio" name="when" value={t.toLowerCase()} defaultChecked={i === 0} />
                    <span>{t}</span>
                  </label>
                ))}
              </fieldset>
              <button type="submit" className={`${styles.submit} ${sent ? styles.isSent : ''}`} disabled={sent}>
                <span className={styles.submitText}>{sent ? 'Veni. We’ll call you.' : 'Book a call'}</span>
                <span className={styles.submitArrow} aria-hidden>{sent ? '✓' : '→'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
