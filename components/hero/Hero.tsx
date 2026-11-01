'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { store } from '@/lib/store';
import { toRoman } from '@/lib/roman';
import SceneBoundary from './SceneBoundary';
import styles from './Hero.module.css';

const Scene = dynamic(() => import('./Scene'), { ssr: false });

const HEADLINE = ['We build products', 'that ship.'];

// I · ORIGO. Paper, the slogan in the middle, and under it a cloud of blue dust that breathes,
// shies away from the mouse, and gathers into Caesar's bust as you scroll into the intro
// (the dust and the bust are drawn by the 3D layer behind this section).
export default function Hero() {
  const [ready, setReady] = useState(false);

  // Preloader: wait for the first WebGL frame (and a minimum beat so the bar reads), then reveal.
  useEffect(() => {
    const start = performance.now();
    const done = () => {
      const wait = Math.max(0, 900 - (performance.now() - start));
      setTimeout(() => {
        setReady(true);
        store.ready = true;
      }, wait);
    };
    window.addEventListener('scene-ready', done, { once: true });
    // Safety net: never keep people on the loader if WebGL is slow or unavailable.
    const fallback = setTimeout(done, 4000);
    return () => {
      window.removeEventListener('scene-ready', done);
      clearTimeout(fallback);
    };
  }, []);

  // The 3D layer stays up while the dust / bust is on screen (hero + intro), then stops rendering.
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let last: boolean | null = null;
    const loop = () => {
      if (canvasRef.current && store.sceneActive !== last) {
        last = store.sceneActive;
        canvasRef.current.style.visibility = last ? 'visible' : 'hidden';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <div ref={canvasRef} className={styles.canvasWrap}>
        <SceneBoundary>
          <Scene />
        </SceneBoundary>
      </div>
      <Preloader done={ready} />

      <section className={`${styles.hero} ${ready ? styles.isReady : ''}`} data-cursor="ring-dark" aria-label="Intro">
        <header className={styles.header}>
          <a href="/" className={styles.logo} aria-label="Julius — home">
            <Reveal i={0}>JULIUS</Reveal>
            <Reveal i={0} className={styles.logoDim}>.STUDIO</Reveal>
          </a>
          <nav className={`${styles.nav} mono`}>
            {['Work', 'About', 'Contact'].map((l, i) => (
              <a key={l} href={`#${l.toLowerCase()}`} className={styles.navLink}>
                <Reveal i={i + 1}>
                  <span className={styles.bracket}>[</span>
                  {l}
                  <span className={styles.bracket}>]</span>
                </Reveal>
              </a>
            ))}
          </nav>
        </header>

        <h1 className={styles.headline} aria-label="We build products that ship.">
          <Reveal i={2} className={`roman ${styles.kicker}`}>I · Origo</Reveal>
          {HEADLINE.map((line, i) => (
            <span key={line} className={styles.line} aria-hidden>
              <span className={styles.lineInner} style={{ transitionDelay: `${0.35 + i * 0.1}s` }}>
                {line}
              </span>
            </span>
          ))}
        </h1>

        <footer className={`${styles.footer} mono`}>
          <Reveal i={5}><Clock /></Reveal>
          <Reveal i={5} className={styles.tagline}>Software studio · Petah Tikva · Est. MMXXI</Reveal>
          <Reveal i={6} className={styles.scrollHint}><ScrollHint /></Reveal>
        </footer>
      </section>
    </>
  );
}

/* ---------- pieces ---------- */

function Reveal({ children, i = 0, className = '' }: { children: React.ReactNode; i?: number; className?: string }) {
  return (
    <span className={`${styles.reveal} ${className}`}>
      <span className={styles.revealInner} style={{ transitionDelay: `${0.15 + i * 0.07}s` }}>
        {children}
      </span>
    </span>
  );
}

function Preloader({ done }: { done: boolean }) {
  return (
    <div className={`${styles.preloader} ${done ? styles.preloaderDone : ''}`} aria-hidden>
      <span className={styles.preloaderBar} />
      <span className={`roman ${styles.preloaderMotto}`}>Veni · Vidi · Vici</span>
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState<{ h: number; m: number } | null>(null);
  const [temp, setTemp] = useState<number | null>(null);
  const [roman, setRoman] = useState(false);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });
    const tick = () => {
      const [h, m] = fmt.format(new Date()).split(':').map(Number);
      setTime({ h, m });
    };
    tick();
    const id = setInterval(tick, 10_000);

    // Live temperature in Petah Tikva (Open-Meteo, no key). Hidden if it fails.
    fetch('https://api.open-meteo.com/v1/forecast?latitude=32.09&longitude=34.88&current=temperature_2m')
      .then((r) => r.json())
      .then((d) => {
        const t = d?.current?.temperature_2m;
        if (typeof t === 'number') setTemp(Math.round(t));
      })
      .catch(() => {});
    return () => clearInterval(id);
  }, []);

  // Israel is GMT+2 in winter, GMT+3 in summer.
  const offset = (() => {
    try {
      const part = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', timeZoneName: 'shortOffset' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value;
      return part ?? 'GMT+2';
    } catch {
      return 'GMT+2';
    }
  })();

  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = time ? (roman ? `${toRoman(time.h)}:${toRoman(time.m)}` : `${pad(time.h)}:${pad(time.m)}`) : '--:--';
  const deg = temp === null ? '' : roman ? `${temp < 0 ? '-' : ''}${toRoman(temp)}°C` : `${temp}°C`;

  // Click to read the time the Roman way.
  return (
    <button
      type="button"
      className={styles.clock}
      onClick={() => setRoman((r) => !r)}
      title={roman ? 'Arabic numerals' : 'Roman numerals'}
      suppressHydrationWarning
    >
      {offset} IL {clock} {deg}
    </button>
  );
}

function ScrollHint() {
  return (
    <svg width="34" height="18" viewBox="0 0 34 18" fill="none" aria-label="Scroll">
      <rect x="0.5" y="0.5" width="33" height="17" rx="8.5" stroke="currentColor" />
      <circle className={styles.scrollDot} cx="9" cy="9" r="2.5" fill="currentColor" />
    </svg>
  );
}
