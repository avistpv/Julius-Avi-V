'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';
import { store } from '@/lib/store';
import { SNAPS } from '@/components/jump/phases';

export default function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });

    // Document-space geometry of everything the loops need, refreshed only when layout can change
    // (resize, fonts, a section setting its own height -> 'layout' event). Per scroll we just subtract.
    type Box = { top: number; h: number; left: number; w: number };
    const box = (el: Element | null): Box => {
      if (!el) return { top: -1, h: 0, left: 0, w: 0 };
      const r = el.getBoundingClientRect();
      return { top: r.top + lenis.scroll, h: r.height, left: r.left, w: r.width };
    };
    const geo = { anchor: box(null), jump: box(null), legio: box(null), finale: box(null), dot: box(null), tether: box(null) };
    const measure = () => {
      geo.anchor = box(document.querySelector('[data-bust-anchor]'));
      geo.jump = box(document.querySelector('[data-jump]'));
      geo.legio = box(document.querySelector('[data-legio]'));
      geo.finale = box(document.querySelector('[data-finale]'));
      geo.dot = box(document.querySelector('[data-finale-dot]'));
      geo.tether = box(document.querySelector('[data-tether]'));
    };
    const prog = (b: Box, scroll: number, vh: number) => Math.min(1, Math.max(0, (scroll - b.top) / Math.max(1, b.h - vh)));
    const onScreen = (b: Box, scroll: number, vh: number) => b.top >= 0 && b.top + b.h > scroll && b.top < scroll + vh;

    const onScroll = () => {
      const vh = window.innerHeight;
      const y = lenis.scroll;
      store.scroll = y;
      store.velocity = lenis.velocity;
      store.heroProgress = Math.min(1, Math.max(0, y / vh));

      // Dust -> Caesar: starts just after the hero begins to scroll and completes when the bust
      // slot in the intro has risen to ~18% from the top of the screen.
      const a = geo.anchor;
      if (a.top >= 0) {
        const top = a.top - y;
        store.anchor.x = a.left;
        store.anchor.y = top;
        store.anchor.w = a.w;
        store.anchor.h = a.h;
        const startTop = a.top - vh * 0.08; // slot position when scroll = 8% of a screen
        const endTop = vh * 0.18;
        store.morph = Math.min(1, Math.max(0, (startTop - top) / Math.max(1, startTop - endTop)));
        store.sceneActive = top + a.h > -60;
      } else {
        store.sceneActive = store.heroProgress < 1;
      }
      store.jump = prog(geo.jump, y, vh);
      store.legio = prog(geo.legio, y, vh);
      store.legioOn = onScreen(geo.legio, y, vh);
      store.finale = prog(geo.finale, y, vh);
      store.finaleOn = onScreen(geo.finale, y, vh);
      store.dot.x = geo.dot.left + geo.dot.w / 2;
      store.dot.y = geo.dot.top - y + geo.dot.h / 2;
      store.tether.left = geo.tether.left;
      store.tether.top = geo.tether.top - y;
      store.tether.w = geo.tether.w;
      store.tether.h = geo.tether.h;
      store.scrollFns.forEach((fn) => fn());
    };
    const relayout = () => { measure(); onScroll(); };
    measure();
    store.scrollTo = (y, immediate) => {
      lenis.resize(); // sections mount on approach and change the page length; refresh the limit first
      lenis.scrollTo(y, immediate ? { immediate: true, force: true } : { duration: 1.2, easing: (t: number) => 1 - Math.pow(1 - t, 3) });
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
      if (geo.jump.top >= 0) {
        const top = geo.jump.top, len = geo.jump.h - vh;
        const p = (lenis.scroll - top) / len;
        if (p > 0.08 && p < 0.97) {
          let best = SNAPS[0];
          for (const s of SNAPS) if (Math.abs(s - p) < Math.abs(best - p)) best = s;
          return glide(top + len * best, 1.1);
        }
      }
      // Finale: once the light disc starts growing, carry on to the open form by itself
      // (or back to the numbers when scrolling up) — nobody should have to scroll through it.
      if (geo.finale.top >= 0) {
        const top = geo.finale.top, len = geo.finale.h - vh;
        const p = (lenis.scroll - top) / len;
        if (p > 0.24 && p < 0.86) return glide(top + len * (lenis.direction >= 0 ? 0.94 : 0.1), 1.6);
      }
    };
    const queueSnap = () => {
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(snap, 120);
    };
    lenis.on('scroll', queueSnap);
    // Layout can shift without scrolling (resize, web fonts, sections sizing themselves).
    window.addEventListener('resize', relayout);
    window.addEventListener('layout', relayout);
    window.addEventListener('load', relayout);
    document.fonts?.ready.then(relayout);

    let raf = 0;
    const tick = (time: number) => { lenis.raf(time); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);

    const onMove = (e: PointerEvent) => {
      store.pointerFine = e.pointerType !== 'touch';
      store.pointer.x = e.clientX;
      store.pointer.y = e.clientY;
      store.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      store.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove);

    return () => {
      window.clearTimeout(snapTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', relayout);
      window.removeEventListener('layout', relayout);
      window.removeEventListener('load', relayout);
      window.removeEventListener('pointermove', onMove);
      lenis.destroy();
    };
  }, []);
  return null;
}
