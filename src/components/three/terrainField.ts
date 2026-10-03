import { PIT, benchOuterRadius, benchY } from '../../data/types';

/**
 * Height field for the geologically plausible open-pit mine.
 *
 * The mine no longer reads as concentric mathematical rings:
 * - Bench boundaries wander with layered noise (elliptical asymmetry and
 *   per-bench jag with bench-dependent phase) so bench widths vary from
 *   ~4 to ~14 units and adjacent benches pinch and merge like real faces.
 * - Walls are fractured rock (ridged crag + sharp crevices), toes wear into
 *   alluvial fans, treads carry low hummocks, and the rim terrain is
 *   asymmetric (a high ridge on one side, low ground on the other).
 * - The haul road is a realistic switchback system: hairpin turnarounds
 *   (radial-diameter, sitting in the dip of their bench) stacked alternately
 *   on two sides of the pit, connected by ramps that cut diagonally across
 *   the rock faces, ending in a tail ramp to a flattened loading platform on
 *   the floor. Pads are flattened into level turnaround platforms, the road
 *   hugs the terrain height, and a safety berm rises on the downhill edge of
 *   every sloped segment.
 *
 * Road geometry is anchored to the ANALYTIC bench radii (not the wandering
 * boundaries) so the ramps always hug the tread of the lower bench at least
 * ~4 units below the sensor ring of the bench above — the shelf band never
 * reaches a ring at a different height. The entry descent uses a designed
 * smooth profile over the noisy rim terrain, and each ramp blends from its
 * pad's level into the terrain over its first 20% of length.
 *
 * Every analytic quantity used by sensors, zones and vehicles is preserved:
 * the pit keeps the same bench topology (radii/heights), and boundaryRadius
 * bounds the wander so sensor mid-bench radii always stay on flat treads.
 */

function hash2(ix: number, iz: number, seed: number): number {
  let h = (ix | 0) * 374761393 + (iz | 0) * 668265263 + (seed | 0) * 1442695041;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = smoothstep(fx);
  const v = smoothstep(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal value noise in [-0.5, 0.5]. */
export function fbm(x: number, z: number, seed: number, octaves = 3, baseFreq = 1 / 26): number {
  let amp = 1;
  let f = baseFreq;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += (valueNoise(x * f, z * f, seed + o * 101) - 0.5) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** Sharp crevice field in [0, 1]: narrow fracture lines on rock faces. */
function crevice(x: number, z: number, seed: number): number {
  const n = Math.abs(2 * fbm(x * 1.15, z * 1.15, seed, 4, 1 / 7));
  const t = Math.min(1, Math.max(0, (n - 0.5) / 0.5));
  return smoothstep(t);
}

/* ─── Bench boundaries ─────────────────────────────────────────────────────
   Layered noise: gentle elliptical asymmetry (periods 1-2, shared by all
   benches) plus a strong per-bench jag whose bench-dependent phase keeps
   adjacent boundaries decorrelated, giving truly variable bench widths.
   Total wander is bounded at ~3.5 units so analytic mid-bench sensor radii
   always stay on treads (worst-case margin >= ~0.6).                     */
const B_ASY = 0.3; // period 1 (shared)
const B_ASY2 = 0.2; // period 2 (shared)
const B_JAG1 = 1.5; // period 3, per-bench phase
const B_JAG2 = 1.0; // period 5, per-bench phase
const B_JAG3 = 0.5; // period 8, per-bench phase

export function boundaryRadius(b: number, theta: number): number {
  const asym = B_ASY * Math.sin(theta + 0.7) + B_ASY2 * Math.sin(2 * theta + 1.9);
  const jag =
    B_JAG1 * Math.sin(3 * theta + b * 2.1) +
    B_JAG2 * Math.sin(5 * theta + b * 1.7) +
    B_JAG3 * Math.sin(8 * theta + b * 2.9);
  const r = benchOuterRadius(b) + asym + jag;
  // Keep the pit floor boundary clear of the floor-mounted sensors
  if (b === PIT.BENCHES) return Math.max(r, 7.6);
  return r;
}

/* ─── Turnaround pads ───────────────────────────────────────────────────────
   Hairpins use a radial diameter: the road enters the pad on the inner
   (pit-facing) side, loops around the outer crest, and leaves on the outer
   side, so the incoming and outgoing lanes are separated by two pad radii.
   Each pad sits at the angular dip of its bench so its outer edge stays
   below the sensor ring of the bench above.                              */
const SW_PHI0 = 0.9; // base angle of the first pad
const SW_STEP = Math.PI + 0.55; // angular spacing between pad stacks
const PAD_R = 3.4; // hairpin radius (lane separation 2 * PAD_R)
const PAD_BACK = 5.2; // pad centre inside the bench crest (analytic radius)
const RAMP_BIAS = 0.8; // gentle bulge so ramps ride the lower bench tread
const PAD_FLAT_R = 3.4; // flattened turnaround platform radius
const PAD_FLAT_BLEND = 1.8; // soft edge of the flattened platform
const FLOOR_PAD_RC = 5.0; // floor pad centre radius (entry stays clear of bench 5 ring)
const LOAD_X = -4.5;
const LOAD_Z = -4.5;

interface PathPoint {
  x: number;
  z: number;
}

interface PathPointH extends PathPoint {
  y: number;
}

/** Angle of pad b: the dip of its bench near the alternating stack slot. */
function padAngle(b: number): number {
  const base = SW_PHI0 + b * SW_STEP;
  let bestA = base;
  let bestV = Infinity;
  for (let i = -20; i <= 20; i++) {
    const a = base + (i / 20) * 0.45;
    const v = boundaryRadius(b, a);
    if (v < bestV) {
      bestV = v;
      bestA = a;
    }
  }
  return bestA;
}

function padCenter(b: number): { phi: number; rc: number } {
  const phi = padAngle(b);
  // Anchored to the analytic radius so the ramp below stays clear of the
  // sensor ring of bench b (ring sits benchOuterRadius(b) - 4.6).
  const rc =
    b < PIT.BENCHES
      ? benchOuterRadius(b) - PAD_BACK
      : FLOOR_PAD_RC;
  return { phi, rc };
}

/** Inner entry (or outer exit) point of pad b on its turnaround circle. */
function padEnd(b: number, entry: boolean): PathPoint {
  const { phi, rc } = padCenter(b);
  const psi = phi + (entry ? 0 : Math.PI);
  return {
    x: rc * Math.cos(phi) + PAD_R * Math.cos(psi),
    z: rc * Math.sin(phi) + PAD_R * Math.sin(psi),
  };
}

/** Hairpin semicircle on pad b, looping around the outer crest. */
function padArcPoints(b: number, n: number): PathPoint[] {
  const { phi, rc } = padCenter(b);
  const cx = rc * Math.cos(phi);
  const cz = rc * Math.sin(phi);
  const pts: PathPoint[] = [];
  for (let i = 1; i <= n; i++) {
    const a = phi + (i / n) * Math.PI;
    pts.push({ x: cx + PAD_R * Math.cos(a), z: cz + PAD_R * Math.sin(a) });
  }
  return pts;
}

/** Arc in world polar coords from p0 to p1 along the SHORTEST angular path. */
function arcPoints(p0: PathPoint, p1: PathPoint, bias: number, n: number): PathPoint[] {
  const pts: PathPoint[] = [];
  const r0 = Math.hypot(p0.x, p0.z);
  const r1 = Math.hypot(p1.x, p1.z);
  const a0 = Math.atan2(p0.z, p0.x);
  const a1 = Math.atan2(p1.z, p1.x);
  const d = ((a1 - a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const sweep = d > Math.PI ? d - Math.PI * 2 : d;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = a0 + sweep * u;
    const r = r0 + (r1 - r0) * u + bias * Math.sin(Math.PI * u);
    pts.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
  }
  return pts;
}

/** Arc sampled with a per-point height function (used while building the road). */
function pushArc(
  pts: PathPointH[],
  p0: PathPoint,
  p1: PathPoint,
  bias: number,
  n: number,
  yFn: (u: number, p: PathPoint) => number
): void {
  const r0 = Math.hypot(p0.x, p0.z);
  const r1 = Math.hypot(p1.x, p1.z);
  const a0 = Math.atan2(p0.z, p0.x);
  const a1 = Math.atan2(p1.z, p1.x);
  const d = ((a1 - a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const sweep = d > Math.PI ? d - Math.PI * 2 : d;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = a0 + sweep * u;
    const r = r0 + (r1 - r0) * u + bias * Math.sin(Math.PI * u);
    const p = { x: Math.cos(a) * r, z: Math.sin(a) * r };
    pts.push({ ...p, y: yFn(u, p) });
  }
}

/** Flattened turnaround pad of bench b, sampled with its level height. */
function pushPadArc(pts: PathPointH[], b: number, n: number): void {
  const { phi, rc } = padCenter(b);
  const cx = rc * Math.cos(phi);
  const cz = rc * Math.sin(phi);
  const yP = b < PIT.BENCHES ? benchY(b) + 0.15 : -PIT.DEPTH + 0.15;
  for (let i = 1; i <= n; i++) {
    const a = phi + (i / n) * Math.PI;
    pts.push({ x: cx + PAD_R * Math.cos(a), z: cz + PAD_R * Math.sin(a), y: yP });
  }
}

/** Full road polyline (plan + designed height profile), sampled densely. */
function buildRoadPath(): PathPointH[] {
  const pts: PathPointH[] = [];

  // Long, oblique rim entry approaching pad 0 from the outside. The height
  // follows a designed smooth descent from the rim terrain to bench 0 so the
  // noisy hillside never perturbs the road profile.
  const p0 = padCenter(0);
  const eA = p0.phi - 1.4;
  const eR = boundaryRadius(0, eA) + 4.0;
  const entry: PathPoint = { x: Math.cos(eA) * eR, z: Math.sin(eA) * eR };
  const yE = terrainBase(entry.x, entry.z) + 0.15;
  const y0 = benchY(0) + 0.15;
  pushArc(pts, entry, padEnd(0, true), 0, 28, (u) => yE + (y0 - yE) * smoothstep(u));
  pushPadArc(pts, 0, 28);

  // Ramps (cutting across the faces) + hairpins, descending bench by bench.
  // Each ramp hugs the lower tread and blends from its pad's level into the
  // terrain over its first 20% of length, so the shelf is continuous. The
  // final ramp down to the floor uses a designed smooth descent instead, so
  // the road stays low (floor height) while it crosses the wandering wall
  // beside the floor sensors.
  for (let b = 0; b < PIT.BENCHES; b++) {
    const xB = padEnd(b, false);
    const eNext = padEnd(b + 1, true);
    const yB = benchY(b) + 0.15;
    if (b === PIT.BENCHES - 1) {
      const yF = -PIT.DEPTH + 0.15;
      pushArc(pts, xB, eNext, RAMP_BIAS, 48, (u) => yB + (yF - yB) * smoothstep(Math.min(1, u / 0.25)));
    } else {
      pushArc(pts, xB, eNext, RAMP_BIAS, 48, (u, p) => {
        const yT = terrainBase(p.x, p.z) + 0.15;
        return yB + (yT - yB) * smoothstep(Math.min(1, u / 0.2));
      });
    }
    pushPadArc(pts, b + 1, 28);
  }

  // Tail: floor pad entry -> loading platform on the floor. Bowed inward so
  // it diverges cleanly from the final ramp's approach, and kept on the
  // floor height (terrain-following) so its shelf never disturbs the floor
  // sensors. The floor pad's flattened turnaround remains in the terrain.
  pushArc(
    pts,
    padEnd(PIT.BENCHES, true),
    { x: LOAD_X, z: LOAD_Z },
    -1.5,
    40,
    (_u, p) => terrainBase(p.x, p.z) + 0.15
  );

  return pts;
}

/* Road curve: arc-length resampled switchback path hugging the terrain */
const ROAD_STEPS = 640;

export interface RoadPoint {
  x: number;
  y: number;
  z: number;
}

const ROAD_SAMPLES: RoadPoint[] = (() => {
  const dense = buildRoadPath();
  const cum: number[] = [0];
  for (let i = 1; i < dense.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z));
  }
  const total = cum[cum.length - 1];
  const out: RoadPoint[] = [];
  let idx = 0;
  for (let i = 0; i <= ROAD_STEPS; i++) {
    const target = (i / ROAD_STEPS) * total;
    while (idx < cum.length - 2 && cum[idx + 1] < target) idx++;
    const seg = (target - cum[idx]) / Math.max(1e-6, cum[idx + 1] - cum[idx]);
    const a = dense[idx];
    const b = dense[idx + 1];
    const x = a.x + (b.x - a.x) * seg;
    const z = a.z + (b.z - a.z) * seg;
    out.push({ x, y: a.y + (b.y - a.y) * seg, z });
  }
  return out;
})();

/** Road centreline at parameter t (0 = rim entry, 1 = loading platform). */
export function roadCurve(t: number): RoadPoint {
  const f = Math.max(0, Math.min(1, t)) * ROAD_STEPS;
  const i = Math.floor(f);
  const frac = f - i;
  const a = ROAD_SAMPLES[Math.min(i, ROAD_STEPS)];
  const b = ROAD_SAMPLES[Math.min(i + 1, ROAD_STEPS)];
  return {
    x: a.x + (b.x - a.x) * frac,
    y: a.y + (b.y - a.y) * frac,
    z: a.z + (b.z - a.z) * frac,
  };
}

/** Nearest road centreline distance and height (projected for continuity). */
export function roadNearest(x: number, z: number): { dist: number; y: number } {
  let best = Infinity;
  let bestI = 0;
  for (let i = 0; i < ROAD_SAMPLES.length; i++) {
    const p = ROAD_SAMPLES[i];
    const dx = x - p.x;
    const dz = z - p.z;
    const d = dx * dx + dz * dz;
    if (d < best) {
      best = d;
      bestI = i;
    }
  }
  // Project onto the nearest and the following segment; keep the closest.
  let bd = Infinity;
  let by = 0;
  for (const i of [bestI, Math.min(bestI + 1, ROAD_STEPS)]) {
    const a = ROAD_SAMPLES[Math.max(0, i - 1)];
    const b = ROAD_SAMPLES[i];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const l2 = abx * abx + abz * abz;
    let t = l2 > 1e-9 ? ((x - a.x) * abx + (z - a.z) * abz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
    if (d < bd) {
      bd = d;
      by = a.y + (b.y - a.y) * t;
    }
  }
  return { dist: bd, y: by };
}

/** Half width of the road shelf (flat band). */
export const ROAD_HALF = 1.6;
const ROAD_BLEND = 1.2;

/** Natural (road-free) terrain with flattened turnaround platforms. */
function terrainBase(x: number, z: number): number {
  const theta = Math.atan2(z, x);
  const r = Math.hypot(x, z);
  const rim = boundaryRadius(0, theta);

  let h: number;

  if (r > rim) {
    const d = r - rim;
    // Asymmetric surroundings: a ridge on the west side, low ground east
    const hill = 3.4 * (0.5 + 0.5 * Math.sin(theta - 2.6)) * Math.exp(-d / 22);
    h =
      fbm(x, z, 71) * 3.2 +
      fbm(x, z, 311, 2, 1 / 10) * 1.2 +
      1.1 * Math.exp(-d / 9) -
      0.012 * d +
      0.35 +
      hill +
      0.012 * x;
  } else {
    h = -PIT.DEPTH;
    for (let b = 0; b < PIT.BENCHES; b++) {
      const bOut = boundaryRadius(b, theta);
      const bIn = boundaryRadius(b + 1, theta);
      if (r > bIn && r <= bOut) {
        const gap = Math.max(1.0, bOut - bIn);
        const wallEdge = bIn + gap * 0.19;
        if (r <= wallEdge) {
          // Fractured rock face between bench b (crest) and bench b+1 (toe)
          const t = (r - bIn) / Math.max(0.5, wallEdge - bIn);
          const st = smoothstep(t);
          h =
            benchY(b) * st +
            benchY(b + 1) * (1 - st) +
            fbm(x * 0.9, z * 0.9, 517 + b * 37) * 0.55 +
            fbm(x * 1.8, z * 1.8, 521 + b) * 0.3 -
            crevice(x, z, 607 + b * 53) * 0.7;
        } else {
          // Tread — flat at the analytic bench height with gentle hummocks
          h = benchY(b) + fbm(x * 1.6, z * 1.6, 901 + b) * 0.22;
          // Alluvial fan where the wall toes out onto the tread
          const toeF = 1 - smoothstep(Math.min(1, Math.max(0, (r - wallEdge) / 1.3)));
          h -= 0.35 * toeF * (0.4 + 0.6 * fbm(x * 0.8, z * 0.8, 611 + b));
        }
        // Rim lip erosion on bench 0
        if (b === 0 && r > bOut - 1.4) {
          h -= 0.25 * crevice(x, z, 733);
        }
        break;
      }
    }
    if (h < -PIT.DEPTH + 0.01) {
      // Irregular pit floor
      h = -PIT.DEPTH + fbm(x, z, 409) * 0.7 + fbm(x * 2.1, z * 2.1, 417) * 0.25;
      // Loading platform: a wide flat pad where the shovels load the trucks
      const dPl = Math.hypot(x + 4.5, z + 4.5);
      const f = 1 - smoothstep(Math.min(1, Math.max(0, (dPl - 5.5) / 3.5)));
      h += (-17.75 + fbm(x * 1.2, z * 1.2, 61) * 0.25 - h) * f;
    }
  }

  // Flatten the hairpin turnarounds into level platforms (cut into the
  // slopes), matching the tread texture of their bench. The platform is
  // clipped to its own radial cell so it never pulls the floor band up or
  // cuts into the bench tread above.
  let bestD = Infinity;
  let bestB = 0;
  for (let b = 0; b <= PIT.BENCHES; b++) {
    const { phi, rc } = padCenter(b);
    const d = Math.hypot(x - rc * Math.cos(phi), z - rc * Math.sin(phi));
    if (d < bestD) {
      bestD = d;
      bestB = b;
    }
  }
  const withinCell =
    bestB < PIT.BENCHES
      ? r >= boundaryRadius(bestB + 1, theta) - 0.4
      : r <= boundaryRadius(PIT.BENCHES, theta) + 0.4;
  if (bestD < PAD_FLAT_R + PAD_FLAT_BLEND && withinCell) {
    const target =
      bestB < PIT.BENCHES
        ? benchY(bestB) + fbm(x * 1.6, z * 1.6, 901 + bestB) * 0.22
        : -PIT.DEPTH + fbm(x, z, 409) * 0.35 + fbm(x * 2.1, z * 2.1, 417) * 0.12;
    const f = 1 - smoothstep(Math.min(1, Math.max(0, (bestD - PAD_FLAT_R) / PAD_FLAT_BLEND)));
    h += (target - h) * f;
  }

  return h;
}

/**
 * Height of the terrain at world (x, z). Natural pit terrain with the haul
 * road flattened into a raised shelf (ramps cut into the faces, pads flat on
 * the treads) plus a safety berm on the downhill edge of sloped segments.
 */
export function pitHeightAt(x: number, z: number): number {
  const h = terrainBase(x, z);
  const nr = roadNearest(x, z);
  let out = h;
  if (nr.dist < ROAD_HALF + ROAD_BLEND * 0.5) {
    const shelf = nr.y - 0.35;
    if (nr.dist < ROAD_HALF - ROAD_BLEND * 0.5) {
      out = shelf;
    } else {
      const t = (nr.dist - (ROAD_HALF - ROAD_BLEND * 0.5)) / ROAD_BLEND;
      out = shelf + (h - shelf) * smoothstep(t);
    }
    // Safety berm on the downhill edge of sloped road segments
    if (h < nr.y - 0.6) {
      const b0 = ROAD_HALF - 0.4;
      const b1 = ROAD_HALF + 1.0;
      if (nr.dist > b0 && nr.dist < b1) {
        const tb = (nr.dist - b0) / (b1 - b0);
        out += 0.7 * Math.sin(Math.PI * tb) * Math.min(1, (nr.y - h) / 2.6);
      }
    }
  }
  return out;
}
