'use client';
import { Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, MeshTransmissionMaterial, OrbitControls, useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Preview page for generated 3D assets in the site's glass material (not linked from the site).
function Bust() {
  const { scene } = useGLTF('/models/caesar.glb');
  const geo = useMemo(() => {
    let g: THREE.BufferGeometry | null = null;
    scene.traverse((o) => {
      if (!g && (o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry;
    });
    if (!g) return null;
    // Generated meshes come faceted: weld vertices and recompute normals for smooth glass.
    const src = (g as THREE.BufferGeometry).clone();
    src.deleteAttribute('normal');
    src.deleteAttribute('uv');
    const smooth = mergeVertices(src, 1e-4);
    smooth.computeVertexNormals();
    return smooth;
  }, [scene]);
  const ref = useMemo(() => ({ current: null as THREE.Mesh | null }), []);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.5;
  });
  if (!geo) return null;
  return (
    <Center>
      <mesh ref={(m) => { ref.current = m; }} geometry={geo} scale={2.4}>
        <MeshTransmissionMaterial
          samples={6}
          resolution={512}
          transmission={1}
          thickness={0.8}
          roughness={0.18}
          ior={1.32}
          chromaticAberration={0.06}
          clearcoat={1}
          clearcoatRoughness={0.05}
          color="#d6e6fc"
          attenuationColor="#8fb3f2"
          attenuationDistance={5}
          envMapIntensity={2.2}
        />
      </mesh>
    </Center>
  );
}

export default function BustLab() {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 32 }} style={{ position: 'fixed', inset: 0, background: '#c3dcf0' }}>
      <color attach="background" args={['#c3dcf0']} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={4} position={[0, 5, 2]} scale={[10, 2, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={2.5} position={[-5, 1, 3]} scale={[3, 6, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={2} position={[5, 0, 3]} scale={[3, 6, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" color="#fff1d6" intensity={3} position={[2, 3, 4]} scale={2} />
      </Environment>
      <Suspense fallback={null}>
        <Bust />
      </Suspense>
      <OrbitControls enablePan={false} />
    </Canvas>
  );
}
