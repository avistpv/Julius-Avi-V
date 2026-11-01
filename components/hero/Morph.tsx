'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useCaesarGeometry } from '@/components/three/useCaesar';
import { store, sky, morphShared } from '@/lib/store';

// Caesar — the hero object.
// On load (after the preloader) a cloud of blue dust gathers onto the surface of the bust; then a
// glowing scan line rises through the figure: below it the glass bust is already there, above it
// the particles still hold the shape and flare out as the line passes (store.assemble, time-driven).
// On scroll the finished bust glides from its hero pose on the right into the intro's figure slot
// (store.morph, scroll-driven), so it reverses cleanly.

const COUNT = 14000;
export const SWEEP_START = 0.8; // particles have landed; the scan line starts rising
export const SWEEP_END = 1.0; // ...and has passed the top of the head
const ASSEMBLE_TIME = 2.8; // seconds for the whole gathering

const vert = /* glsl */ `
  uniform mat4 uMatA;
  uniform mat4 uMatB;
  uniform float uM;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixel;
  uniform float uSweepY;   // world-space height of the scan line
  uniform float uBand;     // half-height of its glow
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
    // A lazy swirl on the way in.
    p += (aRand.yzw * 2.0 - 1.0) * arc * 0.35 + vec3(0.0, arc * 0.25, arc * 0.4);
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

// Where the dust starts: a wide, loose cloud around the bust (bust-local units, bust ≈ 1 tall).
function sampleCloud(): Float32Array {
  const out = new Float32Array(COUNT * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < COUNT; i++) {
    p.randomDirection().multiplyScalar(0.6 + Math.pow(Math.random(), 0.6) * 1.6);
    p.x *= 1.6;
    p.z *= 0.7;
    out.set([p.x, p.y + 0.1, p.z], i * 3);
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

// Where the laurel sits on the head: a ring a little below the top of the bust.
function findHead(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
  const lo = maxY - 0.19, hi = maxY - 0.09; // forehead height, where a laurel actually sits
  const c = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > lo && y < hi) { c.x += pos.getX(i); c.y += y; c.z += pos.getZ(i); n++; }
  }
  if (!n) return;
  c.divideScalar(n);
  let r = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > lo && y < hi) r += Math.hypot(pos.getX(i) - c.x, pos.getZ(i) - c.z);
  }
  morphShared.headCenter.copy(c);
  morphShared.headRadius = r / n;
}

const ease = (t: number) => t * t * (3 - 2 * t);

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
    findHead(geo);
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

  useFrame((state, dt) => {
    const b = bust.current;
    if (!b || !points) return;
    const time = state.clock.elapsedTime;

    // Time-driven assembly once the preloader has gone.
    if (store.ready) store.assemble = Math.min(1, store.assemble + dt / ASSEMBLE_TIME);
    const m = store.assemble;

    // Hero pose: right of the headline, a little above centre, drifting up as the page scrolls.
    const vw = viewport.width, vh = viewport.height;
    const hx = (0.74 - 0.5) * vw;
    const hy = -(0.5 - 0.5) * vh + store.heroProgress * vh * 0.18;
    const hs = vh * 0.72;
    // Intro pose: over the figure slot (DOM px -> world units on the z = 0 plane).
    const { x, y, w, h } = store.anchor;
    const ax = ((x + w / 2) / size.width - 0.5) * vw;
    const ay = -((y + h / 2) / size.height - 0.5) * vh;
    const as = (h / size.height) * vh * 0.94;
    const k = w > 0 ? ease(store.morph) : 0;
    const cx = THREE.MathUtils.lerp(hx, ax, k);
    const cy = THREE.MathUtils.lerp(hy, ay, k);
    const s = THREE.MathUtils.lerp(hs, as, k);

    b.position.set(cx, cy + Math.sin(time * 0.8) * s * 0.012, 0);
    b.scale.setScalar(s);
    // Faces the reader, turns a little after the mouse; turns away and back while travelling.
    const turn = Math.sin(k * Math.PI) * 0.9;
    b.rotation.y = THREE.MathUtils.damp(b.rotation.y, -0.35 + store.mouse.x * 0.55 + Math.sin(time * 0.35) * 0.12 + turn, 2.5, dt);
    b.rotation.x = THREE.MathUtils.damp(b.rotation.x, -store.mouse.y * 0.15, 2.5, dt);
    b.updateMatrixWorld();
    morphShared.bustMatrix.copy(b.matrixWorld);
    morphShared.bustReady = true;

    // Scan line: from just under the pedestal to just over the head.
    const sk = THREE.MathUtils.smoothstep(m, SWEEP_START, SWEEP_END);
    const sweepY = m >= SWEEP_END ? 1e4 : THREE.MathUtils.lerp(cy - s * 0.53, cy + s * 0.53, sk);
    clip.constant = sweepY;
    b.visible = m > SWEEP_START;

    const u = (points.material as THREE.ShaderMaterial).uniforms;
    u.uMatA.value.copy(b.matrixWorld);
    u.uMatB.value.copy(b.matrixWorld);
    u.uM.value = m;
    u.uTime.value = time;
    u.uPixel.value = dpr;
    u.uAlpha.value = THREE.MathUtils.smoothstep(m, 0, 0.08);
    u.uSweepY.value = m > SWEEP_START ? sweepY : -1e4;
    u.uBand.value = s * 0.035;
    points.visible = m > 0 && m < SWEEP_END;
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
