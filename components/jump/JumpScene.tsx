'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { makeLaurel, makeLaurelMaterial, LEAF_COUNT } from '@/components/three/laurel';
import { store } from '@/lib/store';
import { ARCH_Z, cameraZ, worldAt } from './phases';

/* ======================================================================================
   World sky — four moods blended by `uWorld` (0 light sky, 1 golden hour, 2 violet dusk,
   3 open space). Rendered into a small texture (it's soft by design) that is both shown
   full-screen and refracted by the glass arches.
   ====================================================================================== */
const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
const skyFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uWorld;
  uniform vec2 uRes;
  uniform vec2 uMouse;

  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g);
  }
  float fbm(vec2 p) { float f = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { f += a * snoise(p); p *= 1.9; a *= 0.45; } return f; }

  // Palette per world: top, bottom, cloud colour, cloud amount.
  void world(float w, out vec3 top, out vec3 bot, out vec3 cl, out float amt) {
    if (w < 0.5)      { top = vec3(0.86,0.91,0.96); bot = vec3(0.953,0.949,0.933); cl = vec3(1.0,0.97,0.9);  amt = 0.55; }
    else if (w < 1.5) { top = vec3(0.97,0.66,0.45); bot = vec3(0.99,0.88,0.69); cl = vec3(1.0,0.95,0.84); amt = 0.7; }
    else if (w < 2.5) { top = vec3(0.13,0.12,0.42); bot = vec3(0.52,0.36,0.82); cl = vec3(0.8,0.68,1.0);  amt = 0.5; }
    else              { top = vec3(0.01,0.012,0.03); bot = vec3(0.04,0.05,0.14); cl = vec3(0.2,0.24,0.62); amt = 0.35; }
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) + uMouse * 0.03;
    float t = uTime * 0.03;
    vec2 q = vec2(p.x * 0.5, p.y * 1.1);
    vec2 wv = vec2(fbm(q + vec2(t, -t)), fbm(q + vec2(3.1 - t, 1.7 + t)));
    float n = fbm(q + 0.9 * wv + vec2(t * 0.5, 0.0));

    float w = clamp(uWorld, 0.0, 3.0);
    float w0 = floor(w), w1 = min(3.0, w0 + 1.0), k = smoothstep(0.0, 1.0, w - w0);
    vec3 ta, ba, ca, tb, bb, cb; float aa, ab;
    world(w0, ta, ba, ca, aa); world(w1, tb, bb, cb, ab);
    vec3 top = mix(ta, tb, k), bot = mix(ba, bb, k), cl = mix(ca, cb, k); float amt = mix(aa, ab, k);

    vec3 col = mix(bot, top, smoothstep(0.0, 1.0, vUv.y));
    col = mix(col, cl, smoothstep(0.0, 0.8, n) * amt);
    // A low sun/glow behind the gates, strongest at golden hour.
    float glow = exp(-length((vUv - vec2(0.5, 0.45)) * vec2(1.6, 2.2)) * 3.0);
    col += glow * mix(vec3(0.05), vec3(0.35, 0.2, 0.05), 1.0 - abs(w - 1.0) * 0.8) * (1.0 - step(2.5, w) * 0.7);
    gl_FragColor = vec4(col, 1.0);
  }
`;
const showFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uSky;
  void main() {
    vec3 col = texture2D(uSky, vUv).rgb;
    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    gl_FragColor = vec4(col + (g - 0.5) / 255.0 * 2.0, 1.0);
  }
`;

const shared = { sky: null as THREE.Texture | null };

function WorldSky() {
  const size = useThree((s) => s.size);
  const { rt, scene, cam, mat } = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(384, 240, { depthBuffer: false, generateMipmaps: false });
    const mat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: skyFrag,
      uniforms: { uTime: { value: 0 }, uWorld: { value: 0 }, uRes: { value: new THREE.Vector2(16, 9) }, uMouse: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });
    const scene = new THREE.Scene();
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    q.frustumCulled = false;
    scene.add(q);
    shared.sky = rt.texture;
    return { rt, scene, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat };
  }, []);
  useEffect(() => {
    rt.setSize(384, Math.max(1, Math.round((384 * size.height) / size.width)));
    mat.uniforms.uRes.value.set(size.width, size.height);
  }, [rt, mat, size]);
  useEffect(() => () => { rt.dispose(); mat.dispose(); }, [rt, mat]);
  const show = useMemo(() => ({ uSky: { value: rt.texture } }), [rt]);
  const mouse = useMemo(() => new THREE.Vector2(), []);

  useFrame(({ gl }, dt) => {
    const u = mat.uniforms;
    u.uTime.value += dt;
    u.uWorld.value = worldAt(store.jump);
    u.uMouse.value.lerp(mouse.set(store.mouse.x, store.mouse.y), 0.03);
    gl.setRenderTarget(rt);
    gl.render(scene, cam);
    gl.setRenderTarget(null);
  }, -1);

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial vertexShader={quadVert} fragmentShader={showFrag} uniforms={show} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

/* ======================================================================================
   Camera: flies forward through the gates with scroll, sways with the mouse.
   ====================================================================================== */
function CameraRig() {
  const camera = useThree((s) => s.camera);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraZ(store.jump), 6, dt);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, store.mouse.x * 0.6 + Math.sin(t * 0.3) * 0.15, 2, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, store.mouse.y * 0.35 + 0.1, 2, dt);
    camera.lookAt(camera.position.x * 0.4, camera.position.y * 0.4, camera.position.z - 10);
  });
  return null;
}

/* ======================================================================================
   Three marble triumphal arches: podium, fluted columns, entablature with cornice, attic
   with a carved inscription (VENI / VIDI / VICI). Light tints the marble per world.
   ====================================================================================== */
const ARCH_WORDS = ['VENI', 'VIDI', 'VICI'];

function flutedColumn(r: number, h: number) {
  const g = new THREE.CylinderGeometry(r, r * 1.04, h, 48, 1);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    if (Math.hypot(x, z) > r * 0.5) {
      const a = Math.atan2(z, x);
      const k = 1 - 0.07 * Math.pow(Math.abs(Math.sin(a * 12)), 0.5);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

function archGeometry() {
  const W = 7, H = 6.2, D = 1.8; // main body
  const ow = 3.0, oh = 3.3; // opening: straight part, then a half-circle
  const y0 = -3.4;
  // Body: one outline with the passage cut up from the ground.
  const s = new THREE.Shape();
  s.moveTo(-W / 2, y0);
  s.lineTo(-ow / 2, y0);
  s.lineTo(-ow / 2, y0 + oh);
  s.absarc(0, y0 + oh, ow / 2, Math.PI, 0, true);
  s.lineTo(ow / 2, y0);
  s.lineTo(W / 2, y0);
  s.lineTo(W / 2, y0 + H);
  s.lineTo(-W / 2, y0 + H);
  s.closePath();
  const body = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 48 });
  body.translate(0, 0, -D / 2);

  // Archivolt: a moulded half-ring framing the opening, with a keystone.
  const ring = new THREE.Shape();
  ring.absarc(0, 0, ow / 2 + 0.38, 0, Math.PI, false);
  ring.lineTo(-ow / 2, 0);
  ring.absarc(0, 0, ow / 2, Math.PI, 0, true);
  ring.lineTo(ow / 2 + 0.38, 0);
  const archivolt = new THREE.ExtrudeGeometry(ring, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2, curveSegments: 48 });
  archivolt.translate(0, y0 + oh, D / 2);

  const parts: THREE.BufferGeometry[] = [body, archivolt, box(0.55, 0.75, 0.35, 0, y0 + oh + ow / 2 + 0.2, D / 2 + 0.1)];
  // Columns standing proud of the piers, with bases, capitals and plinths.
  const colH = 4.7, colY = y0 + 0.5 + colH / 2;
  for (const x of [-2.95, -2.0, 2.0, 2.95]) {
    parts.push(flutedColumn(0.24, colH).translate(x, colY, D / 2 + 0.3));
    parts.push(box(0.66, 0.22, 0.66, x, y0 + 0.5 + 0.11, D / 2 + 0.3));
    parts.push(box(0.7, 0.26, 0.7, x, y0 + 0.5 + colH - 0.13, D / 2 + 0.3));
    parts.push(box(0.8, 0.5, 0.95, x, y0 + 0.25, D / 2 + 0.25));
  }
  const top = y0 + H;
  parts.push(box(W + 0.7, 0.55, D + 0.9, 0, top + 0.275, 0.2)); // entablature
  parts.push(box(W + 1.1, 0.2, D + 1.2, 0, top + 0.65, 0.2)); // cornice
  parts.push(box(W - 0.6, 1.55, D + 0.2, 0, top + 0.75 + 0.775, 0)); // attic
  parts.push(box(W - 0.2, 0.14, D + 0.5, 0, top + 2.37, 0)); // attic cap
  parts.push(box(W + 0.4, 0.3, D + 1.0, 0, y0 + 0.15, 0.2)); // podium step

  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { g.deleteAttribute('uv'); return g; }), false)!;
  merged.computeVertexNormals();
  return { geo: merged, inscriptionY: top + 1.525, inscriptionZ: D / 2 + 0.11 };
}

// Carved inscription for the attic, drawn with the site's Roman face.
function inscriptionTexture(word: string) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const probe = document.querySelector('.roman');
  const family = probe ? getComputedStyle(probe).fontFamily : 'serif';
  ctx.font = '600 170px ' + family;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = word.split('').join(' '); // a little air between letters
  // Incised look: light lip below, dark cut above.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(text, 512, 134);
  ctx.fillStyle = 'rgba(70,62,54,0.92)';
  ctx.fillText(text, 512, 130);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Arches() {
  const { geo, inscriptionY, inscriptionZ } = useMemo(archGeometry, []);
  const marble = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#efe9df',
        roughness: 0.42,
        clearcoat: 0.35,
        clearcoatRoughness: 0.3,
        sheen: 0.3,
        sheenColor: new THREE.Color('#fff4e2'),
        envMapIntensity: 0.7,
      }),
    []
  );
  const [textures, setTextures] = useState<THREE.Texture[] | null>(null);
  useEffect(() => {
    let alive = true;
    // Wait for the web font so the inscription isn't drawn in a fallback serif.
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (alive) setTextures(ARCH_WORDS.map(inscriptionTexture));
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => () => textures?.forEach((t) => t.dispose()), [textures]);

  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((state) => {
    refs.current.forEach((g, i) => {
      if (g) g.visible = state.camera.position.z > ARCH_Z[i] - 2; // gone once it's behind us
    });
  });

  return (
    <>
      {ARCH_Z.map((z, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g; }} position={[0, 0, z]}>
          <mesh geometry={geo} material={marble} />
          {textures && (
            <mesh position={[0, inscriptionY, inscriptionZ]}>
              <planeGeometry args={[4.6, 1.15]} />
              <meshStandardMaterial map={textures[i]} transparent roughness={0.6} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

/* Light that tints the marble for each world: day, golden hour, violet dusk, space. */
const LIGHTS = [
  { key: '#ffffff', ki: 2.2, sky: '#eef3fa', ground: '#d8d0c2', hi: 1.1 },
  { key: '#ffc27e', ki: 2.8, sky: '#ffd9a8', ground: '#a8654a', hi: 1.0 },
  { key: '#c7b0ff', ki: 2.0, sky: '#7b6be0', ground: '#2a2350', hi: 0.9 },
  { key: '#a9bcff', ki: 1.6, sky: '#3a438f', ground: '#06070d', hi: 0.6 },
];
function WorldLights() {
  const key = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const ca = useMemo(() => new THREE.Color(), []);
  const cb = useMemo(() => new THREE.Color(), []);
  useFrame((state) => {
    const w = worldAt(store.jump);
    const i = Math.min(2, Math.floor(w));
    const k = THREE.MathUtils.smoothstep(w - i, 0, 1);
    const A = LIGHTS[i], B = LIGHTS[Math.min(3, i + 1)];
    key.current.color.copy(ca.set(A.key)).lerp(cb.set(B.key), k);
    key.current.intensity = THREE.MathUtils.lerp(A.ki, B.ki, k);
    hemi.current.color.copy(ca.set(A.sky)).lerp(cb.set(B.sky), k);
    hemi.current.groundColor.copy(ca.set(A.ground)).lerp(cb.set(B.ground), k);
    hemi.current.intensity = THREE.MathUtils.lerp(A.hi, B.hi, k);
    // Keep the key light up-left and a little ahead of the camera so each arch is lit from the front.
    const cz = state.camera.position.z;
    key.current.position.set(-6, 8, cz + 4);
    key.current.target.position.set(0, 0, cz - 12);
    key.current.target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={key} />
    </>
  );
}

/* ======================================================================================
   Open space: stars fade in with world 3, a big slow laurel floats ahead (values phase).
   ====================================================================================== */
function Stars() {
  const pts = useMemo(() => {
    const n = 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 30);
      pos.set([v.x, v.y, v.z + ARCH_Z[2] - 20], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: '#cfe0ff', size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return p;
  }, []);
  useFrame(() => {
    const w = worldAt(store.jump);
    (pts.material as THREE.PointsMaterial).opacity = THREE.MathUtils.smoothstep(w, 2.3, 3);
    pts.visible = w > 2.3;
  });
  return <primitive object={pts} />;
}

function SpaceLaurel() {
  const group = useRef<THREE.Group>(null!);
  const leaves = useRef<THREE.InstancedMesh>(null!);
  const laurel = useMemo(makeLaurel, []);
  const material = useMemo(makeLaurelMaterial, []);
  useLayoutEffect(() => {
    laurel.matrices.forEach((m, i) => leaves.current.setMatrixAt(i, m));
    leaves.current.instanceMatrix.needsUpdate = true;
  }, [laurel]);
  useFrame((state, dt) => {
    const g = group.current;
    const t = state.clock.elapsedTime;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, Math.sin(t * 0.25) * 0.6 + store.mouse.x * 0.4, 2, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, 0.25 - store.mouse.y * 0.3, 2, dt);
    g.rotation.z = t * 0.05;
    g.visible = worldAt(store.jump) > 2.2;
  });
  return (
    <group ref={group} position={[0, 0, ARCH_Z[2] - 30]} scale={2.6}>
      {laurel.stems.map((geo, i) => (
        <mesh key={i} geometry={geo} material={material} />
      ))}
      <instancedMesh ref={leaves} args={[laurel.leafGeo, material, LEAF_COUNT]} />
    </group>
  );
}

/* ====================================================================================== */
export default function JumpScene() {
  // Only render while the jump section is on screen.
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (wrap.current) io.observe(wrap.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 17], fov: 42, near: 0.1, far: 140 }}
      >
        <WorldSky />
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={4} position={[0, 5, 2]} scale={[10, 2, 1]} rotation-x={Math.PI / 2} />
          <Lightformer form="rect" intensity={2.5} position={[-5, 1, 3]} scale={[3, 6, 1]} rotation-y={Math.PI / 2} />
          <Lightformer form="rect" intensity={2} position={[5, 0, 3]} scale={[3, 6, 1]} rotation-y={-Math.PI / 2} />
          <Lightformer form="ring" color="#fff1d6" intensity={3} position={[2, 3, 4]} scale={2} />
        </Environment>
        <WorldLights />
        <CameraRig />
        <Arches />
        <Stars />
        <SpaceLaurel />
      </Canvas>
    </div>
  );
}
