// Scroll map of the "Roman gates" jump (0..1 of the pinned section).
// The camera flies forward through three glass triumphal arches; passing each one teleports
// the world behind it: light sky -> golden hour -> violet dusk -> open space.

export const ARCH_SPACING = 16; // world units between arches
export const ARCH_Z = [0, -ARCH_SPACING, -ARCH_SPACING * 2];

// Scroll progress at which the camera crosses each arch.
export const CROSS = [0.25, 0.45, 0.65];

// Camera z keyframes (progress -> z). In front of each gate the camera settles at a distance
// where the whole arch and its inscription are in frame, drifts a little while you read, then
// rushes through. Crossing a gate = camera z equals that arch's z.
const VIEW = 14; // viewing distance in front of an arch
export const CAMERA_KEYS: [number, number][] = [
  [0, 26],
  [0.08, ARCH_Z[0] + VIEW],
  [0.19, ARCH_Z[0] + VIEW - 2],
  [CROSS[0], ARCH_Z[0]],
  [0.3, ARCH_Z[1] + VIEW],
  [0.39, ARCH_Z[1] + VIEW - 2],
  [CROSS[1], ARCH_Z[1]],
  [0.5, ARCH_Z[2] + VIEW],
  [0.59, ARCH_Z[2] + VIEW - 2],
  [CROSS[2], ARCH_Z[2]],
  [1, ARCH_Z[2] - 22],
];

export function cameraZ(p: number) {
  for (let i = 1; i < CAMERA_KEYS.length; i++) {
    const [p0, z0] = CAMERA_KEYS[i - 1];
    const [p1, z1] = CAMERA_KEYS[i];
    if (p <= p1) {
      const t = Math.min(1, Math.max(0, (p - p0) / (p1 - p0)));
      const e = t * t * (3 - 2 * t); // ease in/out on every leg
      return z0 + (z1 - z0) * e;
    }
  }
  return CAMERA_KEYS[CAMERA_KEYS.length - 1][1];
}

// 0..3 — which world we're in (fractional while crossing).
export function worldAt(p: number) {
  let w = 0;
  for (const c of CROSS) w += Math.min(1, Math.max(0, (p - (c - 0.012)) / 0.024));
  return w;
}

// Big centred lines, shown while approaching each arch (they sit in its opening).
export const STEPS = [
  { from: 0.07, to: 0.215, latin: 'Veni.', line: 'We listen.' },
  { from: 0.29, to: 0.415, latin: 'Vidi.', line: 'We design.' },
  { from: 0.49, to: 0.615, latin: 'Vici.', line: 'We ship.' },
  { from: 0.88, to: 1.01, latin: 'Legio.', line: 'Meet the team.' },
];

export const VALUES_FROM = 0.69;
export const VALUES_TO = 0.86;

// The four values, floating in open space around the laurel (positions in % of the viewport).
export const VALUES = [
  { x: 58, y: 18, title: 'Excellence.', text: 'Never “close enough”.' },
  { x: 68, y: 40, title: 'Precision.', text: 'Plan first. Build once.' },
  { x: 10, y: 50, title: 'Innovation.', text: 'New tech when it serves the product.' },
  { x: 22, y: 72, title: 'Partnership.', text: 'Partners, not vendors.' },
];
