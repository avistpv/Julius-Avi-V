'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { store } from '@/lib/store';
import { SNAPS } from '@/components/jump/phases';

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    const onScroll = () => {
      const vh = window.innerHeight;
      store.scroll = lenis.scroll;
      store.velocity = lenis.velocity;
      store.heroProgress = Math.min(1, Math.max(0, lenis.scroll / vh));

      // Word -> Caesar: starts just after the hero begins to scroll and completes when the bust
      // slot in the intro has risen to ~18% from the top of the screen.
      const a = document.querySelector<HTMLElement>('[data-bust-anchor]');
      if (a) {
        const r = a.getBoundingClientRect();
        store.anchor.x = r.left;
        store.anchor.y = r.top;
        store.anchor.w = r.width;
        store.anchor.h = r.height;
        const docTop = r.top + lenis.scroll;
        const startTop = docTop - vh * 0.08; // slot position when scroll = 8% of a screen
        const endTop = vh * 0.18;
        store.morph = Math.min(1, Math.max(0, (startTop - r.top) / Math.max(1, startTop - endTop)));
        store.sceneActive = r.bottom > -60;
      } else {
        store.sceneActive = store.heroProgress < 1;
      }
      const j = document.querySelector<HTMLElement>('[data-jump]');
      if (j) {
        const r = j.getBoundingClientRect();
        store.jump = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)));
      }
      ScrollTrigger.update();
    };
    lenis.on('scroll', onScroll);
    onScroll();

    // Scene snapping in the jump section: ~150ms after the last scroll movement, glide to the
    // nearest resting point. User input interrupts the glide (Lenis stops programmatic scrolls).
    let snapTimer = 0;
    const snap = () => {
      if (Math.abs(lenis.velocity) > 0.05) return;
      const vh = window.innerHeight;
      const glide = (target: number, duration: number) => {
        if (Math.abs(target - lenis.scroll) < 2) return;
        lenis.scrollTo(target, { duration, easing: (t: number) => 1 - Math.pow(1 - t, 3) });
      };
      // Jump: nearest resting point.
      const j = document.querySelector<HTMLElement>('[data-jump]');
      if (j) {
        const top = j.offsetTop, len = j.offsetHeight - vh;
        const p = (lenis.scroll - top) / len;
        if (p > 0.08 && p < 0.97) {
          let best = SNAPS[0];
          for (const s of SNAPS) if (Math.abs(s - p) < Math.abs(best - p)) best = s;
          return glide(top + len * best, 1.1);
        }
      }
      // Finale: once the light disc starts growing, carry on to the open form by itself
      // (or back to the numbers when scrolling up) — nobody should have to scroll through it.
      const f = document.querySelector<HTMLElement>('[data-finale]');
      if (f) {
        const top = f.offsetTop, len = f.offsetHeight - vh;
        const p = (lenis.scroll - top) / len;
        if (p > 0.24 && p < 0.86) return glide(top + len * (lenis.direction >= 0 ? 0.94 : 0.1), 1.6);
      }
    };
    const queueSnap = () => {
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(snap, 120);
    };
    lenis.on('scroll', queueSnap);
    // Layout can shift without scrolling (resize, web fonts) — recompute the bust slot then too.
    window.addEventListener('resize', onScroll);
    document.fonts?.ready.then(onScroll);

    // One clock for everything: Lenis is driven by GSAP's ticker so scroll-linked tweens never drift.
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const onMove = (e: PointerEvent) => {
      store.pointer.x = e.clientX;
      store.pointer.y = e.clientY;
      store.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      store.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove);

    return () => {
      window.clearTimeout(snapTimer);
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointermove', onMove);
      lenis.destroy();
    };
  }, []);
  return null;
}
