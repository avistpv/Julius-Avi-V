'use client';
import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const CAESAR_URL = '/models/caesar.glb';

// The bust arrives ready (tools/bust.mjs): welded, simplified, centred, one unit tall, smooth
// normals, quantized — nothing to compute here at load.
export function useCaesarGeometry() {
  const gltf = useLoader(GLTFLoader, CAESAR_URL);
  return useMemo(() => {
    let mesh: THREE.Mesh | null = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
    });
    if (!mesh) return null;
    // Quantized positions come with a compensating node transform: bake it, so the geometry
    // itself is the one-unit-tall bust the scenes expect.
    const g = (mesh as THREE.Mesh).geometry.clone();
    g.applyMatrix4((mesh as THREE.Mesh).matrixWorld);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    return g;
  }, [gltf]);
}

useLoader.preload(GLTFLoader, CAESAR_URL);
