'use client';
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const CAESAR_URL = '/models/caesar.glb';

// The generated bust comes faceted: weld vertices and recompute normals so glass reads smooth.
// Returns a centred geometry about 1 unit tall.
export function useCaesarGeometry() {
  const { scene } = useGLTF(CAESAR_URL);
  return useMemo(() => {
    let src: THREE.BufferGeometry | null = null;
    scene.traverse((o) => {
      if (!src && (o as THREE.Mesh).isMesh) src = (o as THREE.Mesh).geometry;
    });
    if (!src) return null;
    const g = (src as THREE.BufferGeometry).clone();
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    const smooth = mergeVertices(g, 1e-4);
    smooth.computeVertexNormals();
    smooth.computeBoundingBox();
    const box = smooth.boundingBox!;
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    smooth.translate(-c.x, -c.y, -c.z);
    smooth.scale(1 / size.y, 1 / size.y, 1 / size.y);
    return smooth;
  }, [scene]);
}

useGLTF.preload(CAESAR_URL);
