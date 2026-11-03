'use client';
import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { store } from '@/lib/store';
import { PROJECTS, ROWS, TOTAL_PROJECTS, type Project } from '@/lib/projects';
import { toRoman } from '@/lib/roman';
import { prefersReducedMotion } from '@/lib/motion';
import TornEdge from '@/components/TornEdge';
import Tether from './Tether';
import styles from './Work.module.css';

// Hover effect on project images. Alternative kept in the repo: './HoverParticles' (magnet particles).
// Loaded on the client after hydration so three.js stays out of the first-load bundle.
const HoverDistort = dynamic(() => import('./HoverDistort'), { ssr: false });

export default function Work() {
  const root = useRef<HTMLElement>(null);

  // GSAP (+ScrollTrigger, ~50 kB) is fetched only when the grid gets near, so the first screen
  // never pays for it.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = root.current!;
    let ctx: { revert: () => void } | null = null;
    let update: (() => void) | null = null;
    let cancelled = false;
    const io = new IntersectionObserver(async ([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      update = () => ScrollTrigger.update();
      store.scrollFns.add(update);
      ctx = gsap.context(() => {
      // Header: lines slide up out of their masks.
      gsap.from('[data-w-line]', {
        yPercent: 105,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: '[data-w-head]', start: 'top 80%' },
      });

      gsap.utils.toArray<HTMLElement>('[data-w-card]').forEach((card) => {
        const media = card.querySelector('[data-w-media]');
        const img = card.querySelector('[data-w-img]');
        const cap = card.querySelectorAll('[data-w-cap]');
        const tag = card.querySelector('[data-w-tag]');

        // Reveal: the frame wipes open from the bottom while the picture settles from a slight zoom.
        const tl = gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 88%' } });
        tl.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.25, ease: 'expo.out' })
          .fromTo(img, { scale: 1.3 }, { scale: 1, duration: 1.6, ease: 'expo.out' }, 0)
          .from(cap, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.06 }, 0.25)
          .from(tag, { autoAlpha: 0, x: 8, duration: 0.6, ease: 'power2.out' }, 0.6);

        // Parallax: the picture drifts inside its frame while the card crosses the screen.
        gsap.fromTo(
          img,
          { yPercent: -7 },
          { yPercent: 7, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } }
        );
      });
      }, el);
    }, { rootMargin: '1200px 0px' });
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      if (update) store.scrollFns.delete(update);
      ctx?.revert();
    };
  }, []);

  return (
    <section ref={root} id="work" className={styles.work} aria-labelledby="work-title">
      <HoverDistort />
      <header className={styles.head} data-w-head>
        <div className={styles.headTitle}>
          <span className={styles.mask}>
            <span className={`roman ${styles.kicker}`} data-w-line>II · Opera Selecta</span>
          </span>
          <h2 id="work-title" className={styles.title}>
            <span className={styles.mask}><span data-w-line>Selected</span></span>
            <span className={styles.mask}><span data-w-line>work</span></span>
          </h2>
        </div>
        <p className={`mono ${styles.headText}`}>
          <span className={styles.mask}><span data-w-line>140+ products shipped since MMXXI.</span></span>
          <span className={styles.mask}><span data-w-line>Twelve of them, below.</span></span>
        </p>
      </header>

      {ROWS.map((row, r) => (
        <div key={r} className={styles.row}>
          {row.map((i) => (
            <Card key={PROJECTS[i].slug} p={PROJECTS[i]} n={i + 1} />
          ))}
        </div>
      ))}

      <div className={styles.more}>
        <a href="/work" className={`mono ${styles.moreLink}`} data-cursor="view" data-cursor-label="All" data-tether>
          [ All {toRoman(TOTAL_PROJECTS)} projects ] <span aria-hidden>↗</span>
        </a>
      </div>
      <Tether selector="[data-tether]" />
      <TornEdge />
    </section>
  );
}

function Card({ p, n }: { p: Project; n: number }) {
  return (
    <a
      href={`/work/${p.slug}`}
      className={styles.card}
      style={{ gridColumn: `${p.col} / span ${p.span}` }}
      data-w-card
      data-cursor="view"
      data-cursor-label="View"
      aria-label={`${p.name} — ${p.blurb}`}
    >
      <div className={styles.media} style={{ aspectRatio: p.aspect }} data-w-media>
        <div className={styles.imgWrap} data-w-img>
          <Image
            src={p.image}
            alt=""
            fill
            sizes={`(max-width: 900px) 100vw, ${Math.round((p.span / 12) * 100)}vw`}
            className={styles.img}
          />
        </div>
        <span className={`mono ${styles.tag}`} data-w-tag>{p.tag}</span>
      </div>
      <div className={`mono ${styles.caption}`}>
        <span className={styles.capMask}>
          <span data-w-cap className={styles.capName}>
            <span className={styles.num}>{toRoman(n)}</span> {p.name}
          </span>
        </span>
        <span className={styles.capMask}>
          <span data-w-cap>{p.kind}</span>
        </span>
      </div>
    </a>
  );
}
