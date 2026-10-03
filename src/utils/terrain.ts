import { PIT, benchOuterRadius, benchMidRadius, benchY } from '../data/types';
import type { DesignerVector3 } from '../data/designerTypes';
import { pitHeightAt } from '../components/three/terrainField';

export const MINE_LIMIT = 118;
export const COVERAGE_RADIUS = 16;

export interface TerrainInfo {
  y: number;
  bench: number; // 0..5 = bench index, -1 = pit floor, -2 = top surface
  radius: number;
  sector: string;
}

const SECTORS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];

export function sectorName(angle: number): string {
  const idx = Math.round(angle / (Math.PI / 4)) % 8;
  return SECTORS[idx];
}

export function benchLabel(bench: number): string {
  if (bench === -1) return 'Pit Floor';
  if (bench === -2) return 'Top Surface';
  return `Bench ${bench + 1}`;
}

/**
 * Analytic terrain height of the stylized open-pit mine at (x, z).
 * The pit is built from flat concentric bench rings, so height is exact.
 */
export function terrainInfoAt(x: number, z: number): TerrainInfo {
  const radius = Math.hypot(x, z);
  if (radius >= PIT.R) {
    return { y: 0, bench: -2, radius, sector: sectorName(Math.atan2(z, x)) };
  }
  for (let b = 0; b < PIT.BENCHES; b++) {
    const outer = benchOuterRadius(b);
    const inner = benchOuterRadius(b + 1);
    if (radius <= outer && radius >= inner) {
      return { y: benchY(b), bench: b, radius, sector: sectorName(Math.atan2(z, x)) };
    }
  }
  return { y: -PIT.DEPTH, bench: -1, radius, sector: sectorName(Math.atan2(z, x)) };
}

export function terrainHeightAt(x: number, z: number): number {
  return terrainInfoAt(x, z).y;
}

/** Clamp a point into the drivable mine footprint (keeps objects on terrain). */
export function clampToMine(x: number, z: number): { x: number; z: number } {
  const r = Math.hypot(x, z);
  if (r <= MINE_LIMIT) return { x, z };
  const k = MINE_LIMIT / r;
  return { x: x * k, z: z * k };
}

export function dist3(a: DesignerVector3, b: DesignerVector3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Azimuth from origin toward a point (yaw so model faces pit centre). */
export function facingPitCenter(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

/** Suggest an ID for the next object of a given type. */
export function nextId(prefix: string, existing: string[]): string {
  let n = 1;
  let id = '';
  do {
    id = `${prefix}-${String(n).padStart(2, '0')}`;
    n++;
  } while (existing.includes(id));
  return id;
}

/** Midpoint of two 3D positions with a vertical lift for curved link geometry. */
export function liftedMidpoint(a: DesignerVector3, b: DesignerVector3, lift = 1.6): DesignerVector3 {
  const mid = {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
  const d = dist3(a, b);
  mid.y += Math.min(6, Math.max(lift, d * 0.045));
  return mid;
}

export interface SnappedPoint {
  position: DesignerVector3;
  bench: number; // -1 = pit floor, 0..5 = bench index, -2 = top surface
  outOfBounds: boolean;
  snappedToBench: boolean;
}

/**
 * Snap a world point onto the Digital Twin height field (pitHeightAt), the
 * exact same terrain the deployed twin renders on. Objects are clamped to
 * the mine footprint, grounded on the surface (never floating, never
 * underground) and optionally pulled radially onto the nearest bench tread.
 */
export function snapToTerrain(
  x: number,
  z: number,
  snapToBench = true,
  benchTolerance = 1.6,
): SnappedPoint {
  const rawR = Math.hypot(x, z);
  const clamped = clampToMine(x, z);
  const outOfBounds = rawR > MINE_LIMIT;

  let px = clamped.x;
  let pz = clamped.z;
  let snappedToBench = false;

  if (snapToBench) {
    const r = Math.hypot(px, pz);
    let bestB = -1;
    let bestD = Infinity;
    for (let b = 0; b < PIT.BENCHES; b++) {
      const mid = benchMidRadius(b);
      const d = Math.abs(r - mid);
      if (d < bestD) {
        bestD = d;
        bestB = b;
      }
    }
    if (bestB >= 0 && bestD <= benchTolerance) {
      const a = Math.atan2(pz, px);
      px = Math.cos(a) * benchMidRadius(bestB);
      pz = Math.sin(a) * benchMidRadius(bestB);
      snappedToBench = true;
    }
  }

  const y = pitHeightAt(px, pz);
  const r = Math.hypot(px, pz);
  let bench: number;
  if (r >= PIT.R) bench = -2;
  else if (y <= -PIT.DEPTH + 0.6) bench = -1;
  else bench = Math.min(PIT.BENCHES - 1, Math.max(0, Math.round(-y / PIT.STEP_H)));

  return {
    position: { x: px, y, z: pz },
    bench,
    outOfBounds,
    snappedToBench,
  };
}
