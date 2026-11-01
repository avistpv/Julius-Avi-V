'use client';
import { useEffect, useRef } from 'react';
import { store } from '@/lib/store';

// A magnetic "anchor" between a link and the pointer. While the link is on screen and the mouse is
// within reach, a thin thread curves from the link to the cursor and a stream of dust drifts along
// it, gathering at the pointer; the link itself leans a little towards the mouse.
const REACH = 420; // px: beyond this the anchor lets go
const MAX_PARTICLES = 220;

type P = { t: number; v: number; side: number; amp: number; size: number; blue: boolean };

export default function Tether({ selector }: { selector: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;
    el.style.willChange = 'transform';

    let dpr = 1, W = 0, H = 0;
    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const parts: P[] = [];
    let strength = 0; // eased 0..1
    let lean = { x: 0, y: 0 };
    let dirty = false;
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const r = el.getBoundingClientRect();
      const px = store.pointer.x, py = store.pointer.y;
      const inView = r.bottom > 0 && r.top < H && r.width > 0;
      // Anchor: the point on the link's box nearest the pointer, pulled a bit inside.
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ax = Math.min(Math.max(px, r.left + 6), r.right - 6);
      const ay = Math.min(Math.max(py, r.top + 4), r.bottom - 4);
      const dx = px - ax, dy = py - ay;
      const dist = Math.hypot(dx, dy);
      const target = inView ? Math.max(0, 1 - dist / REACH) : 0;
      strength += (target - strength) * 0.08;

      // The link leans towards the pointer (a few px at most).
      const lx = Math.max(-10, Math.min(10, (px - cx) * 0.06)) * strength;
      const ly = Math.max(-8, Math.min(8, (py - cy) * 0.06)) * strength;
      lean.x += (lx - lean.x) * 0.15;
      lean.y += (ly - lean.y) * 0.15;
      el.style.transform = `translate(${lean.x.toFixed(2)}px, ${lean.y.toFixed(2)}px)`;

      if (strength < 0.01 && parts.length === 0) {
        if (dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; }
        return;
      }

      // Spawn along the thread; none when the pointer is already on the link.
      if (dist > 28 && strength > 0.05) {
        const n = Math.random() < strength * 3 ? Math.ceil(strength * 3) : 0;
        for (let i = 0; i < n && parts.length < MAX_PARTICLES; i++) {
          parts.push({
            t: 0,
            v: 0.009 + Math.random() * 0.009,
            side: Math.random() < 0.5 ? -1 : 1,
            amp: 4 + Math.random() * 16,
            size: 0.9 + Math.random() * 1.5,
            blue: Math.random() < 0.14,
          });
        }
      }

      // Thread geometry: a quadratic curve sagging to one side.
      const mx = (ax + px) / 2, my = (ay + py) / 2;
      const len = Math.max(1, dist);
      const nx = -dy / len, ny = dx / len; // unit normal
      const sag = Math.min(60, dist * 0.16);
      const qx = mx + nx * sag, qy = my + ny * sag;
      const at = (t: number) => {
        const u = 1 - t;
        return [u * u * ax + 2 * u * t * qx + t * t * px, u * u * ay + 2 * u * t * qy + t * t * py];
      };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      dirty = true;

      // The thread itself: faint, fading in with strength.
      if (dist > 10) {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(qx, qy, px, py);
        ctx.strokeStyle = `rgba(11, 12, 12, ${(0.2 * strength).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += p.v * (0.6 + 0.8 * strength);
        if (p.t >= 1) { parts.splice(i, 1); continue; }
        const [bx, by] = at(p.t);
        const wobble = Math.sin(p.t * Math.PI) * p.amp * p.side;
        const x = bx + nx * wobble, y = by + ny * wobble;
        const a = Math.pow(Math.sin(p.t * Math.PI), 0.7) * strength;
        const s = p.size * (1.1 - p.t * 0.6);
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fillStyle = p.blue ? `rgba(47, 107, 255, ${a.toFixed(3)})` : `rgba(11, 12, 12, ${a.toFixed(3)})`;
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      el.style.transform = '';
    };
  }, [selector]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 6 }}
    />
  );
}
