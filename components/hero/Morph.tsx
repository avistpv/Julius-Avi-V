'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useCaesarGeometry } from '@/components/three/useCaesar';
import { store, sky } from '@/lib/store';
import { isSoftwareGL } from '@/lib/gpu';

// Dust -> Caesar.
// In the hero a round cloud of blue dust floats under the slogan: it breathes, swirls slowly and
// shies away from the mouse. As you scroll into the intro the dust flies onto the surface of
// Caesar's bust in the figure slot; then a glowing scan line rises through the figure: below it
// the glass bust is already there, above it the particles still hold the shape and flare out as
// the line passes. Pure function of scroll (store.morph), so it reverses cleanly.

const COUNT = 14000;
export const SWEEP_START = 0.8; // particles have landed; the scan line starts rising
export const SWEEP_END = 1.0; // ...and has passed the top of the head
const WARM_FRAME = 3; // frame on which the hidden glass shader is precompiled

const vert = /* glsl */ `
  uniform mat4 uMatA;
  uniform mat4 uMatB;
  uniform float uM;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixel;
  uniform float uSweepY;   // world-space height of the scan line
  uniform float uBand;     // half-height of its glow
  uniform vec2 uMouse;     // pointer, world units on the z = 0 plane
  uniform float uRadius;   // cloud radius, world units
  uniform float uRepel;    // 0..1 how much the dust still answers the mouse
  attribute vec3 aA;
  attribute vec3 aB;
  attribute vec4 aRand;
  varying float vArc;
  varying float vSweep; // 0 below the line (gone), 1 above (still a particle)
  varying float vGlow;  // 1 right at the line
  void main() {
    vec3 a = (uMatA * vec4(aA, 1.0)).xyz;
    vec3 b = (uMatB * vec4(aB, 1.0)).xyz;
    // Everyone has landed by m = 0.8, so the scan line always walks across a finished figure.
    float d = aRand.x * 0.25;
    float t = clamp((uM - d) / 0.55, 0.0, 1.0);
    float e = t * t * (3.0 - 2.0 * t);
    float arc = sin(e * 3.14159265);
    vec3 p = mix(a, b, e);
    // In the cloud: breathe and drift, and part around the pointer.
    float idle = 1.0 - e;
    p += vec3(sin(uTime * 0.6 + aRand.y * 6.2832), cos(uTime * 0.5 + aRand.z * 6.2832), sin(uTime * 0.4 + aRand.w * 6.2832))
         * 0.05 * uRadius * idle;
    vec2 dm = p.xy - uMouse;
    float dist = length(dm);
    float push = exp(-(dist * dist) / (uRadius * uRadius * 0.28)) * uRepel * idle;
    p.xy += (dm / max(dist, 1e-4)) * push * uRadius * 0.7;
    // A lazy swirl on the way to the bust.
    p += (aRand.yzw * 2.0 - 1.0) * arc * 0.45 + vec3(0.0, arc * 0.3, arc * 0.5);
    p.xy += vec2(sin(uTime * 1.3 + aRand.x * 40.0), cos(uTime * 1.1 + aRand.y * 40.0)) * 0.04 * arc;
    vArc = arc;
    float dy = p.y - uSweepY;
    vSweep = smoothstep(-uBand, uBand, dy);
    vGlow = exp(-abs(dy) / uBand);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixel * (1.0 + arc * 0.9 + vGlow * 0.8) * (10.0 / -mv.z);
  }
`;

const frag = /* glsl */ `
  precision highp float;
  uniform float uAlpha;
  varying float vArc;
  varying float vSweep;
  varying float vGlow;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.15, r);
    vec3 glass = vec3(0.29, 0.47, 0.9);
    vec3 col = mix(glass, vec3(0.78, 0.86, 1.0), 0.15 + vArc * 0.5);
    col = mix(col, vec3(1.0), vGlow * 0.7); // flare at the scan line
    gl_FragColor = vec4(col, soft * uAlpha * 0.95 * max(vSweep, vGlow * 0.9));
  }
`;

// Where the dust lives in the hero: a soft ball of radius 1 (scaled per frame), denser inside,
// with a thin haze around it.
function sampleCloud(): Float32Array {
  const out = new Float32Array(COUNT * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < COUNT; i++) {
    const halo = Math.random() < 0.12;
    const r = halo ? 1 + Math.pow(Math.random(), 2) * 0.6 : Math.cbrt(Math.random()) * 0.98;
    p.randomDirection().multiplyScalar(r);
    out.set([p.x, p.y, p.z * 0.75], i * 3);
  }
  return out;
}

function sampleBust(geo: THREE.BufferGeometry): Float32Array {
  // Area-weighted random points on the bust's triangles.
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const idx = geo.getIndex();
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const vi = (t: number, k: number) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const areas = new Float32Array(triCount);
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    A.fromBufferAttribute(pos, vi(t, 0));
    B.fromBufferAttribute(pos, vi(t, 1));
    C.fromBufferAttribute(pos, vi(t, 2));
    total += new THREE.Triangle(A, B, C).getArea();
    areas[t] = total;
  }
  const out = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = Math.random() * total;
    let lo = 0, hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (areas[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    A.fromBufferAttribute(pos, vi(lo, 0));
    B.fromBufferAttribute(pos, vi(lo, 1));
    C.fromBufferAttribute(pos, vi(lo, 2));
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const p = A.clone().multiplyScalar(1 - u - v).addScaledVector(B, u).addScaledVector(C, v);
    out.set([p.x, p.y, p.z], i * 3);
  }
  return out;
}

export default function Morph() {
  const geo = useCaesarGeometry();
  const bust = useRef<THREE.Mesh>(null);
  const viewport = useThree((s) => s.viewport);
  const gl = useThree((s) => s.gl);
  // Glass is shown only below the scan line (y <= constant).
  const clip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e4), []);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const [buffer, setBuffer] = useState<THREE.Texture | null>(sky.texture);
  useEffect(() => {
    if (buffer) return;
    const id = setInterval(() => sky.texture && (setBuffer(sky.texture), clearInterval(id)), 30);
    return () => clearInterval(id);
  }, [buffer]);

  const points = useMemo(() => {
    if (!geo) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('aA', new THREE.BufferAttribute(sampleCloud(), 3));
    g.setAttribute('aB', new THREE.BufferAttribute(sampleBust(geo), 3));
    const rnd = new Float32Array(COUNT * 4);
    for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMatA: { value: new THREE.Matrix4() },
        uMatB: { value: new THREE.Matrix4() },
        uM: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: 3.0 },
        uPixel: { value: 1 },
        uAlpha: { value: 0 },
        uSweepY: { value: -1e4 },
        uBand: { value: 0.05 },
        uMouse: { value: new THREE.Vector2(1e4, 1e4) },
        uRadius: { value: 1 },
        uRepel: { value: 0 },
      },
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    return pts;
  }, [geo]);

  useEffect(() => () => {
    points?.geometry.dispose();
    (points?.material as THREE.Material | undefined)?.dispose();
  }, [points]);

  const cloudMat = useMemo(() => new THREE.Matrix4(), []);
  const mouseW = useMemo(() => new THREE.Vector2(1e4, 1e4), []);
  const mouseT = useMemo(() => new THREE.Vector2(), []);
  const appear = useRef(0);
  const warmFrames = useRef(0);

  useFrame((state, dt) => {
    const b = bust.current;
    if (!b || !points) return;
    const time = state.clock.elapsedTime;
    const m = store.morph;
    const vw = viewport.width, vh = viewport.height;
    if (store.ready) appear.current = Math.min(1, appear.current + dt / 1.6);

    // The cloud sits under the slogan and scrolls with the page until the morph takes over.
    const pxToWorld = vh / size.height;
    const R = vh * 0.21 * THREE.MathUtils.smoothstep(appear.current, 0, 1);
    const cloudY = -vh * 0.17 + store.scroll * pxToWorld;
    cloudMat.compose(new THREE.Vector3(0, cloudY, 0), new THREE.Quaternion(), new THREE.Vector3(R, R, R));

    // Place the bust over the intro slot (DOM px -> world units on the z = 0 plane).
    const { x, y, w, h } = store.anchor;
    const cx = ((x + w / 2) / size.width - 0.5) * vw;
    const cy = -((y + h / 2) / size.height - 0.5) * vh;
    const s = (h / size.height) * vh * 0.94;
    b.position.set(cx, cy + Math.sin(time * 0.8) * s * 0.012, 0);
    b.scale.setScalar(s);
    b.rotation.y = THREE.MathUtils.damp(b.rotation.y, store.mouse.x * 0.7 + Math.sin(time * 0.35) * 0.18, 2.5, dt);
    b.rotation.x = THREE.MathUtils.damp(b.rotation.x, -store.mouse.y * 0.15, 2.5, dt);
    b.updateMatrixWorld();

    // Scan line: from just under the pedestal to just over the head.
    const k = THREE.MathUtils.smoothstep(m, SWEEP_START, SWEEP_END);
    const sweepY = m >= SWEEP_END ? 1e4 : THREE.MathUtils.lerp(cy - s * 0.53, cy + s * 0.53, k);
    clip.constant = sweepY;
    b.visible = m > SWEEP_START;
    // Compile the glass a few frames in (the environment map exists by then) while the bust is still
    // hidden; otherwise the first frame of the scan line stalls for 200-450 ms. Not on software WebGL:
    // there the compile runs on the CPU and would block the page for ~1.5 s during load.
    if (!isSoftwareGL() && warmFrames.current < WARM_FRAME && ++warmFrames.current === WARM_FRAME) {
      state.gl.compileAsync(b, state.camera, state.scene).catch(() => {});
    }

    // Pointer in world units, eased so the dust parts smoothly.
    mouseT.set(store.mouse.x * vw * 0.5, store.mouse.y * vh * 0.5);
    mouseW.lerp(mouseT, 0.12);

    const u = (points.material as THREE.ShaderMaterial).uniforms;
    u.uMatA.value.copy(cloudMat);
    u.uMatB.value.copy(b.matrixWorld);
    u.uM.value = m;
    u.uTime.value = time;
    u.uPixel.value = dpr;
    u.uAlpha.value = THREE.MathUtils.smoothstep(appear.current, 0, 0.6);
    u.uSweepY.value = m > SWEEP_START ? sweepY : -1e4;
    u.uBand.value = s * 0.035;
    u.uMouse.value.copy(mouseW);
    u.uRadius.value = Math.max(R, 1e-3);
    u.uRepel.value = 1 - THREE.MathUtils.smoothstep(m, 0, 0.25);
    points.visible = appear.current > 0 && m < SWEEP_END;
  });

  if (!geo || !buffer) return null;
  return (
    <>
      {points && <primitive object={points} />}
      <mesh ref={bust} geometry={geo} visible={false}>
        <MeshTransmissionMaterial
          buffer={buffer}
          clippingPlanes={[clip]}
          samples={4}
          transmission={1}
          thickness={0.8}
          roughness={0.18}
          ior={1.32}
          chromaticAberration={0.06}
          anisotropicBlur={0.1}
          clearcoat={1}
          clearcoatRoughness={0.05}
          envMapIntensity={2.2}
          color="#d6e6fc"
          attenuationColor="#8fb3f2"
          attenuationDistance={5}
        />
      </mesh>
    </>
  );
}
