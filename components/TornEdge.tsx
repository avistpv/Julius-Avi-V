// Torn-paper bottom edge (Shopify Editions style): the paper section ends in a ragged tear with a
// white fibrous rim and a soft shadow on whatever is revealed underneath. Hangs below its parent.
import styles from './TornEdge.module.css';

const W = 1440;
const H = 140;

// Small seeded PRNG so server and client draw the same tear.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Smooth value noise: random knots every `step` units, cosine-interpolated.
function noise(r: () => number, step: number) {
  const knots = Array.from({ length: Math.ceil(W / step) + 2 }, () => r() * 2 - 1);
  return (x: number) => {
    const i = Math.floor(x / step);
    const t = (1 - Math.cos(((x / step) - i) * Math.PI)) / 2;
    return knots[i] * (1 - t) + knots[i + 1] * t;
  };
}

function tear(seed: number, base: number) {
  const r = rng(seed);
  const big = noise(r, 260);
  const mid = noise(r, 70);
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 4) {
    const y = base + big(x) * 30 + mid(x) * 10 + (r() - 0.5) * 5;
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return pts;
}

const edge = tear(7, 52);
// The white rim follows the same line a few units lower, with its own fine jitter.
const rimR = rng(91);
const rim = edge.map((p) => {
  const [x, y] = p.split(',').map(Number);
  return `${x},${(y + 7 + rimR() * 9).toFixed(1)}`;
});

const PAPER = `M0,0 L${edge.join(' L')} L${W},0 Z`;
const RIM = `M0,0 L${rim.join(' L')} L${W},0 Z`;

export default function TornEdge() {
  return (
    <svg className={styles.edge} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <filter id="tear-fibres" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="10" />
        </filter>
      </defs>
      <path d={RIM} className={styles.rim} filter="url(#tear-fibres)" />
      <path d={PAPER} className={styles.paper} />
    </svg>
  );
}
