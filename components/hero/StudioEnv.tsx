'use client';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Studio lighting for the glass, built from a tiny procedural equirect (64×32 px): a soft sky
// gradient, a big warm softbox above, two cool side lights, a faint blue floor bounce. PMREM of a
// texture this small costs almost nothing — unlike rendering a scene of Lightformers at load.
const W = 64, H = 32;

function studioTexture() {
  const data = new Float32Array(W * H * 4);
  const lights = [
    { u: 0.5, v: 0.12, r: 0.22, c: [1.0, 0.97, 0.9], i: 4 }, // top softbox
    { u: 0.22, v: 0.45, r: 0.12, c: [0.95, 0.97, 1.0], i: 2.4 }, // left
    { u: 0.78, v: 0.5, r: 0.12, c: [0.95, 0.97, 1.0], i: 2 }, // right
    { u: 0.6, v: 0.3, r: 0.07, c: [1.0, 0.94, 0.84], i: 3 }, // warm ring
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, v = (y + 0.5) / H;
      // Base: pale warm above, blue-grey below.
      let r = 0.94 - 0.25 * v, g = 0.93 - 0.2 * v, b = 0.92 - 0.05 * v;
      if (v > 0.72) { r = 0.6; g = 0.7; b = 0.92; }
      for (const l of lights) {
        const du = Math.min(Math.abs(u - l.u), 1 - Math.abs(u - l.u)), dv = v - l.v;
        const d = Math.hypot(du, dv) / l.r;
        const k = Math.exp(-d * d) * l.i;
        r += l.c[0] * k; g += l.c[1] * k; b += l.c[2] * k;
      }
      const o = (y * W + x) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export default function StudioEnv() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const src = studioTexture();
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromEquirectangular(src).texture;
    scene.environment = env;
    src.dispose();
    pmrem.dispose();
    return () => { scene.environment = null; env.dispose(); };
  }, [gl, scene]);
  return null;
}
