'use client';
import { useEffect } from 'react';
import * as THREE from 'three';
import { prefersReducedMotion } from '@/lib/motion';

// "Blocky drag" hover for project images (after the ChainGPT Labs footer).
// The picture is cut into a grid of rectangular blocks; blocks near the cursor are dragged along
// with its movement, so the image tears and smears in steps along the cursor's path, then the
// blocks ease back into place. One small WebGL canvas is moved into whichever card is hovered.

const CELL = 22; // css px per block
const RADIUS = 110; // css px — how far from the cursor blocks get dragged
const STRENGTH = 0.9; // how much of the cursor's movement a block picks up
const RELAX = 0.9; // per-frame decay (closer to 1 = slower return)
const MAX_SHIFT = 0.18; // cap, in uv units

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
  precision highp float;
  uniform sampler2D uImage;
  uniform sampler2D uFlow;   // per-block offset (rg, -1..1 scaled), nearest-filtered -> blocky
  uniform vec4 uCover;       // media uv -> image uv (object-fit: cover, parallax shift)
  varying vec2 vUv;

  vec3 sampleImg(vec2 mediaUv) {
    vec2 uv = mediaUv * uCover.xy + uCover.zw;
    return texture2D(uImage, clamp(uv, 0.001, 0.999)).rgb;
  }

  void main() {
    vec2 off = (texture2D(uFlow, vUv).rg - 0.5) * 2.0 * ${MAX_SHIFT.toFixed(3)};
    vec2 uv = vUv - off;
    // A touch of colour split along the drag — reads as speed.
    float k = length(off) * 0.35;
    vec2 dir = length(off) > 0.0001 ? normalize(off) : vec2(0.0);
    float r = sampleImg(uv - dir * k * 0.06).r;
    float g = sampleImg(uv).g;
    float b = sampleImg(uv + dir * k * 0.06).b;
    gl_FragColor = vec4(r, g, b, 1.0);
  }
`;

export default function HoverDistort() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      left: '0px',
      top: '0px',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '0',
      opacity: '0',
    });

    // WebGL is created on first hover only; if the browser refuses, cards stay plain images.
    let renderer: THREE.WebGLRenderer | null = null;
    let unavailable = false;
    const ensureRenderer = () => {
      if (renderer) return true;
      if (unavailable) return false;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false });
        return true;
      } catch {
        unavailable = true;
        return false;
      }
    };

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const uniforms = {
      uImage: { value: null as THREE.Texture | null },
      uFlow: { value: null as THREE.DataTexture | null },
      uCover: { value: new THREE.Vector4(1, 1, 0, 0) },
    };
    const material = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, depthTest: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    scene.add(quad);

    // CPU-side block grid: offset per block in uv units, uploaded as a tiny nearest-filtered texture.
    let cols = 1, rows = 1;
    let fx = new Float32Array(1), fy = new Float32Array(1);
    let flowData = new Uint8Array(4);
    let flowTex: THREE.DataTexture | null = null;

    const makeGrid = (w: number, h: number) => {
      cols = Math.max(4, Math.round(w / CELL));
      rows = Math.max(4, Math.round(h / CELL));
      fx = new Float32Array(cols * rows);
      fy = new Float32Array(cols * rows);
      flowData = new Uint8Array(cols * rows * 4);
      flowTex?.dispose();
      flowTex = new THREE.DataTexture(flowData, cols, rows, THREE.RGBAFormat);
      flowTex.magFilter = flowTex.minFilter = THREE.NearestFilter;
      flowTex.needsUpdate = true;
      uniforms.uFlow.value = flowTex;
    };

    let media: HTMLElement | null = null;
    let img: HTMLImageElement | null = null;
    let hovering = false;
    let mx = 0, my = 0, pmx = 0, pmy = 0;
    let raf = 0, running = false;
    let w = 0, h = 0;

    const sync = () => {
      if (!media || !img || !renderer) return;
      const r = media.getBoundingClientRect();
      const nw = Math.round(r.width), nh = Math.round(r.height);
      if (nw !== w || nh !== h) {
        w = nw;
        h = nh;
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(w, h, false);
        makeGrid(w, h);
      }
      // Map media uv -> image uv exactly as the <img> is drawn (cover + parallax offset + hover scale).
      const ir = img.getBoundingClientRect();
      const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
      const s = Math.max(ir.width / iw, ir.height / ih);
      const dw = iw * s, dh = ih * s;
      const ox = ir.left - r.left + (ir.width - dw) / 2;
      const oy = ir.top - r.top + (ir.height - dh) / 2;
      // media uv (y up) -> media px (y down) -> image uv (y up, texture flipped)
      // u = (x*w - ox)/dw ; v = 1 - ((1-y)*h - oy)/dh = (y*h + oy + dh - h)/dh
      uniforms.uCover.value.set(w / dw, h / dh, -ox / dw, (oy + dh - h) / dh);
    };

    let energy = 0;
    const step = () => {
      if (!media) return;
      const r = media.getBoundingClientRect();
      const dx = (mx - pmx) / r.width; // cursor movement this frame, in uv
      const dy = -(my - pmy) / r.height;
      pmx += (mx - pmx) * 0.6;
      pmy += (my - pmy) * 0.6;
      const cx = (mx - r.left) / r.width; // cursor in uv (y up)
      const cy = 1 - (my - r.top) / r.height;
      const rx = RADIUS / r.width, ry = RADIUS / r.height;
      energy = 0;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          if (hovering) {
            const u = (i + 0.5) / cols, v = (j + 0.5) / rows;
            const ex = (u - cx) / rx, ey = (v - cy) / ry;
            const d2 = ex * ex + ey * ey;
            if (d2 < 1) {
              const f = (1 - d2) * (1 - d2) * STRENGTH;
              fx[k] += dx * f;
              fy[k] += dy * f;
            }
          }
          fx[k] = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, fx[k] * RELAX));
          fy[k] = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, fy[k] * RELAX));
          energy += Math.abs(fx[k]) + Math.abs(fy[k]);
          flowData[k * 4] = Math.round((fx[k] / MAX_SHIFT * 0.5 + 0.5) * 255);
          flowData[k * 4 + 1] = Math.round((fy[k] / MAX_SHIFT * 0.5 + 0.5) * 255);
          flowData[k * 4 + 2] = 0;
          flowData[k * 4 + 3] = 255;
        }
      }
      if (flowTex) flowTex.needsUpdate = true;
    };

    const loop = () => {
      sync();
      step();
      renderer!.render(scene, camera);
      if (hovering || energy > 0.002) raf = requestAnimationFrame(loop);
      else {
        running = false;
        release();
      }
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };

    const release = () => {
      if (img) img.style.opacity = '';
      canvas.style.opacity = '0';
      media = null;
      img = null;
    };

    const take = (m: HTMLElement) => {
      const i = m.querySelector('img');
      if (!i || !i.complete || !i.naturalWidth) return false;
      if (!ensureRenderer()) return false;
      if (media && media !== m) release();
      media = m;
      img = i;
      m.appendChild(canvas);
      // Copy through a 2D canvas (max 1024px): reliable upload, small GPU footprint.
      const k = Math.min(1, 1024 / Math.max(i.naturalWidth, i.naturalHeight));
      const copy = document.createElement('canvas');
      copy.width = Math.round(i.naturalWidth * k);
      copy.height = Math.round(i.naturalHeight * k);
      copy.getContext('2d')!.drawImage(i, 0, 0, copy.width, copy.height);
      const tex = new THREE.CanvasTexture(copy);
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      uniforms.uImage.value?.dispose();
      uniforms.uImage.value = tex;
      w = h = 0; // force grid rebuild for this card
      pmx = mx;
      pmy = my;
      sync();
      renderer!.render(scene, camera); // draw once before swapping, so there is no flash
      canvas.style.opacity = '1';
      i.style.opacity = '0';
      return true;
    };

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      const m = (e.target as Element | null)?.closest<HTMLElement>('[data-w-media]') ?? null;
      if (m) {
        if (m !== media && !take(m)) return;
        hovering = true;
        start();
      } else hovering = false;
    };
    const onLeave = () => {
      hovering = false;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      release();
      quad.geometry.dispose();
      material.dispose();
      flowTex?.dispose();
      uniforms.uImage.value?.dispose();
      renderer?.dispose();
      canvas.remove();
    };
  }, []);

  return null;
}
