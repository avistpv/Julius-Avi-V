// Scroll map of III · Virtvtes (0..1 of the pinned section).
// The section starts one screen early, under the work grid: the paper tears away and reveals a
// painted triumphal arch, the camera pushes through its opening into the landscape behind it,
// then each word changes the scene: VENI — the painting (camera keeps drifting in);
// VIDI — the painting dissolves block by block into a glowing etching (the drawing under it);
// VICI — we fly on into the dark, the lines fall behind and only the stars remain, with the values.

export const REVEAL_END = 0.2; // paper has fully left the screen
export const PUSH_FROM = 0.26; // start flying into the arch
export const PUSH_TO = 0.44; // arch is behind us

// Centre of the arch opening in the arch image (fractions of its width / height).
export const OPENING = { x: 0.496, y: 0.69 };
export const ARCH_ASPECT = 2688 / 1520;

export const STEPS = [
  { from: 0.46, to: 0.58, latin: 'Veni.', line: 'We listen.' },
  { from: 0.58, to: 0.7, latin: 'Vidi.', line: 'We design.' },
  { from: 0.7, to: 0.82, latin: 'Vici.', line: 'We ship.' },
];

// Painting -> etching dissolve runs through VIDI.
export const ETCH_FROM = 0.58;
export const ETCH_TO = 0.72;
// Flight into the stars runs through VICI and the values.
export const FLY_FROM = 0.72;
export const FLY_TO = 0.95;

export const VALUES_FROM = 0.84;
export const VALUES_TO = 1.01;

export const VALUES = [
  { title: 'Excellence.', text: 'Never “close enough”.' },
  { title: 'Precision.', text: 'Plan first. Build once.' },
  { title: 'Innovation.', text: 'New tech when it serves the product.' },
  { title: 'Partnership.', text: 'Partners, not vendors.' },
];

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);
