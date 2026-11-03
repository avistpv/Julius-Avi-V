'use client';
import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei/core/MeshTransmissionMaterial';
import * as THREE from 'three';
import { useCaesarGeometry } from '@/components/three/useCaesar';
import StudioEnv from '@/components/hero/StudioEnv';

// Render rig for the pre-rendered bust (tools/bust-frames.mjs): the same glass, light and camera
// as the hero scene, on flat paper, one frame per yaw. Exposes window.__bust.render(yaw) -> PNG.
const W = 664, H = 800; // 2x the intro's figure slot (332 × 400)

function Rig() {
  const geo = useCaesarGeometry();
  const mesh = useRef<THREE.Mesh>(null);
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (!geo) return;
    const w = window as Window & { __bust?: { render: (yaw: number) => string } };
    w.__bust = {
      render(yaw: number) {
        // Camera: fov 32 at z = 10 -> 5.734 world units visible top to bottom. The bust is one unit
        // tall, so this scale makes it span 90% of the frame (centred, pedestal to head).
        const visible = 2 * Math.tan(THREE.MathUtils.degToRad(32) / 2) * 10;
        const m = mesh.current!;
        m.scale.setScalar(visible * 0.9);
        m.rotation.set(0, yaw, 0);
        gl.render(scene, camera);
        gl.render(scene, camera); // second pass: the transmission buffer is warm
        return gl.domElement.toDataURL('image/png');
      },
    };
  }, [geo, gl, scene, camera]);
  if (!geo) return null;
  return (
    <mesh ref={mesh} geometry={geo}>
      <MeshTransmissionMaterial
        samples={6}
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
        background={new THREE.Color('#f3f2ee')}
      />
    </mesh>
  );
}

export default function BustFrames() {
  return (
    <div style={{ width: W, height: H }}>
      <Canvas
        dpr={1}
        frameloop="demand"
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        camera={{ position: [0, 0, 10], fov: 32, near: 0.1, far: 50 }}
        onCreated={({ gl }) => gl.setClearColor('#f3f2ee')}
        style={{ width: W, height: H }}
      >
        <StudioEnv />
        <ambientLight intensity={0.4} />
        <directionalLight position={[-3, 5, 6]} intensity={1.2} />
        <Suspense fallback={null}>
          <Rig />
        </Suspense>
      </Canvas>
    </div>
  );
}
