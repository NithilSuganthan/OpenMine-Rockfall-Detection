import type { CommunicationLink, SensorNode, Vector3 } from '../data/types';

export interface GatewayInfo {
  id: string;
  position: Vector3;
}

export const GATEWAYS: GatewayInfo[] = [
  { id: 'GW-01', position: { x: 63.5, y: 1.5, z: 2 } },
  { id: 'GW-02', position: { x: 5, y: 1.5, z: -63.5 } },
  { id: 'GW-03', position: { x: -60, y: 1.5, z: -22 } },
  { id: 'GW-04', position: { x: -8, y: 1.5, z: 62 } },
];

export const GATEWAY_IDS = GATEWAYS.map(g => g.id);

export interface NetworkGraph {
  links: CommunicationLink[];
  offlineCount: number;
  reroutedCount: number;
  coverage: number;
}

function dist(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function buildNetwork(sensors: SensorNode[]): NetworkGraph {
  const online = sensors.filter(s => s.status !== 'offline');
  const offlineIds = new Set(sensors.filter(s => s.status === 'offline').map(s => s.id));

  const byId = new Map(sensors.map(s => [s.id, s]));
  const links: CommunicationLink[] = [];
  const added = new Set<string>();

  const addLink = (a: string, b: string, rerouted: boolean, strength: number) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (added.has(key)) return;
    added.add(key);
    links.push({ from: a, to: b, active: true, rerouted, strength });
  };

  const lostByOffline = new Set<string>();
  sensors.forEach(s => {
    if (offlineIds.has(s.id)) return;
    for (const o of offlineIds) {
      const off = byId.get(o);
      if (off && dist(s.position, off.position) < 24) {
        lostByOffline.add(s.id);
        break;
      }
    }
  });

  online.forEach(s => {
    const neighbors = online
      .filter(n => n.id !== s.id && dist(s.position, n.position) < 30)
      .sort((a, b) => dist(s.position, a.position) - dist(s.position, b.position))
      .slice(0, 2);

    neighbors.forEach(n => {
      const rerouted = lostByOffline.has(s.id) || lostByOffline.has(n.id);
      addLink(s.id, n.id, rerouted, 55 + Math.floor(Math.random() * 30));
    });

    const nearestGw = GATEWAYS.reduce((best, g) => {
      const d = dist(s.position, g.position);
      return d < best.d ? { g, d } : best;
    }, { g: GATEWAYS[0], d: Infinity });
    addLink(s.id, nearestGw.g.id, lostByOffline.has(s.id), 70 + Math.floor(Math.random() * 25));
  });

  return {
    links,
    offlineCount: offlineIds.size,
    reroutedCount: links.filter(l => l.rerouted).length,
    coverage: Math.round((online.length / sensors.length) * 100),
  };
}

export function linkColor(link: CommunicationLink): string {
  if (link.rerouted) return '#f97316';
  return '#38bdf8';
}

export function gatewayPosition(id: string): Vector3 {
  return GATEWAYS.find(g => g.id === id)?.position ?? GATEWAYS[0].position;
}

export function angleDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}
