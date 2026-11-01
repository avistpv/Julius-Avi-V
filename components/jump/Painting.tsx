'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { store } from '@/lib/store';
import { ETCH_FROM, ETCH_TO, FLY_FROM, FLY_TO, PUSH_FROM, PUSH_TO, range, smooth } from './phases';

// The far layer of the jump: the painted landscape as a full-screen shader.
// - continuous dolly-in (uScale) + mouse parallax, so the camera never stops;
// - uEtch: the painting dissolves block by block into a glowing line etching on a night sky
//   (Sobel edges of the painting itself, no second image needed);
// - uFly: the lines fall behind and the stars remain.
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uRes;
  uniform float uTexAspect;
  uniform float uScale;
  uniform vec2 uOffset;
  uniform float uShade;
  uniform float uEtch;
  uniform float uFly;
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  // Cover-fit the painting, then zoom about a point just above the horizon.
  vec2 paintUv(vec2 uv) {
    float sa = uRes.x / uRes.y;
    vec2 s = sa > uTexAspect ? vec2(1.0, uTexAspect / sa) : vec2(sa / uTexAspect, 1.0);
    vec2 p = (uv - 0.5) * s + 0.5;
    vec2 o = vec2(0.5, 0.42);
    return (p - o) / uScale + o + uOffset;
  }

  void main() {
    vec2 uv = paintUv(vUv);
    vec3 col = texture2D(uTex, uv).rgb;

    // Sobel edges -> the "engraved" lines. Sampled from a blurrier mip so brushwork and
    // craquelure drop out and only real contours (horizon, ruins, trees) remain.
    vec2 px = 2.2 / vec2(2688.0, 1520.0) / uScale;
    float bias = 2.0;
    float tl = lum(texture2D(uTex, uv + vec2(-px.x,  px.y), bias).rgb);
    float t  = lum(texture2D(uTex, uv + vec2( 0.0,   px.y), bias).rgb);
    float tr = lum(texture2D(uTex, uv + vec2( px.x,  px.y), bias).rgb);
    float l  = lum(texture2D(uTex, uv + vec2(-px.x,  0.0 ), bias).rgb);
    float r  = lum(texture2D(uTex, uv + vec2( px.x,  0.0 ), bias).rgb);
    float bl = lum(texture2D(uTex, uv + vec2(-px.x, -px.y), bias).rgb);
    float b  = lum(texture2D(uTex, uv + vec2( 0.0,  -px.y), bias).rgb);
    float br = lum(texture2D(uTex, uv + vec2( px.x, -px.y), bias).rgb);
    float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
    float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
    float g = length(vec2(gx, gy));
    float e = smoothstep(0.10, 0.55, g);
    // Sparse hatching only in the deep shadows (ground, trees), never in the sky.
    float dark = smoothstep(0.55, 0.2, lum(texture2D(uTex, uv, 3.0).rgb));
    float hatch = step(0.6, fract((vUv.x + vUv.y * 0.6) * uRes.y * 0.16)) * dark * 0.05;

    // Night world: deep blue, stars fixed to the screen, drifting slowly.
    vec3 night = mix(vec3(0.025, 0.03, 0.075), vec3(0.07, 0.06, 0.12), vUv.y);
    vec2 sp = (vUv + uOffset * 0.4 + vec2(0.0, uFly * 0.08)) * uRes / 3.0;
    float sh = hash(floor(sp));
    float star = smoothstep(0.987, 1.0, sh) * (0.45 + 0.55 * sin(uTime * 1.7 + sh * 60.0)) * (0.6 + 1.1 * uFly);
    vec3 ink = mix(vec3(1.0, 0.72, 0.38), vec3(1.0, 0.95, 0.85), e);
    vec3 etch = night + ink * (e * 1.5 + hatch) + vec3(star);

    // Blocky multi-scale dissolve, Editions-style. Blocks flash as they flip.
    float n1 = hash(floor(vUv * vec2(72.0, 40.0)));
    float n2 = hash(floor(vUv * vec2(18.0, 10.0)) + 7.0);
    float n3 = hash(floor(vUv * vec2(6.0, 3.4)) + 19.0);
    float n = n1 * 0.45 + n2 * 0.35 + n3 * 0.2;
    // Two fronts: a block first turns into a flat mosaic tile of the painting, then into the night.
    float th = uEtch * 1.35 - 0.1;
    float m = step(n, th - 0.18);
    float mosaicM = step(n, th) * (1.0 - m);
    vec2 cell = vec2(72.0, 40.0);
    vec3 mosaic = texture2D(uTex, paintUv((floor(vUv * cell) + 0.5) / cell), 4.0).rgb;
    float band = smoothstep(0.03, 0.0, abs(n - th)) * step(0.001, uEtch) * step(uEtch, 0.999);

    vec3 painting = col * (1.0 - uShade);
    vec3 outc = mix(painting, mosaic * 1.08, mosaicM);
    outc = mix(outc, etch, m) + band * vec3(1.0, 0.95, 0.8) * 0.7;
    // Flying on: the lines fall behind, the stars stay.
    outc = mix(outc, night + vec3(star) * 1.2 + ink * e * 0.9, uFly * m * 0.8);
    // Soft vignette in the night.
    float vig = 1.0 - 0.35 * m * uFly * smoothstep(0.3, 0.9, length(vUv - 0.5));
    gl_FragColor = vec4(outc * vig, 1.0);
  }
`;

export default function Painting() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = {
      uTex: { value: null as THREE.Texture | null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTexAspect: { value: 2688 / 1520 },
      uScale: { value: 1.3 },
      uOffset: { value: new THREE.Vector2() },
      uShade: { value: 0.35 },
      uEtch: { value: 0 },
      uFly: { value: 0 },
      uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    let ready = false;
    new THREE.TextureLoader().load('/jump/landscape.webp', (tex) => {
      // Raw shader: leave colorSpace untouched (see CONCEPT gotchas).
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      uniforms.uTex.value = tex;
      ready = true;
    });

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    // Only render while the stage is on screen.
    let visible = false;
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 });
    io.observe(canvas);

    const m = { x: 0, y: 0 };
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || !ready) return;
      const p = store.jump;
      m.x += (store.mouse.x - m.x) * 0.06;
      m.y += (store.mouse.y - m.y) * 0.06;
      const push = range(p, PUSH_FROM, PUSH_TO);
      const after = range(p, PUSH_TO, 1);
      const etch = smooth(range(p, ETCH_FROM, ETCH_TO));
      const fly = smooth(range(p, FLY_FROM, FLY_TO));
      // Zoom out a little as we pass the arch (we are "inside" now), then keep dollying in.
      uniforms.uScale.value = 1.3 - 0.28 * smooth(push) + 0.42 * after + 0.5 * fly;
      uniforms.uOffset.value.set(-m.x * 0.012, m.y * 0.01 - after * 0.02);
      uniforms.uShade.value = 0.35 * (1 - smooth(push));
      uniforms.uEtch.value = etch;
      uniforms.uFly.value = fly;
      uniforms.uTime.value = (now - start) / 1000;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
      mat.dispose();
      uniforms.uTex.value?.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} aria-hidden />;
}
