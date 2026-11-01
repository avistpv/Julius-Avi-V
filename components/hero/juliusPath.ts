import * as THREE from 'three';

// Hand-drawn single-stroke "Julius" in script. Units: x-height = 1, baseline = 0.
// z offsets lift the return strokes so overlapping parts of the tube don't clip.
const P: [number, number, number][] = [
  // J — hook at the top, long stem, loop in the descender that runs into the "u"
  [1.55, 2.0, 0], [1.85, 2.42, 0], [2.25, 2.5, 0], [2.36, 2.15, 0],
  [2.15, 1.3, 0], [1.8, 0.25, 0], [1.4, -0.75, 0], [0.9, -1.2, 0],
  [0.35, -1.15, 0], [0.2, -0.75, 0.12], [0.65, -0.3, 0.18], [1.45, 0.15, 0.18], [2.15, 0.6, 0.1],
  // u
  [2.7, 1.0, 0], [2.55, 0.4, 0], [2.7, 0.03, 0], [3.1, 0.0, 0], [3.5, 0.35, 0],
  [3.75, 1.0, 0], [3.65, 0.4, 0.14], [3.8, 0.02, 0.14], [4.15, 0.08, 0.06],
  // l — tall loop
  [4.6, 0.55, 0], [5.0, 1.4, 0], [5.2, 2.2, 0], [5.1, 2.62, 0], [4.8, 2.55, 0.1],
  [4.6, 1.8, 0.16], [4.58, 0.9, 0.16], [4.7, 0.2, 0.1], [5.05, -0.02, 0.05], [5.4, 0.3, 0],
  // i
  [5.75, 1.0, 0], [5.65, 0.4, 0.12], [5.8, 0.02, 0.12], [6.15, 0.15, 0.05],
  // u
  [6.65, 1.0, 0], [6.5, 0.4, 0], [6.65, 0.03, 0], [7.05, 0.0, 0], [7.45, 0.35, 0],
  [7.7, 1.0, 0], [7.6, 0.4, 0.14], [7.75, 0.02, 0.14], [8.1, 0.1, 0.05],
  // s — sharp peak, round belly, little curl back to the left
  [8.4, 0.6, 0], [8.6, 1.1, 0], [8.72, 0.8, 0], [9.0, 0.45, 0], [9.02, 0.15, 0],
  [8.8, -0.02, 0], [8.42, 0.0, 0], [8.2, 0.2, 0],
];

export const I_DOT: [number, number, number] = [5.92, 1.65, 0];

export function makeJuliusCurve() {
  // Center the word around the origin.
  const box = new THREE.Box3().setFromPoints(P.map((p) => new THREE.Vector3(...p)));
  const c = box.getCenter(new THREE.Vector3());
  const pts = P.map(([x, y, z]) => new THREE.Vector3(x - c.x, y - c.y, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const dot = new THREE.Vector3(I_DOT[0] - c.x, I_DOT[1] - c.y, I_DOT[2]);
  const size = box.getSize(new THREE.Vector3());
  return { curve, dot, size };
}
