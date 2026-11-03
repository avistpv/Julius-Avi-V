'use client';
import { useEffect, useRef } from 'react';
import { store } from '@/lib/store';

// The hero's dust without WebGL (phones, or `?hero=2d`): a few thousand points on a plain canvas.
// Same choreography as Morph.tsx — a breathing ball under the slogan that parts around the pointer,
// flying onto Caesar's surface as you scroll into the intro — but the bust stays made of dust
// (no glass), drawn from the prepared surface points and slowly turning after the pointer.
const COUNT = 2600;
const POINTS_URL = '/models/caesar-points.bin';
const POINTS_SCALE = 1 / 20000;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function Dust2D() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Cloud: a soft ball (unit radius), denser inside, a thin haze around.
    const cloud = new Float32Array(COUNT * 3);
    const rnd = new Float32Array(COUNT * 4);
    for (let i = 0; i < COUNT; i++) {
      const halo = Math.random() < 0.12;
      const r = halo ? 1 + Math.pow(Math.random(), 2) * 0.6 : Math.cbrt(Math.random()) * 0.98;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      cloud[i * 3] = r * Math.sin(ph) * Math.cos(th);
      cloud[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      cloud[i * 3 + 2] = r * Math.cos(ph) * 0.75;
      for (let k = 0; k < 4; k++) rnd[i * 4 + k] = Math.random();
    }
    // Bust: every Nth prepared surface point (bust-local units, one unit tall, centred).
    let bust: Float32Array | null = null;
    fetch(POINTS_URL).then((r) => r.arrayBuffer()).then((buf) => {
      const q = new Int16Array(buf);
      const step = Math.max(1, Math.floor(q.length / 3 / COUNT));
      const out = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const j = (i * step) % (q.length / 3);
        out[i * 3] = q[j * 3] * POINTS_SCALE;
        out[i * 3 + 1] = q[j * 3 + 1] * POINTS_SCALE;
        out[i * 3 + 2] = q[j * 3 + 2] * POINTS_SCALE;
      }
      bust = out;
    }).catch(() => {});

    let appear = 0;
    let raf = 0;
    let last = 0;
    const m = { x: 0, y: 0 };
    let yaw = 0;
    // The dust is on screen -> the slogan may settle in (same signal the 3D layer sends).
    requestAnimationFrame(() => window.dispatchEvent(new Event('scene-ready')));

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!store.sceneActive) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const time = now / 1000;
      if (store.ready) appear = Math.min(1, appear + dt / 1.6);
      m.x += (store.mouse.x - m.x) * 0.08;
      m.y += (store.mouse.y - m.y) * 0.08;

      const morph = store.morph;
      // Cloud: under the slogan, scrolling with the page. Bust: over the intro's figure slot.
      const R = H * 0.21 * smooth(appear);
      const cx = W / 2, cy = H * 0.5 + H * 0.17 - store.scroll;
      const a = store.anchor;
      const bx = a.x + a.w / 2, by = a.y + a.h / 2, bs = a.h * 0.94;
      const px = (store.mouse.x + 1) / 2 * W, py = (1 - store.mouse.y) / 2 * H;
      // Only a real pointer parts the dust (on touch the last position would punch a hole in it).
      const repel = store.pointerFine ? 1 - smooth(clamp01(morph / 0.25)) : 0;
      yaw += ((m.x * 0.6 + Math.sin(time * 0.35) * 0.15) - yaw) * 0.04;
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const alpha = smooth(clamp01(appear / 0.6));
      if (alpha <= 0) return;

      for (let i = 0; i < COUNT; i++) {
        const r0 = rnd[i * 4], r1 = rnd[i * 4 + 1], r2 = rnd[i * 4 + 2], r3 = rnd[i * 4 + 3];
        // Per-particle delay, like the shader: everyone has landed by morph = 0.8.
        const t = clamp01((morph - r0 * 0.25) / 0.55);
        const e = smooth(t);
        const arc = Math.sin(e * Math.PI);
        const idle = 1 - e;

        // Cloud position (px) with breathing and the pointer parting the dust.
        let x0 = cx + cloud[i * 3] * R + Math.sin(time * 0.6 + r1 * 6.2832) * 0.05 * R * idle;
        let y0 = cy - cloud[i * 3 + 1] * R + Math.cos(time * 0.5 + r2 * 6.2832) * 0.05 * R * idle;
        if (repel > 0 && idle > 0) {
          const dx = x0 - px, dy = y0 - py;
          const d2 = dx * dx + dy * dy;
          const push = Math.exp(-d2 / (R * R * 0.28)) * repel * idle;
          const d = Math.sqrt(d2) || 1;
          x0 += (dx / d) * push * R * 0.7;
          y0 += (dy / d) * push * R * 0.7;
        }

        // Bust position (px): local point turned by yaw, projected flat.
        let x1 = x0, y1 = y0, depth = 0;
        if (bust) {
          const lx = bust[i * 3], ly = bust[i * 3 + 1], lz = bust[i * 3 + 2];
          const rx = lx * cosY + lz * sinY;
          depth = -lx * sinY + lz * cosY; // towards the viewer = positive
          x1 = bx + rx * bs;
          y1 = by - ly * bs + Math.sin(time * 0.8) * bs * 0.012;
        }

        let x = x0 + (x1 - x0) * e + (r1 * 2 - 1) * arc * R * 0.45;
        let y = y0 + (y1 - y0) * e - arc * R * 0.4 + (r2 * 2 - 1) * arc * R * 0.3;
        x += Math.sin(time * 1.3 + r0 * 40) * 2 * arc;
        y += Math.cos(time * 1.1 + r1 * 40) * 2 * arc;

        // Blue dust; lighter in flight; on the bust, points facing us are brighter (cheap shading).
        const lift = 0.15 + arc * 0.5;
        const shade = e > 0 ? 0.55 + 0.45 * clamp01(depth * 2 + 0.5) : 1;
        const red = Math.round((74 + (200 - 74) * lift) * shade);
        const grn = Math.round((120 + (220 - 120) * lift) * shade);
        const blu = Math.round((230 + (255 - 230) * lift) * shade);
        const size = (1.1 + r3 * 1.2) * (1 + arc * 0.8) * (e > 0.99 ? 1.15 : 1);
        ctx.fillStyle = `rgba(${red},${grn},${blu},${(alpha * (0.75 + 0.25 * r3)).toFixed(2)})`;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />;
}
