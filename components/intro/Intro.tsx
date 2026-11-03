'use client';
import { Fragment, useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion';
import { store } from '@/lib/store';
import styles from './Intro.module.css';


// Text pieces: plain strings are words; objects are underlined project links.
type Piece = string | { text: string; href: string };

const LEAD: Piece[] = [
  'We turn rough ideas into products people actually use — strategy, design and engineering under one roof, with AI built into how we work.',
];

const MORE: Piece[] = [
  'Since MMXXI we have shipped 140+ of them:',
  { text: 'Solya', href: '/work/solya' },
  ',',
  { text: 'BuyByPower', href: '/work/buybypower' },
  ',',
  { text: 'Mifrat', href: '/work/mifrat' },
  ',',
  { text: 'FindMe', href: '/work/findme' },
  '— and the internal systems that run whole groups of companies.',
];

// Split into word spans so each word can light up on its own as you scroll.
function Words({ pieces }: { pieces: Piece[] }) {
  return (
    <>
      {pieces.map((p, i) => {
        if (typeof p !== 'string') {
          return (
            <Fragment key={i}>
              {i > 0 && ' '}
              <a href={p.href} className={styles.link} data-word data-strong>
                {p.text}
              </a>
            </Fragment>
          );
        }
        // Glue punctuation to the previous word (no leading space before , . :).
        const glue = /^[,.:;]/.test(p);
        return (
          <Fragment key={i}>
            {p.split(' ').map((w, j) => (
              <Fragment key={j}>
                {(j > 0 || (!glue && i > 0)) && ' '}
                <span data-word>{w}</span>
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}

export default function Intro() {
  const root = useRef<HTMLElement>(null);

  // Each paragraph "reads itself": words go from faint to their final tone as the paragraph crosses
  // the screen (top 85% -> bottom 45%), staggered word by word. Plain rAF: geometry is measured
  // on layout changes, the per-frame work is a few multiplications per word.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const paras = [
      { el: root.current!.querySelector<HTMLElement>('[data-intro-lead]')!, end: 1 },
      { el: root.current!.querySelector<HTMLElement>('[data-intro-more]')!, end: 0.55 },
    ].map((p) => {
      const words = Array.from(p.el.querySelectorAll<HTMLElement>('[data-word]'));
      const strong = words.map((w) => w.hasAttribute('data-strong'));
      // GSAP-like stagger: 0.05 per word, each fade lasting 0.5 of the timeline's time unit.
      const total = 0.5 + 0.05 * (words.length - 1);
      return { ...p, words, strong, total, top: 0, h: 0 };
    });
    const measure = () => {
      for (const p of paras) {
        const r = p.el.getBoundingClientRect();
        p.top = r.top + store.scroll;
        p.h = r.height;
      }
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('layout', measure);
    document.fonts?.ready.then(measure);

    let raf = 0;
    let lastScroll = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const y = store.scroll;
      if (y === lastScroll) return;
      lastScroll = y;
      const vh = window.innerHeight;
      for (const p of paras) {
        const startY = p.top - vh * 0.85;
        const endY = p.top + p.h - vh * 0.45;
        const t = Math.min(1, Math.max(0, (y - startY) / Math.max(1, endY - startY)));
        p.words.forEach((w, i) => {
          const a = (0.05 * i) / p.total, b = (0.05 * i + 0.5) / p.total;
          const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
          const end = p.strong[i] ? 1 : p.end;
          w.style.opacity = (0.14 + (end - 0.14) * k).toFixed(3);
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('layout', measure);
    };
  }, []);

  return (
    <section ref={root} id="about" className={styles.intro} aria-label="About Julius">
      <figure className={styles.fig}>
        {/* Empty slot: the glass bust is drawn by the hero's 3D scene (the JULIUS word turns into it). */}
        <div className={styles.figMedia} data-bust-anchor />
        <figcaption className={styles.caption}>
          <span className="roman">C · Ivlivs · Caesar</span>
          <span className="mono">Fig. I</span>
        </figcaption>
      </figure>

      <div className={styles.text}>
        <p className={styles.lead} data-intro-lead>
          <Words pieces={LEAD} />
        </p>
        <p className={styles.more} data-intro-more>
          <Words pieces={MORE} />
        </p>
      </div>
    </section>
  );
}
