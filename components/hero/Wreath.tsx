'use client';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { store, morphShared } from '@/lib/store';
import { SWEEP_START } from './Morph';
import { makeLaurel, makeLaurelMaterial, LEAF_COUNT } from '@/components/three/laurel';

// The site's laurel "character" in the hero (geometry lives in components/three/laurel).

export default function Wreath() {
  const group = useRef<THREE.Group>(null!);
  const leaves = useRef<THREE.InstancedMesh>(null!);
  const viewport = useThree((s) => s.viewport);
  const appear = useRef(0);

  const laurel = useMemo(makeLaurel, []);
  useLayoutEffect(() => {
    laurel.matrices.forEach((m, i) => leaves.current.setMatrixAt(i, m));
    leaves.current.count = laurel.matrices.length;
    leaves.current.instanceMatrix.needsUpdate = true;
  }, [laurel]);
  const material = useMemo(makeLaurelMaterial, []);

  // Scratch objects for the per-frame pose maths.
  const idle = useRef(new THREE.Euler());
  const [heroPos, headPos, flightPos, tmpP, tmpS] = useMemo(() => Array.from({ length: 5 }, () => new THREE.Vector3()), []);
  const [heroQ, bustQ, headQ, flightQ] = useMemo(() => Array.from({ length: 4 }, () => new THREE.Quaternion()), []);
  const flat = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.22, 0, 0)), []);

  useFrame((state, dt) => {
    const g = group.current;
    const time = state.clock.elapsedTime;
    if (store.ready) appear.current = Math.min(1, appear.current + dt * 0.7);
    const a = THREE.MathUtils.smoothstep(appear.current, 0.35, 1);

    // Hero pose: bottom-right, like the cursor in the reference.
    const unit = viewport.width / 1440; // 1 css px at 1440 wide
    const size = 62 * unit; // wreath radius ≈ 62 css px -> ~130px across
    heroPos.set(
      viewport.width * (0.85 - 0.5),
      -viewport.height * (0.74 - 0.5) + store.heroProgress * viewport.height * 0.3 + Math.sin(time * 1.1) * 0.06,
      0
    );
    idle.current.y = THREE.MathUtils.damp(idle.current.y, store.mouse.x * 0.6 + Math.sin(time * 0.5) * 0.25, 2.5, dt);
    idle.current.x = THREE.MathUtils.damp(idle.current.x, -store.mouse.y * 0.4 + 0.15, 2.5, dt);
    idle.current.z = -0.18 + Math.sin(time * 0.7) * 0.05;
    heroQ.setFromEuler(idle.current);

    // Flight to Caesar's head (word -> bust transition): lands flat on the head, shrinks to fit.
    const k = THREE.MathUtils.smoothstep(store.morph, 0.08, 0.9);
    let pos = heroPos, scl = size * easeOutBack(a), q = heroQ;
    if (k > 0 && morphShared.bustReady) {
      const bm = morphShared.bustMatrix;
      headPos.copy(morphShared.headCenter).applyMatrix4(bm);
      bm.decompose(tmpP, bustQ, tmpS);
      // Lie flat on the head, slightly tipped back so it reads from the front.
      headQ.copy(bustQ).multiply(flat);
      // Snug around the head (a touch smaller than the head ring so it never reads as a hat brim).
      const headScale = morphShared.headRadius * tmpS.x * 0.95;
      flightPos.lerpVectors(heroPos, headPos, k);
      flightPos.y += Math.sin(k * Math.PI) * viewport.height * 0.12; // arc over
      pos = flightPos;
      scl = THREE.MathUtils.lerp(size, headScale, k);
      q = flightQ.copy(heroQ).slerp(headQ, k);
    }
    g.position.copy(pos);
    g.quaternion.copy(q);
    g.scale.setScalar(scl + 0.0001);
    // The bust has its own carved laurel: ours melts away while the scan line climbs to the head.
    const fade = 1 - THREE.MathUtils.smoothstep(store.morph, SWEEP_START + 0.1, SWEEP_START + 0.185);
    material.opacity = fade;
    material.transparent = fade < 1;
    material.depthWrite = fade >= 1;
    g.scale.multiplyScalar(0.85 + 0.15 * fade);
    g.visible = fade > 0.001;
  });

  return (
    <group ref={group} scale={0.0001}>
      {laurel.stems.map((g, i) => (
        <mesh key={i} geometry={g} material={material} />
      ))}
      <instancedMesh ref={leaves} args={[laurel.leafGeo, material, LEAF_COUNT]} />
    </group>
  );
}

function easeOutBack(x: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
