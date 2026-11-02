'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { store } from '@/lib/store';
import { scramble } from '@/lib/scramble';
import {
  ARCH_ASPECT, ETCH_FROM, ETCH_TO, OPENING, PUSH_FROM, PUSH_TO, REVEAL_END, STEPS,
  range, smooth,
} from './phases';
import SceneBoundary from '@/components/hero/SceneBoundary';
import Props from './Props';
import Constellation from './Constellation';
import styles from './Jump.module.css';

// The painting shader and both paintings (~1.6 MB) are fetched only when the section gets close,
// so they don't compete with the hero for bandwidth on first load.
const Painting = dynamic(() => import('./Painting'), { ssr: false });
// ponytail: fixed px lead (~1 screen of scrolling at common heights); switch to a vh-based trigger if layout changes.
const PRELOAD_MARGIN = '0px 0px 2500px 0px';

const INSCRIPTION = 'VENI · VIDI · VICI';

// III · VIRTVTES — a painted triumphal arch revealed under the torn paper of the work grid.
// Scrolling pushes the camera through its opening into the Roman landscape (2.5D: the arch
// grows much faster than the landscape behind it), where Veni / Vidi / Vici and the values appear.
// The arch is drawn on a canvas: a DOM layer scaled 14x falls apart into raster tiles in Chrome.
export default function Jump() {
  const [step, setStep] = useState(-1);
  const [intro, setIntro] = useState(false);
  const [dark, setDark] = useState(false);
  const [isNear, setIsNear] = useState(false);
  const root = useRef<HTMLElement>(null);
  const arch = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepRef = useRef<HTMLHeadingElement>(null);
  const fontProbe = useRef<HTMLSpanElement>(null);
  const latinRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      setIsNear(true);
      io.disconnect();
    }, { rootMargin: PRELOAD_MARGIN });
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!isNear) return;
    const img = new Image();
    img.src = '/jump/arch.webp';
    img.decode().then(() => { arch.current = img; }).catch(() => { img.onload = () => { arch.current = img; }; });
  }, [isNear]);

  // Scroll-linked layers, written straight to the DOM / canvas every frame.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let s = -2, i: boolean | null = null, d: boolean | null = null;
    let lastKey = '';
    const m = { x: 0, y: 0 };
    const loop = () => {
      const p = store.jump;
      m.x += (store.mouse.x - m.x) * 0.06;
      m.y += (store.mouse.y - m.y) * 0.06;

      const reveal = smooth(range(p, 0, REVEAL_END));
      const push = range(p, PUSH_FROM, PUSH_TO);
      const after = range(p, PUSH_TO, 1);

      // The headline drifts up and grows a little while its step lasts, so it moves with the camera.
      const st = STEPS.find((x) => p >= x.from && p < x.to);
      if (stepRef.current && st) {
        const t = range(p, st.from, st.to);
        stepRef.current.style.transform = `translateY(${(-t * 60).toFixed(1)}px) scale(${(0.96 + t * 0.1).toFixed(3)})`;
      }

      // Arch: settles while the paper tears away, then flies past exponentially fast.
      const archScale = (1.1 - 0.1 * reveal) * Math.pow(14, push * push);
      const alpha = 1 - range(push, 0.8, 1);
      const img = arch.current;
      const key = `${archScale.toFixed(4)}|${m.x.toFixed(3)}|${m.y.toFixed(3)}|${alpha.toFixed(3)}|${W}x${H}|${!!img}`;
      if (key !== lastKey) {
        lastKey = key;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        if (img && alpha > 0 && push < 1) {
          // The arch box behaves like `cover` (its opening keeps fixed coordinates).
          const bw = Math.max(W, H * ARCH_ASPECT);
          const bh = bw / ARCH_ASPECT;
          const bx = (W - bw) / 2 - m.x * 12 * (1 - push);
          const by = (H - bh) / 2 + m.y * 8 * (1 - push);
          const ox = bx + bw * OPENING.x;
          const oy = by + bh * OPENING.y;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(ox, oy);
          ctx.scale(archScale, archScale);
          ctx.translate(-ox, -oy);
          ctx.drawImage(img, bx, by, bw, bh);
          // Carved into the blank tablet on the attic.
          const fam = fontProbe.current ? getComputedStyle(fontProbe.current).fontFamily : 'serif';
          const size = bw * 0.031;
          ctx.font = `600 ${size}px ${fam}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${size * 0.14}px`;
          const tx = bx + bw / 2 + size * 0.07; // compensate trailing letter-spacing
          const ty = by + bh * 0.116;
          ctx.fillStyle = 'rgba(255, 236, 196, 0.55)';
          ctx.fillText(INSCRIPTION, tx, ty + size * 0.04);
          ctx.fillStyle = 'rgba(30, 18, 6, 0.5)';
          ctx.fillText(INSCRIPTION, tx, ty - size * 0.03);
          ctx.fillStyle = 'rgba(74, 50, 26, 0.78)';
          ctx.fillText(INSCRIPTION, tx, ty);
          ctx.restore();
        }
      }

      const ns = STEPS.findIndex((st) => p >= st.from && p < st.to);
      const ni = p > REVEAL_END * 0.6 && p < PUSH_FROM + 0.03;
      const nd = range(p, ETCH_FROM, ETCH_TO) > 0.45; // night world -> light text
      if (nd !== d) { d = nd; setDark(nd); }
      if (ns !== s) { s = ns; setStep(ns); }
      if (ni !== i) { i = ni; setIntro(ni); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  // Decode each new line from random glyphs.
  useEffect(() => {
    if (step < 0 || !latinRef.current || !lineRef.current) return;
    const a = scramble(latinRef.current, STEPS[step].latin.toUpperCase(), 520);
    const b = scramble(lineRef.current, STEPS[step].line.toUpperCase(), 760);
    return () => { a(); b(); };
  }, [step]);

  return (
    <section ref={root} className={`${styles.jump} ${dark ? styles.dark : ''}`} data-jump aria-label="How we work">
      <div className={styles.stage}>
        <SceneBoundary fallback={<div className={styles.land} aria-hidden />}>
          {isNear && <Painting />}
        </SceneBoundary>
        <canvas ref={canvasRef} className={styles.arch} aria-hidden />
        <Props />
        {/* Hidden probe so the canvas can use the Roman web font by its generated family name. */}
        <span ref={fontProbe} className={`roman ${styles.probe}`} aria-hidden>I</span>

        <div className={`${styles.intro} ${intro ? styles.on : ''}`}>
          <span className="roman">III · Virtvtes</span>
          <span className="mono">From idea to launch. Scroll to enter.</span>
        </div>

        <h2 ref={stepRef} className={`${styles.step} ${step >= 0 ? styles.on : ''}`} aria-live="polite">
          <span className={`roman ${styles.gate}`}>{step >= 0 ? `Porta ${['I', 'II', 'III'][step]}` : ''}</span>
          <span ref={latinRef} className={styles.latin} />
          <span ref={lineRef} className={styles.line} />
        </h2>

        <Constellation />
      </div>
    </section>
  );
}
