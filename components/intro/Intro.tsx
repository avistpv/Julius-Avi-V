'use client';
import { Fragment, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '@/lib/motion';
import styles from './Intro.module.css';

gsap.registerPlugin(ScrollTrigger);

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

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      // Each paragraph "reads itself": words go from faint to their final tone, tied to scroll.
      const fill = (sel: string, end: number) => {
        const words = gsap.utils.toArray<HTMLElement>(`${sel} [data-word]`);
        gsap.fromTo(
          words,
          { opacity: 0.14 },
          {
            opacity: (_i: number, el: HTMLElement) => (el.hasAttribute('data-strong') ? 1 : end),
            ease: 'none',
            stagger: 0.05,
            scrollTrigger: { trigger: sel, start: 'top 85%', end: 'bottom 45%', scrub: 0.6 },
          }
        );
      };
      fill('[data-intro-lead]', 1);
      fill('[data-intro-more]', 0.55);

    }, root);
    return () => ctx.revert();
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
