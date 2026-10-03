import type {
  AISuggestion, DesignerLink, DesignerObject, DesignerVector3,
} from '../data/designerTypes';
import { COMPONENT_SPECS, SENSING_TYPES } from '../data/designerCatalog';
import { PIT, benchMidRadius } from '../data/types';
import {
  GATEWAY_LOAD_ERR, GATEWAY_LOAD_WARN, LINK_MAX, validateDeployment,
} from './designerValidation';
import { clampToMine, dist3, terrainInfoAt } from './terrain';

export function generateSuggestions(
  objects: DesignerObject[],
  links: DesignerLink[],
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const result = validateDeployment(objects, links);
  const byId = new Map(objects.map(o => [o.id, o]));
  let n = 0;
  const next = () => `AI-${String(++n).padStart(2, '0')}`;

  // 1. Coverage
  if (result.score < 85) {
    const bench = weakestBench(objects);
    const pos = benchCenter(bench);
    suggestions.push({
      id: next(),
      severity: 'info',
      text: `Estimated sensing coverage is ${result.score}%. Add sensors to close gaps on ${bench === -1 ? 'the pit floor' : `Bench ${bench + 1}`}.`,
      applied: false,
      apply: { kind: 'add-object', type: 'geophone', position: pos },
    });
  }

  // 2. Bench vibration coverage
  for (let b = 0; b < PIT.BENCHES; b++) {
    const hasGeophone = objects.some(o => o.bench === b && o.type === 'geophone');
    const hasAny = objects.some(o => o.bench === b && SENSING_TYPES.includes(o.type));
    if (!hasAny) {
      suggestions.push({
        id: next(),
        severity: 'warning',
        text: `Bench ${b + 1} has no monitoring sensors at all.`,
        applied: false,
        apply: { kind: 'add-object', type: 'geophone', position: benchCenter(b) },
      });
      break;
    }
    if (!hasGeophone) {
      suggestions.push({
        id: next(),
        severity: 'info',
        text: `Bench ${b + 1} has no vibration monitoring. A geophone here would improve blast/creep detection.`,
        applied: false,
        apply: { kind: 'add-object', type: 'geophone', position: benchCenter(b) },
      });
    }
  }

  // 2b. Bench tilt coverage (MPU6050)
  for (let b = 0; b < PIT.BENCHES; b++) {
    const hasTilt = objects.some(o => o.bench === b && o.type === 'tilt-sensor');
    if (!hasTilt) {
      suggestions.push({
        id: next(),
        severity: 'info',
        text: `Bench ${b + 1} has no slope-inclination (MPU6050) monitoring.`,
        applied: false,
        apply: { kind: 'add-object', type: 'tilt-sensor', position: benchCenter(b) },
      });
      break;
    }
  }

  // 2c. Soil moisture coverage
  if (!objects.some(o => o.type === 'soil-moisture')) {
    suggestions.push({
      id: next(),
      severity: 'warning',
      text: 'No soil moisture sensing deployed — rainfall infiltration into slope material is unmonitored.',
      applied: false,
      apply: { kind: 'add-object', type: 'soil-moisture', position: benchCenter(PIT.BENCHES - 1) },
    });
  }

  // 3. Gateway load
  const loaded = result.gatewayLoads.find(g => g.load > GATEWAY_LOAD_WARN);
  if (loaded) {
    const gw = byId.get(loaded.gatewayId);
    if (gw) {
      const dir = Math.atan2(gw.position.z, gw.position.x);
      const r = Math.min(118, Math.hypot(gw.position.x, gw.position.z) + 13);
      const pos = { x: Math.cos(dir) * r, y: 0, z: Math.sin(dir) * r };
      const info = terrainInfoAt(pos.x, pos.z);
      pos.y = info.y;
      suggestions.push({
        id: next(),
        severity: loaded.load > GATEWAY_LOAD_ERR ? 'error' : 'warning',
        text: `${loaded.gatewayId} is ${loaded.load > GATEWAY_LOAD_ERR ? 'overloaded' : 'heavily loaded'} (${loaded.load} connections). Add a gateway to balance mesh traffic.`,
        applied: false,
        apply: { kind: 'add-object', type: 'gateway', position: pos },
      });
    }
  }

  // 4. Redundancy — single-link nodes
  const singles = objects.filter(o => {
    if (o.type === 'gateway') return false;
    return links.filter(l => l.from === o.id || l.to === o.id).length === 1;
  });
  if (singles.length > 0) {
    const target = singles[0];
    const targetObj = byId.get(target.id)!;
    const dir = Math.atan2(targetObj.position.z, targetObj.position.x);
    const r = Math.max(4, Math.hypot(targetObj.position.x, targetObj.position.z) - 8);
    const pos = { x: Math.cos(dir) * r, y: 0, z: Math.sin(dir) * r };
    const info = terrainInfoAt(pos.x, pos.z);
    pos.y = info.y;
    suggestions.push({
      id: next(),
      severity: 'warning',
      text: `${target.id} has a single link. Add one relay node nearby to improve redundancy and failover.`,
      applied: false,
      apply: { kind: 'add-object', type: 'relay-node', position: pos },
    });
  }

  // 5. Camera sightline
  const blockedCam = objects.find(o => o.type === 'camera' && o.bench >= 3);
  if (blockedCam) {
    const dir = Math.atan2(blockedCam.position.z, blockedCam.position.x);
    const pos = { x: Math.cos(dir) * 50, y: -3, z: Math.sin(dir) * 50 };
    const info = terrainInfoAt(pos.x, pos.z);
    pos.y = info.y;
    suggestions.push({
      id: next(),
      severity: 'warning',
      text: `${blockedCam.id} visibility is blocked by terrain. Relocate to the upper rim for a clear sightline.`,
      applied: false,
      apply: { kind: 'add-object', type: 'camera', position: pos },
    });
  }

  // 6. Long hops
  const longHop = links.find(l => {
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    return a && b && dist3(a.position, b.position) > LINK_MAX;
  });
  if (longHop) {
    const a = byId.get(longHop.from)!;
    const b = byId.get(longHop.to)!;
    const mid = { x: (a.position.x + b.position.x) / 2, y: 0, z: (a.position.z + b.position.z) / 2 };
    const info = terrainInfoAt(mid.x, mid.z);
    mid.y = info.y;
    suggestions.push({
      id: next(),
      severity: 'info',
      text: `${longHop.from} → ${longHop.to} exceeds ${LINK_MAX} m. A relay node at the midpoint stabilises the hop.`,
      applied: false,
      apply: { kind: 'add-object', type: 'relay-node', position: mid },
    });
  }

  // 7. All clear
  if (suggestions.length === 0) {
    suggestions.push({
      id: next(),
      severity: 'success',
      text: `Deployment looks solid — coverage ${result.score}%, no critical issues. Ready for validation and deploy.`,
      applied: false,
      apply: null,
    });
  }

  return suggestions.slice(0, 5);
}

function weakestBench(objects: DesignerObject[]): number {
  let worst = 0;
  let worstScore = Infinity;
  for (let b = 0; b < PIT.BENCHES; b++) {
    const count = objects.filter(o => o.bench === b && SENSING_TYPES.includes(o.type)).length;
    if (count < worstScore) {
      worstScore = count;
      worst = b;
    }
  }
  return worst;
}

function benchCenter(bench: number): DesignerVector3 {
  const r = benchMidRadius(bench);
  // Deterministic golden-angle spacing (no random) so re-reviews are stable
  const angle = (bench + 1) * 2.39996323 + 0.7;
  const clamped = clampToMine(Math.cos(angle) * r, Math.sin(angle) * r);
  const info = terrainInfoAt(clamped.x, clamped.z);
  return { x: clamped.x, y: info.y, z: clamped.z };
}

export { COMPONENT_SPECS };
