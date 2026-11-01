'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './Cursor.module.css';

// Site-wide cursor follower. Elements opt in with data-cursor="<mode>" (+ optional data-cursor-label).
// Modes so far: "view" (blue disc with a label, project cards), "ring" / "ring-big" (thin white
// circle in the team section; bigger over a portrait), "ring-dark" (same circle in ink, hero).
export default function Cursor() {
  const el = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Only on devices with a real mouse.
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setEnabled(mq.matches);
    if (!mq.matches) return;

    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let tx = x, ty = y;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const onOver = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest<HTMLElement>('[data-cursor]');
      setMode(t?.dataset.cursor ?? null);
      setLabel(t?.dataset.cursorLabel ?? '');
    };
    const onLeaveWindow = () => setMode(null);
    // Scrolling moves the page under a still pointer: re-read what is beneath it.
    let scrollRaf = 0;
    const onScroll = () => {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => {
        const t = document.elementFromPoint(tx, ty)?.closest<HTMLElement>('[data-cursor]');
        setMode(t?.dataset.cursor ?? null);
        setLabel(t?.dataset.cursorLabel ?? '');
      });
    };

    const loop = () => {
      // Slight lag makes the disc feel weighty rather than glued to the pointer.
      x += (tx - x) * 0.2;
      y += (ty - y) * 0.2;
      if (el.current) el.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver);
    document.documentElement.addEventListener('pointerleave', onLeaveWindow);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(scrollRaf);
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
    };
  }, []);

  if (!enabled) return null;
  return (
    <div ref={el} className={styles.cursor} aria-hidden>
      <div className={`${styles.disc} ${mode === 'view' ? styles.isView : ''}`}>
        <span className={`mono ${styles.label}`}>{label}</span>
      </div>
      <div className={`${styles.ring} ${mode === 'ring' ? styles.isRing : ''} ${mode === 'ring-big' ? styles.isRingBig : ''} ${mode === 'ring-dark' ? styles.isRingDark : ''}`} />
    </div>
  );
}
