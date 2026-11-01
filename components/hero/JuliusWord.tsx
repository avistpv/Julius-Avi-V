'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { makeJuliusCurve } from './juliusPath';
import Sparkles from './Sparkles';
import { store, sky, morphShared } from '@/lib/store';
import { SWAP_IN } from './Morph';

const RADIUS = 0.23;
const TUBULAR = 1400;
const RADIAL = 40;
const DRAW_TIME = 2.4; // seconds for the stroke to "write" itself

// Glassy, inflated material — frosted, slightly blue, refracts the sky behind it.
function Glass({ buffer }: { buffer: THREE.Texture | null }) {
  return (
    <MeshTransmissionMaterial
      buffer={buffer ?? undefined}
      samples={4}
      transmission={1}
      thickness={1.35}
      roughness={0.18}
      ior={1.32}
      chromaticAberration={0.06}
      anisotropicBlur={0.1}
      distortion={0.12}
      distortionScale={0.4}
      temporalDistortion={0.05}
      clearcoat={1}
      clearcoatRoughness={0.05}
      envMapIntensity={2.2}
      color="#bcd3f8"
      attenuationColor="#6b98ea"
      attenuationDistance={1.35}
    />
  );
}

export default function JuliusWord() {
  const group = useRef<THREE.Group>(null!);
  const tube = useRef<THREE.Mesh>(null!);
  const head = useRef<THREE.Mesh>(null!);
  const dot = useRef<THREE.Mesh>(null!);
  const viewport = useThree((s) => s.viewport);
  const t0 = useRef<number | null>(null);
  // The glass refracts the low-res sky texture directly — no extra scene render per frame.
  const [buffer, setBuffer] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (sky.texture) return setBuffer(sky.texture);
    const id = setInterval(() => sky.texture && (setBuffer(sky.texture), clearInterval(id)), 30);
    return () => clearInterval(id);
  }, []);

  const { curve, dotPos, size, geo, indexCount } = useMemo(() => {
    const { curve, dot, size } = makeJuliusCurve();
    const geo = new THREE.TubeGeometry(curve, TUBULAR, RADIUS, RADIAL, false);
    return { curve, dotPos: dot, size, geo, indexCount: geo.index!.count };
  }, []);

  useEffect(() => () => geo.dispose(), [geo]);

  // Fit the word to the screen: ~62% of width on desktop, never taller than ~42% of height.
  const scale = Math.min((viewport.width * 0.62) / size.x, (viewport.height * 0.42) / size.y);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g || !tube.current) return;
    const time = state.clock.elapsedTime;


    // Write-on animation, starts once the preloader is done.
    if (store.ready && t0.current === null) t0.current = time;
    const raw = t0.current === null ? 0 : (time - t0.current) / DRAW_TIME;
    const p = easeInOutCubic(THREE.MathUtils.clamp(raw, 0, 1));

    const segs = Math.floor(TUBULAR * p);
    geo.setDrawRange(0, Math.min(indexCount, segs * RADIAL * 6));
    tube.current.visible = segs > 0;

    // Round cap that travels with the pen tip.
    const tip = curve.getPointAt(Math.max(0.0001, p));
    head.current.position.copy(tip);
    head.current.visible = p > 0;

    // i-dot pops in right after the "i" is written (~68% of the stroke).
    const dp = THREE.MathUtils.clamp((p - 0.66) / 0.08, 0, 1);
    dot.current.scale.setScalar(easeOutBack(dp) * 1.0 + 0.0001);

    // Idle float + tilt toward the mouse.
    const mx = store.mouse.x, my = store.mouse.y;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, mx * 0.22, 3, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -my * 0.14 + Math.sin(time * 0.6) * 0.03, 3, dt);
    g.rotation.z = Math.sin(time * 0.4) * 0.015;

    // Scroll out: a gentle drift up; then the word hands over to the particles (see Morph).
    const hp = store.heroProgress;
    g.position.y = THREE.MathUtils.damp(g.position.y, hp * viewport.height * 0.3 + Math.sin(time * 0.8) * 0.05, 6, dt);
    g.scale.setScalar(scale * (1 - hp * 0.08));
    g.updateMatrixWorld();
    morphShared.wordMatrix.copy(g.matrixWorld);
    g.visible = store.morph < SWAP_IN;
  });

  if (!buffer) return <group ref={group} />;

  return (
    <group ref={group}>
      <mesh ref={tube} geometry={geo}>
        <Glass buffer={buffer} />
      </mesh>
      {/* start cap */}
      <mesh position={curve.getPointAt(0)}>
        <sphereGeometry args={[RADIUS, 48, 32]} />
        <Glass buffer={buffer} />
      </mesh>
      {/* moving end cap */}
      <mesh ref={head}>
        <sphereGeometry args={[RADIUS, 48, 32]} />
        <Glass buffer={buffer} />
      </mesh>
      {/* dot of the i */}
      <mesh ref={dot} position={dotPos}>
        <sphereGeometry args={[RADIUS * 1.2, 48, 32]} />
        <Glass buffer={buffer} />
      </mesh>
      <Sparkles curve={curve} radius={RADIUS} />
    </group>
  );
}

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function easeOutBack(x: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
