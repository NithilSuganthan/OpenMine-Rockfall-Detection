import type {
  DesignerLink, DesignerObject, DesignerVector3, ValidationIssue, ValidationResult,
} from '../data/designerTypes';
import { COMPONENT_SPECS, SENSING_TYPES } from '../data/designerCatalog';
import { PIT } from '../data/types';
import { dist3 } from './terrain';

export const LINK_MAX = 45;
export const GATEWAY_LOAD_WARN = 9;
export const GATEWAY_LOAD_ERR = 13;

function positionOf(o: DesignerObject | undefined): DesignerVector3 | null {
  return o ? o.position : null;
}

/** BFS reachability from every gateway across the link graph. */
function reachability(objects: DesignerObject[], links: DesignerLink[]): Map<string, boolean> {
  const byId = new Map(objects.map(o => [o.id, o]));
  const adj = new Map<string, string[]>();
  objects.forEach(o => adj.set(o.id, []));
  links.forEach(l => {
    adj.get(l.from)?.push(l.to);
    adj.get(l.to)?.push(l.from);
  });

  const reached = new Set<string>();
  const queue: string[] = objects.filter(o => o.type === 'gateway').map(o => o.id);
  queue.forEach(q => reached.add(q));
  while (queue.length) {
    const cur = queue.shift()!;
    (adj.get(cur) ?? []).forEach(n => {
      if (!reached.has(n)) {
        reached.add(n);
        queue.push(n);
      }
    });
  }
  const map = new Map<string, boolean>();
  objects.forEach(o => map.set(o.id, reached.has(o.id)));
  return map;
}

/** Grid-sampled sensing coverage score over the pit footprint. */
export function computeCoverage(objects: DesignerObject[]): number {
  const sensors = objects.filter(o => SENSING_TYPES.includes(o.type));
  if (sensors.length === 0) return 0;

  const sampleStep = 2.6;
  let covered = 0;
  let total = 0;
  for (let r = sampleStep / 2; r <= PIT.R; r += sampleStep) {
    const count = Math.max(6, Math.round((2 * Math.PI * r) / sampleStep));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      total++;
      const hit = sensors.some(s => {
        const radius = COMPONENT_SPECS[s.type].coverageRadius;
        return radius > 0 && dist3({ x, y: 0, z }, s.position) <= radius;
      });
      if (hit) covered++;
    }
  }
  return Math.round((covered / Math.max(1, total)) * 100);
}

export function validateDeployment(
  objects: DesignerObject[],
  links: DesignerLink[],
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const byId = new Map(objects.map(o => [o.id, o]));
  const reached = reachability(objects, links);
  const seen = new Set<string>();
  const push = (issue: Omit<ValidationIssue, 'id'>) => {
    const key = `${issue.severity}|${issue.objectId ?? ''}|${issue.linkId ?? ''}|${issue.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ id: `IS-${String(issues.length + 1).padStart(2, '0')}`, ...issue });
  };

  // 1. Connectivity — every node must reach a gateway
  objects.forEach(o => {
    if (o.type === 'gateway') {
      const gatewayLinks = links.filter(l => l.from === o.id || l.to === o.id).length;
      if (gatewayLinks === 0) {
        push({
          severity: 'error',
          message: `${o.id} is not connected to any node — gateway unreachable.`,
          objectId: o.id,
          position: o.position,
        });
      }
      return;
    }
    if (!reached.get(o.id)) {
      push({
        severity: 'error',
        message: `${o.id} is isolated — no communication path to a gateway.`,
        objectId: o.id,
        position: o.position,
      });
      return;
    }
    const direct = links.filter(l => l.from === o.id || l.to === o.id);
    if (direct.length === 0) {
      push({
        severity: 'error',
        message: `${o.id} has no links — connect it to a neighbour or gateway.`,
        objectId: o.id,
        position: o.position,
      });
    } else if (direct.length === 1) {
      push({
        severity: 'warning',
        message: `${o.id} has a single link — single point of failure, add redundancy.`,
        objectId: o.id,
        position: o.position,
      });
    }
  });

  // 2. Long hops — signal margin
  links.forEach(l => {
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    if (!a || !b) return;
    const d = dist3(a.position, b.position);
    if (d > LINK_MAX) {
      push({
        severity: 'warning',
        message: `${l.from} → ${l.to} is a ${Math.round(d)} m hop — exceeds ${LINK_MAX} m design limit.`,
        linkId: l.id,
        position: { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2, z: (a.position.z + b.position.z) / 2 },
      });
    }
  });

  // 3. Gateway load
  const gatewayLoads = objects
    .filter(o => o.type === 'gateway')
    .map(g => ({
      gatewayId: g.id,
      load: links.filter(l => l.from === g.id || l.to === g.id).length,
    }));
  gatewayLoads.forEach(({ gatewayId, load }) => {
    if (load > GATEWAY_LOAD_ERR) {
      push({
        severity: 'error',
        message: `${gatewayId} is overloaded (${load} connections) — spread load or add a gateway.`,
        objectId: gatewayId,
        position: byId.get(gatewayId)?.position,
      });
    } else if (load > GATEWAY_LOAD_WARN) {
      push({
        severity: 'warning',
        message: `${gatewayId} is heavily loaded (${load} connections).`,
        objectId: gatewayId,
        position: byId.get(gatewayId)?.position,
      });
    }
  });

  // 4. Bench coverage — every bench should carry monitoring
  for (let b = 0; b < PIT.BENCHES; b++) {
    const sensing = objects.filter(o => o.bench === b && SENSING_TYPES.includes(o.type));
    if (sensing.length === 0) {
      push({
        severity: 'warning',
        message: `Bench ${b + 1} has no monitoring sensors.`,
      });
    } else {
      // Spacing gaps along the bench ring
      const angles = sensing
        .map(s => Math.atan2(s.position.z, s.position.x))
        .sort((a, b) => a - b);
      for (let i = 0; i < angles.length; i++) {
        const a1 = angles[i];
        const a2 = angles[(i + 1) % angles.length] + (i === angles.length - 1 ? Math.PI * 2 : 0);
        const gap = a2 - a1;
        if (gap > 1.1) {
          push({
            severity: 'warning',
            message: `Sensor spacing on Bench ${b + 1} exceeds recommended distance — coverage gap of ${Math.round((gap / (Math.PI * 2)) * 100)}°.`,
          });
        }
      }
      // Two sensors too close
      for (let i = 0; i < sensing.length; i++) {
        for (let j = i + 1; j < sensing.length; j++) {
          const d = dist3(sensing[i].position, sensing[j].position);
          if (d < 4) {
            push({
              severity: 'info',
              message: `${sensing[i].id} and ${sensing[j].id} are ${Math.round(d)} m apart — sensors too close.`,
              objectId: sensing[j].id,
              position: sensing[j].position,
            });
          }
        }
      }
    }
  }

  // 5. Camera sightline heuristic
  objects.filter(o => o.type === 'camera').forEach(cam => {
    const blocked = cam.bench >= 3 || cam.bench === -1;
    if (blocked) {
      push({
        severity: 'warning',
        message: `${cam.id} sightline partially blocked by pit geometry — consider mounting on an upper bench.`,
        objectId: cam.id,
        position: cam.position,
      });
    }
  });

  const score = computeCoverage(objects);
  const grade: ValidationResult['grade'] =
    score >= 90 ? 'Excellent' : score >= 78 ? 'Good' : score >= 60 ? 'Fair' : 'Poor';

  return {
    score,
    grade,
    issues,
    errorCount: issues.filter(i => i.severity === 'error').length,
    warningCount: issues.filter(i => i.severity === 'warning').length,
    gatewayLoads,
  };
}

/** Short label for the most relevant connection target of an object. */
export function gatewayFor(
  object: DesignerObject,
  objects: DesignerObject[],
  links: DesignerLink[],
): string | null {
  const direct = links
    .filter(l => l.from === object.id || l.to === object.id)
    .map(l => (l.from === object.id ? l.to : l.from));
  const gw = direct.find(id => objects.find(o => o.id === id)?.type === 'gateway');
  if (gw) return gw;
  const mid = direct[0] ?? null;
  if (mid) {
    const midObj = objects.find(o => o.id === mid);
    return midObj ? gatewayFor(midObj, objects, links) : null;
  }
  return null;
}

export { positionOf };

/* ─── Live deployment metrics ──────────────────────────────────────────── */

export interface CommHealth {
  reachable: number;
  total: number;
  pct: number;
}

/** Percentage of non-gateway nodes that have a communication path to a gateway. */
export function communicationHealth(objects: DesignerObject[], links: DesignerLink[]): CommHealth {
  const reached = reachability(objects, links);
  const nodes = objects.filter(o => o.type !== 'gateway');
  const ok = nodes.filter(o => reached.get(o.id));
  return {
    reachable: ok.length,
    total: nodes.length,
    pct: nodes.length === 0 ? 0 : Math.round((ok.length / nodes.length) * 100),
  };
}

export interface BlindSpot {
  bench: number;
  sector: string;
  radius: number;
}

/** Benches (and the pit floor) that carry no sensing coverage at all. */
export function blindSpots(objects: DesignerObject[]): BlindSpot[] {
  const spots: BlindSpot[] = [];
  const benches = Array.from({ length: PIT.BENCHES }, (_, i) => i);
  benches.concat([-1]).forEach(b => {
    const sensing = objects.filter(o => o.bench === b && SENSING_TYPES.includes(o.type));
    if (sensing.length === 0) {
      spots.push({ bench: b, sector: 'whole ring', radius: 0 });
    }
  });
  return spots;
}
