'use client';
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { TEAM } from '@/lib/team';
import { toRoman } from '@/lib/roman';
import styles from './Legio.module.css';

// III · LEGIO — the team. Straight out of the night sky of the jump, the scroll turns sideways:
// a pinned stage whose track slides left as you scroll down. Portraits are silver engravings on
// dark that develop into colour as they pass the centre of the screen and under the mouse.
export default function Legio() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const sec = root.current!, tr = track.current!, st = stage.current!;
    let dist = 0; // how far the track has to travel
    const resize = () => {
      dist = Math.max(0, tr.scrollWidth - window.innerWidth);
      // Scroll length = the sideways distance, plus one screen so the last panel can settle.
      sec.style.height = `${dist + window.innerHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    document.fonts?.ready.then(resize);

    let raf = 0;
    let last = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const r = sec.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom < 0 || r.top > vh) return;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)));
      if (p === last) return;
      last = p;
      const x = -p * dist;
      tr.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      st.style.setProperty('--sx', `${(x * 0.15).toFixed(1)}px`); // stars drift slower
      // Each portrait develops as it nears the centre of the screen.
      const mid = window.innerWidth / 2;
      cards.current.forEach((c) => {
        if (!c) return;
        const cr = c.getBoundingClientRect();
        const d = Math.abs(cr.left + cr.width / 2 - mid) / window.innerWidth;
        const dev = Math.max(0, 1 - d / 0.22);
        c.style.setProperty('--dev', (dev * 0.75).toFixed(3));
      });
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <section ref={root} className={styles.legio} data-legio aria-labelledby="legio-title">
      <div ref={stage} className={styles.stage}>
        <div className={styles.stars} aria-hidden />
        <div ref={track} className={styles.track}>
          <header className={styles.intro}>
            <span className={`roman ${styles.kicker}`}>III · Legio</span>
            <h2 id="legio-title" className={styles.title}>
              <span>Meet</span>
              <span>the team.</span>
            </h2>
            <p className={`mono ${styles.lead}`}>
              {toRoman(TEAM.length)} people under one roof — strategy, design, code and QA.
              No hand-offs to strangers: the people you meet are the people who build.
            </p>
            <span className={`mono ${styles.hint}`}>Scroll → </span>
          </header>

          {TEAM.map((m, i) => (
            <div
              key={m.name}
              ref={(el) => { cards.current[i] = el; }}
              className={styles.card}
              style={{ ['--dev' as string]: 0, marginTop: `${(i % 3) * 5}vh` }}
              data-cursor="view"
              data-cursor-label="Hi"
            >
              <div className={styles.portrait}>
                <Image src={m.photo} alt={`${m.name}, ${m.role}`} fill sizes="(max-width: 900px) 70vw, 24vw" className={styles.etched} />
                <Image src={m.photo} alt="" fill sizes="(max-width: 900px) 70vw, 24vw" className={styles.colour} aria-hidden />
                <span className={`roman ${styles.num}`}>{toRoman(i + 1)}</span>
              </div>
              <div className={styles.caption}>
                <span className={styles.name}>{m.name}</span>
                <span className={`mono ${styles.role}`}>{m.role}</span>
              </div>
            </div>
          ))}

          <aside className={styles.outro}>
            <span className={styles.big}>{toRoman(TEAM.length)}</span>
            <span className={`mono ${styles.lead}`}>Est. MMXXI · Petah Tikva</span>
          </aside>
        </div>
      </div>
    </section>
  );
}
