'use client';
import { useEffect, useRef } from 'react';
import { store } from '@/lib/store';

// The hero's dust without WebGL (phones, or `?hero=2d`): a few thousand crisp points on a plain
// canvas. Same choreography as Morph.tsx — a breathing ball under the slogan that parts around the
// pointer, flying onto Caesar's surface as you scroll into the intro — and then the same glass
// bust, pre-rendered (public/bust, tools/bust-frames.mjs): a scan line climbs the figure, the
// picture appears below it, the dust flares and goes out above it. Nine yaw frames let the bust
// turn a little after the pointer (or idle on its own).
const COUNT = 2600;
const POINTS_URL = '/models/caesar-points.bin';
const POINTS_SCALE = 1 / 20000;
const FRAMES = 9;
const YAW_MAX = 0.6; // frames span -YAW_MAX..YAW_MAX
const FRAME_W = 664, FRAME_H = 800; // rendered at 2x the 332×400 slot
const SWEEP_START = 0.8, SWEEP_END = 1.0;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function Dust2D() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
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
    // Bust surface: every Nth prepared point (bust-local units, one unit tall, centred).
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
    // Bust frames: fetched once the dust starts to fly, so the hero never pays for them.
    const frames: (HTMLImageElement | null)[] = Array(FRAMES).fill(null);
    let framesRequested = false;
    const loadFrames = () => {
      framesRequested = true;
      for (let i = 0; i < FRAMES; i++) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => { frames[i] = img; };
        img.src = `/bust/f${i}.webp`;
      }
    };

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
      if (morph > 0.05 && !framesRequested) loadFrames();
      // Cloud: under the slogan, scrolling with the page. Bust: over the intro's figure slot.
      const R = H * 0.21 * smooth(appear);
      const cx = W / 2, cy = H * 0.5 + H * 0.17 - store.scroll;
      const a = store.anchor;
      const bs = a.h * 0.94;
      const bx = a.x + a.w / 2, by = a.y + a.h / 2 + Math.sin(time * 0.8) * bs * 0.012;
      const px = (store.mouse.x + 1) / 2 * W, py = (1 - store.mouse.y) / 2 * H;
      // Only a real pointer parts the dust (on touch the last position would punch a hole in it).
      const repel = store.pointerFine ? 1 - smooth(clamp01(morph / 0.25)) : 0;
      const yawTarget = (store.pointerFine ? m.x * 0.5 : 0) + Math.sin(time * 0.35) * 0.14;
      yaw += (yawTarget - yaw) * 0.04;
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);

      // Scan line (viewport px): climbs from under the pedestal to over the head.
      const k = smooth(clamp01((morph - SWEEP_START) / (SWEEP_END - SWEEP_START)));
      const sweeping = morph > SWEEP_START;
      const sweepY = morph >= SWEEP_END ? -1e4 : by + bs * 0.53 - k * bs * 1.06;
      const band = bs * 0.035;

      // Work in device pixels so every point lands on whole pixels (no smear).
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const alpha = smooth(clamp01(appear / 0.6));
      if (alpha <= 0) return;

      // The picture, below the scan line.
      if (sweeping) {
        const fi = Math.round(((Math.max(-YAW_MAX, Math.min(YAW_MAX, yaw)) + YAW_MAX) / (2 * YAW_MAX)) * (FRAMES - 1));
        const img = frames[fi] ?? frames.find(Boolean) ?? null;
        if (img) {
          const h = bs / 0.9; // in the frame the bust spans 90% of the height
          const w = h * (FRAME_W / FRAME_H);
          const x = bx - w / 2, y = by - h / 2;
          const top = Math.max(y, sweepY);
          if (top < y + h) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x * dpr, top * dpr, w * dpr, (y + h - top) * dpr);
            ctx.clip();
            ctx.drawImage(img, x * dpr, y * dpr, w * dpr, h * dpr);
            ctx.restore();
          }
        }
      }

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
          y1 = by - ly * bs;
        }

        let x = x0 + (x1 - x0) * e + (r1 * 2 - 1) * arc * R * 0.45;
        let y = y0 + (y1 - y0) * e - arc * R * 0.4 + (r2 * 2 - 1) * arc * R * 0.3;
        x += Math.sin(time * 1.3 + r0 * 40) * 2 * arc;
        y += Math.cos(time * 1.1 + r1 * 40) * 2 * arc;

        // Below the scan line the glass has taken over; right at it the dust flares.
        let glow = 0;
        if (sweeping) {
          const dy = y - sweepY;
          if (dy > band) continue;
          glow = Math.exp(-Math.abs(dy) / band);
        }

        // Blue dust; lighter in flight; on the bust, points facing us are brighter (cheap shading).
        const lift = Math.min(1, 0.15 + arc * 0.5 + glow * 0.7);
        const shade = e > 0 ? 0.55 + 0.45 * clamp01(depth * 2 + 0.5) : 1;
        const red = Math.round((74 + (255 - 74) * lift) * shade);
        const grn = Math.round((120 + (255 - 120) * lift) * shade);
        const blu = Math.round((230 + (255 - 230) * lift) * shade);
        const size = Math.max(1, Math.round((1.1 + r3 * 1.2) * (1 + arc * 0.8 + glow * 0.8) * dpr));
        ctx.fillStyle = `rgba(${red},${grn},${blu},${(alpha * (0.78 + 0.22 * r3)).toFixed(2)})`;
        ctx.fillRect(Math.round(x * dpr), Math.round(y * dpr), size, size);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />;
}
