'use client';
import { useEffect } from 'react';
import * as THREE from 'three';
import { prefersReducedMotion } from '@/lib/motion';

// "Magnet" hover for project images.
// When the pointer enters a project picture, the picture is swapped for a field of tiny particles
// (one per few pixels, coloured from the image). The cursor repels them like a magnet of the same
// pole: a hole opens under it, particles pile up around the edge, and they spring back into place
// once the cursor moves on. One shared WebGL canvas is moved into whichever card is hovered.

const STEP = 2.5; // css px between particles
const RADIUS = 70; // css px — reach of the "magnet"
const PUSH = 46; // css px — how far particles are pushed at the centre

const vert = /* glsl */ `
  uniform vec2 uSize;        // canvas (media box) size, css px
  uniform vec2 uMouse;       // pointer in canvas px (y down)
  uniform float uDpr;
  uniform float uStep;
  uniform sampler2D uField;  // repel strength field (r channel), low-res, fades over time
  attribute vec2 aPos;       // rest position, css px (y down)
  attribute float aRand;
  varying vec2 vPos;
  varying float vPush;

  void main() {
    vec2 uv = aPos / uSize;
    float f = texture2D(uField, vec2(uv.x, 1.0 - uv.y)).r;

    // Push away from the cursor; a little per-particle randomness so the edge looks granular.
    vec2 d = aPos - uMouse;
    float len = max(length(d), 0.001);
    vec2 dir = d / len;
    float ang = (aRand - 0.5) * 1.2;
    dir = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * dir;
    vec2 p = aPos + dir * f * ${PUSH.toFixed(1)} * (0.6 + aRand * 0.8);

    vPos = aPos;
    vPush = f;
    vec2 clip = (p / uSize) * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
    // Slightly larger than the spacing at rest so the picture reads solid; shrink when pushed.
    gl_PointSize = uStep * uDpr * mix(1.08, 0.7, f);
  }
`;

const frag = /* glsl */ `
  precision highp float;
  uniform sampler2D uImage;
  uniform vec2 uSize;
  uniform vec4 uCover;  // xy = scale, zw = offset: maps media px -> image uv (object-fit: cover)
  varying vec2 vPos;
  varying float vPush;
  void main() {
    vec2 uv = vPos * uCover.xy + uCover.zw;
    vec4 c = texture2D(uImage, vec2(uv.x, 1.0 - uv.y));
    // Pushed particles brighten a touch, like they catch the light.
    c.rgb = mix(c.rgb, c.rgb * 1.15 + 0.04, vPush);
    gl_FragColor = vec4(c.rgb, 1.0);
  }
`;

export default function HoverParticles() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const canvas = document.createElement('canvas');
    // Lives inside the hovered media box (under the tag pill, clipped by the card frame).
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

    // The WebGL context is created on first hover only (not on page load), and if the browser
    // refuses one the cards simply stay plain images.
    let renderer: THREE.WebGLRenderer | null = null;
    let unavailable = false;
    const ensureRenderer = () => {
      if (renderer) return true;
      if (unavailable) return false;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: false });
        renderer.setClearColor(0x000000, 0);
        return true;
      } catch {
        unavailable = true;
        return false;
      }
    };
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();

    // Repel field: a small 2D canvas we paint soft dots into at the cursor, faded every frame.
    const FIELD = 128;
    const fieldCanvas = document.createElement('canvas');
    fieldCanvas.width = fieldCanvas.height = FIELD;
    const fctx = fieldCanvas.getContext('2d')!;
    const fieldTex = new THREE.CanvasTexture(fieldCanvas);
    fieldTex.minFilter = fieldTex.magFilter = THREE.LinearFilter;

    const uniforms = {
      uSize: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(-9999, -9999) },
      uDpr: { value: 1 },
      uStep: { value: STEP },
      uField: { value: fieldTex },
      uImage: { value: null as THREE.Texture | null },
      uCover: { value: new THREE.Vector4(1, 1, 0, 0) },
    };
    const material = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, depthTest: false });
    let points: THREE.Points | null = null;
    if (process.env.NODE_ENV !== 'production') (window as unknown as Record<string, unknown>).__hp = { uniforms, material, fieldCanvas };

    let media: HTMLElement | null = null;
    let img: HTMLImageElement | null = null;
    let hovering = false;
    let mx = -9999, my = -9999; // pointer, viewport px
    let raf = 0;
    let running = false;
    let energy = 0; // total field strength — lets us stop when everything has settled

    const buildGrid = (w: number, h: number) => {
      const cols = Math.ceil(w / STEP), rows = Math.ceil(h / STEP);
      const pos = new Float32Array(cols * rows * 2);
      const rnd = new Float32Array(cols * rows);
      let k = 0;
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          pos[k * 2] = (x + 0.5) * STEP;
          pos[k * 2 + 1] = (y + 0.5) * STEP;
          rnd[k] = Math.random();
          k++;
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('aPos', new THREE.BufferAttribute(pos, 2));
      g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
      // Dummy position attribute (three needs one to know the vertex count).
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cols * rows * 3), 3));
      return g;
    };

    // Keep the canvas glued to the hovered media box and the image mapping in sync with
    // what's on screen (parallax shift, scale, object-fit: cover).
    let gridW = 0, gridH = 0;
    const sync = () => {
      if (!media || !img) return;
      const r = media.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w !== gridW || h !== gridH) {
        gridW = w;
        gridH = h;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderer!.setPixelRatio(dpr);
        renderer!.setSize(w, h, false);
        uniforms.uDpr.value = dpr;
        uniforms.uSize.value.set(w, h);
        if (points) {
          scene.remove(points);
          points.geometry.dispose();
        }
        points = new THREE.Points(buildGrid(w, h), material);
        points.frustumCulled = false;
        scene.add(points);
      }
      // Where the image element sits inside the media box (it is taller for parallax, and may be scaled).
      const ir = img.getBoundingClientRect();
      const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
      const s = Math.max(ir.width / iw, ir.height / ih); // cover scale, css px per image px
      const dw = iw * s, dh = ih * s;
      const ox = ir.left - r.left + (ir.width - dw) / 2;
      const oy = ir.top - r.top + (ir.height - dh) / 2;
      // uv = (mediaPx - offset) / drawnSize
      uniforms.uCover.value.set(1 / dw, 1 / dh, -ox / dw, -oy / dh);
      uniforms.uMouse.value.set(mx - r.left, my - r.top);
    };

    const paintField = () => {
      // Fade the whole field a bit each frame -> particles drift home after the cursor leaves.
      fctx.globalCompositeOperation = 'source-over';
      fctx.fillStyle = 'rgba(0,0,0,0.075)';
      const FW = fieldCanvas.width, FH = fieldCanvas.height;
      fctx.fillRect(0, 0, FW, FH);
      if (hovering && media) {
        // The field has the card's aspect ratio, so a circle here is a circle on screen.
        const r = media.getBoundingClientRect();
        const fx = ((mx - r.left) / r.width) * FW;
        const fy = ((my - r.top) / r.height) * FH;
        const rad = (RADIUS / r.width) * FW;
        const g = fctx.createRadialGradient(fx, fy, 0, fx, fy, rad);
        g.addColorStop(0, 'rgba(255,0,0,0.55)');
        g.addColorStop(0.45, 'rgba(255,0,0,0.3)');
        g.addColorStop(1, 'rgba(255,0,0,0)');
        fctx.globalCompositeOperation = 'lighter';
        fctx.fillStyle = g;
        fctx.beginPath();
        fctx.arc(fx, fy, rad, 0, Math.PI * 2);
        fctx.fill();
      }
      fieldTex.needsUpdate = true;
      // Cheap settle check: sample a sparse grid of the field.
      const d = fctx.getImageData(0, 0, FW, FH).data;
      let e = 0;
      for (let i = 0; i < d.length; i += 4 * 37) e += d[i];
      energy = e;
    };

    const loop = () => {
      sync();
      paintField();
      renderer!.render(scene, camera);
      if (hovering || energy > 2) {
        raf = requestAnimationFrame(loop);
      } else {
        // Fully settled: show the real <img> again and park the canvas.
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
      m.appendChild(canvas);
      img = i;
      // Copy through a 2D canvas (capped at 1024px): uploads reliably and keeps GPU memory small.
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
      const mr = m.getBoundingClientRect();
      fieldCanvas.width = FIELD;
      fieldCanvas.height = Math.max(16, Math.round((FIELD * mr.height) / mr.width));
      fieldTex.dispose(); // size changed -> let three reallocate it
      fctx.clearRect(0, 0, fieldCanvas.width, fieldCanvas.height);
      gridW = gridH = 0; // force a resize for the new card
      sync();
      renderer!.render(scene, camera); // first frame before swapping, so there is no flash
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
      } else {
        hovering = false; // field fades, particles return, then release()
      }
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
      points?.geometry.dispose();
      material.dispose();
      fieldTex.dispose();
      uniforms.uImage.value?.dispose();
      renderer?.dispose();
      canvas.remove();
    };
  }, []);

  return null;
}
