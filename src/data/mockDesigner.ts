import type { DesignerLink, DesignerObject } from './designerTypes';
import { COMPONENT_SPECS } from './designerCatalog';
import { facingPitCenter, terrainInfoAt } from '../utils/terrain';

function at(x: number, z: number, id: string, name: string, type: DesignerObject['type'], battery = 90): DesignerObject {
  const info = terrainInfoAt(x, z);
  return {
    id,
    name,
    type,
    position: { x, y: info.y, z },
    bench: info.bench,
    yaw: facingPitCenter(x, z),
    status: 'planned',
    battery,
    samplingRate: COMPONENT_SPECS[type].defaultRate,
    commGateway: null,
  };
}

function link(from: string, to: string, id: string, hops = 1, kind: 'direct' | 'mesh' = 'mesh'): DesignerLink {
  const jitter = (from.charCodeAt(0) * 31 + to.charCodeAt(0) * 17 + id.charCodeAt(0)) % 6;
  return { id, from, to, latency: 5 + jitter, kind, hops };
}

export function seedDeployment(): { objects: DesignerObject[]; links: DesignerLink[] } {
  const objects: DesignerObject[] = [
    at(44, 44, 'GW-01', 'Gateway North-East', 'gateway', 100),
    at(-45, -30, 'GW-02', 'Gateway South-West', 'gateway', 100),
    at(58, 5, 'WS-01', 'Weather Mast', 'weather-station', 95),
    at(10, 66, 'SI-01', 'Perimeter Siren', 'emergency-siren', 98),
    at(41.6, 24, 'PO-01', 'Bench 2 Pole', 'monitoring-pole', 92),
    at(-36.6, 13.3, 'TS-01', 'Tilt Bench 2 West', 'tilt-sensor', 88),
    at(-6.9, -39.4, 'TS-02', 'Tilt Bench 2 South', 'tilt-sensor', 86),
    at(-28.2, 10.3, 'TS-03', 'Tilt Bench 3 West', 'tilt-sensor', 90),
    at(27.6, 23.1, 'GE-01', 'Geophone Bench 2', 'geophone', 85),
    at(25, -43.3, 'CA-01', 'Camera South Wall', 'camera', 90),
    at(-27.2, -9.9, 'RL-01', 'Relay Bench 3', 'relay-node', 82),
    at(-7.1, 8.4, 'RL-02', 'Relay Deep West', 'relay-node', 84),
  ];

  const links: DesignerLink[] = [
    link('PO-01', 'GW-01', 'L-01'),
    link('WS-01', 'GW-01', 'L-02'),
    link('SI-01', 'GW-01', 'L-03'),
    link('GE-01', 'GW-01', 'L-04'),
    link('TS-01', 'RL-01', 'L-05'),
    link('TS-03', 'RL-01', 'L-06'),
    link('TS-01', 'TS-03', 'L-07'),
    link('RL-01', 'GW-02', 'L-08'),
    link('TS-02', 'GW-02', 'L-09'),
    link('TS-02', 'CA-01', 'L-10'),
    link('TS-02', 'RL-01', 'L-11'),
    link('RL-02', 'TS-01', 'L-12'),
    link('RL-02', 'TS-02', 'L-13'),
    link('RL-02', 'GE-01', 'L-14'),
  ];

  return { objects, links };
}
