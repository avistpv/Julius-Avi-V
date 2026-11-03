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
    let g: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((o) => {
      if (!g && (o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry;
    });
    if (g && !(g as THREE.BufferGeometry).getAttribute('normal')) (g as THREE.BufferGeometry).computeVertexNormals();
    return g as THREE.BufferGeometry | null;
  }, [gltf]);
}

useLoader.preload(GLTFLoader, CAESAR_URL);
