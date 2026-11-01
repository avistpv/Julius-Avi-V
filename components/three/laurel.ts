import * as THREE from 'three';

// Procedural laurel wreath (used in the hero and as the portal into the hyperjump).
// Two mirrored branches of almond-shaped leaves on a thin stem, open at the top. Radius = 1.
export const LEAVES_PER_SIDE = 9;
export const LEAF_COUNT = LEAVES_PER_SIDE * 4 + 2;
const R = 1;

export function makeLeafGeometry() {
  // Almond profile revolved around Y, then flattened -> plump glossy leaf.
  const pts: THREE.Vector2[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = Math.pow(Math.sin(Math.PI * t), 0.7) * 0.16 * (1 - 0.25 * t);
    pts.push(new THREE.Vector2(r, t * 0.46 - 0.23));
  }
  const g = new THREE.LatheGeometry(pts, 32);
  g.scale(1, 1, 0.62);
  g.computeVertexNormals();
  return g;
}

export function makeLaurel() {
  const stems = ([1, -1] as const).map((side) => {
    const pts: THREE.Vector3[] = [];
    // From bottom (-90deg) up to ~60deg, mirrored for the other side.
    for (let i = 0; i <= 24; i++) {
      const a = THREE.MathUtils.lerp(-Math.PI / 2 - 0.08, Math.PI / 2 - 0.5, i / 24);
      pts.push(new THREE.Vector3(Math.cos(a) * R * side, Math.sin(a) * R, 0));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return { side, curve, geo: new THREE.TubeGeometry(curve, 80, 0.035, 12, false) };
  });

  const matrices: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  stems.forEach(({ curve, side }) => {
    for (let i = 0; i < LEAVES_PER_SIDE; i++) {
      const t = 0.08 + (i / (LEAVES_PER_SIDE - 1)) * 0.88;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const out = new THREE.Vector3(p.x, p.y, 0).normalize();
      // Alternate leaves outward / inward, both leaning toward the tip of the branch.
      for (const dir of [1, -1]) {
        const lean = tan.clone().add(out.clone().multiplyScalar(0.9 * dir)).normalize();
        q.setFromUnitVectors(up, lean);
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(lean, 0.5 * dir * side));
        const size = 0.78 + 0.35 * Math.sin((i / LEAVES_PER_SIDE) * Math.PI); // bigger in the middle
        s.setScalar(size * (i === LEAVES_PER_SIDE - 1 ? 0.8 : 1));
        const pos = p.clone().add(lean.clone().multiplyScalar(0.2 * size)).add(new THREE.Vector3(0, 0, 0.03 * dir));
        matrices.push(new THREE.Matrix4().compose(pos, q.clone(), s.clone()));
      }
    }
    // Tip leaf continuing the branch.
    const tip = curve.getPointAt(1);
    const tanEnd = curve.getTangentAt(1);
    q.setFromUnitVectors(up, tanEnd);
    matrices.push(new THREE.Matrix4().compose(tip.clone().add(tanEnd.clone().multiplyScalar(0.18)), q.clone(), new THREE.Vector3(0.85, 0.85, 0.85)));
  });

  return { stems: stems.map((s) => s.geo), leafGeo: makeLeafGeometry(), matrices };
}

export function makeLaurelMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#1d5bff',
    roughness: 0.26,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.4,
    toneMapped: false, // keep the brand blue saturated (tone mapping washes it out)
    emissive: new THREE.Color('#0a2a8a'),
    emissiveIntensity: 0.15,
  });
}
