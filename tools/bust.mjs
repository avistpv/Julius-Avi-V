// Prepares Caesar for the web, once, offline — so the browser does none of this at load:
//   tools/assets/caesar-src.glb  ->  public/models/caesar.glb        (welded, simplified, centred,
//                                                                     1 unit tall, normals, quantized)
//                                ->  public/models/caesar-points.bin (14 000 area-weighted surface
//                                                                     points, int16, for the dust)
// Run: node tools/bust.mjs
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, dedup, prune, simplify, quantize } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const SRC = 'tools/assets/caesar-src.glb';
const OUT_GLB = 'public/models/caesar.glb';
const OUT_PTS = 'public/models/caesar-points.bin';
const COUNT = 14000;
const RATIO = 0.4; // keep 40% of the triangles — glass hides the rest
const PTS_SCALE = 20000; // int16 = metres * PTS_SCALE (bust spans about ±0.9)

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
const before = stats(doc);

await doc.transform(
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.001 }),
  prune(),
);

// Centre the bust and make it exactly one unit tall (what the scene expects).
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const posAcc = prim.getAttribute('POSITION');
const pos = posAcc.getArray();
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pos[i + k]); max[k] = Math.max(max[k], pos[i + k]); }
const c = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
const s = 1 / (max[1] - min[1]);
const norm = new Float32Array(pos.length);
for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) norm[i + k] = (pos[i + k] - c[k]) * s;
posAcc.setArray(norm);
// Any node transforms would double-apply: the mesh is already in world units now.
for (const n of doc.getRoot().listNodes()) { n.setTranslation([0, 0, 0]); n.setRotation([0, 0, 0, 1]); n.setScale([1, 1, 1]); }

// Smooth, area-weighted vertex normals (gltf-transform's normals() would unweld into flat shading).
{
  const idx = prim.getIndices()?.getArray();
  const P = posAcc.getArray();
  const N = new Float32Array(P.length);
  const triCount = idx ? idx.length / 3 : P.length / 9;
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; // length = 2·area
    for (const i of [a, b, c]) { N[i * 3] += nx; N[i * 3 + 1] += ny; N[i * 3 + 2] += nz; }
  }
  for (let i = 0; i < N.length; i += 3) {
    const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
    N[i] /= l; N[i + 1] /= l; N[i + 2] /= l;
  }
  const old = prim.getAttribute('NORMAL');
  const acc = doc.createAccessor('normal').setType('VEC3').setArray(N).setBuffer(doc.getRoot().listBuffers()[0]);
  prim.setAttribute('NORMAL', acc);
  old?.dispose();
}

// Surface samples for the particles (before quantization, from the final triangles).
const idx = prim.getIndices()?.getArray();
const P = posAcc.getArray();
const triCount = idx ? idx.length / 3 : P.length / 9;
const vi = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);
const areas = new Float64Array(triCount);
let total = 0;
const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
const get = (i, o) => { o[0] = P[i * 3]; o[1] = P[i * 3 + 1]; o[2] = P[i * 3 + 2]; };
for (let t = 0; t < triCount; t++) {
  get(vi(t, 0), A); get(vi(t, 1), B); get(vi(t, 2), C);
  const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
  const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  total += Math.hypot(cx, cy, cz) / 2;
  areas[t] = total;
}
let seed = 1234567;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pts = new Int16Array(COUNT * 3);
for (let i = 0; i < COUNT; i++) {
  const r = rnd() * total;
  let lo = 0, hi = triCount - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (areas[mid] < r) lo = mid + 1; else hi = mid; }
  get(vi(lo, 0), A); get(vi(lo, 1), B); get(vi(lo, 2), C);
  let u = rnd(), v = rnd();
  if (u + v > 1) { u = 1 - u; v = 1 - v; }
  for (let k = 0; k < 3; k++) {
    const p = A[k] * (1 - u - v) + B[k] * u + C[k] * v;
    pts[i * 3 + k] = Math.round(Math.max(-1, Math.min(1, p * PTS_SCALE / 32767)) * 32767);
  }
}
fs.writeFileSync(OUT_PTS, Buffer.from(pts.buffer));

await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 8 }));
await io.write(OUT_GLB, doc);

const after = stats(doc);
console.log(`glb: ${before.verts} verts / ${before.tris} tris (${kb(SRC)} KB)  ->  ${after.verts} verts / ${after.tris} tris (${kb(OUT_GLB)} KB)`);
console.log(`points: ${COUNT} x int16 (${kb(OUT_PTS)} KB)`);

function stats(d) {
  let verts = 0, tris = 0;
  for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    verts += p.getAttribute('POSITION').getCount();
    tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  }
  return { verts, tris: Math.round(tris) };
}
function kb(f) { return Math.round(fs.statSync(f).size / 1024); }
