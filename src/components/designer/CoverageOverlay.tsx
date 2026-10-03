import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DesignerObject } from '../../data/designerTypes';
import { COMPONENT_SPECS, SENSING_TYPES } from '../../data/designerCatalog';
import { PIT } from '../../data/types';
import { dist3 } from '../../utils/terrain';

/**
 * Coverage overlay used during preview — a grid of dots over the pit footprint,
 * lit green where sensing coverage exists, dim where it does not.
 */
export function CoverageOverlay({ objects }: { objects: DesignerObject[] }) {
  const sensors = useMemo(() => objects.filter(o => SENSING_TYPES.includes(o.type)), [objects]);

  const points = useMemo(() => {
    const pts: { position: [number, number, number]; covered: boolean }[] = [];
    const step = 3.4;
    for (let r = step; r <= PIT.R + 8; r += step) {
      const count = Math.max(8, Math.round((2 * Math.PI * r) / step));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const y = terrainEstimate(x, z);
        const covered = sensors.some(s => {
          const radius = COMPONENT_SPECS[s.type].coverageRadius;
          return radius > 0 && dist3({ x, y: 0, z }, s.position) <= radius;
        });
        pts.push({ position: [x, y + 0.15, z], covered });
      }
    }
    return pts;
  }, [sensors]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      pos[i * 3] = p.position[0];
      pos[i * 3 + 1] = p.position[1];
      pos[i * 3 + 2] = p.position[2];
    });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [points]);

  const coveredGeo = useMemo(() => sliceGeo(points.filter(p => p.covered)), [points]);
  const gapGeo = useMemo(() => sliceGeo(points.filter(p => !p.covered)), [points]);

  return (
    <group>
      <points geometry={coveredGeo}>
        <pointsMaterial size={0.34} color="#22c55e" transparent opacity={0.55} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points geometry={gapGeo}>
        <pointsMaterial size={0.26} color="#ef4444" transparent opacity={0.3} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {/* keep full geometry referenced to avoid GC churn */}
      <points geometry={geo} visible={false} />
    </group>
  );
}

function sliceGeo(list: { position: [number, number, number] }[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(list.length * 3);
  list.forEach((p, i) => {
    pos[i * 3] = p.position[0];
    pos[i * 3 + 1] = p.position[1];
    pos[i * 3 + 2] = p.position[2];
  });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

/** Rough terrain height from pit radii (no angle dependence needed for overlay). */
function terrainEstimate(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r >= PIT.R) return 0;
  for (let b = 0; b < PIT.BENCHES; b++) {
    const outer = PIT.R - b * (PIT.BENCH_W + PIT.WALL_W);
    const inner = PIT.R - (b + 1) * (PIT.BENCH_W + PIT.WALL_W);
    if (r <= outer && r >= inner) return -b * PIT.STEP_H;
  }
  return -PIT.DEPTH;
}

/**
 * Always-on LoRa mesh coverage radii. Gateways (cyan, 26 m) and LoRa relay
 * nodes (violet, 22 m) broadcast their reach so the designer can see mesh
 * coverage while planning. Sensing nodes show their radius only during
 * placement (handled by PlacementAssist in DesignerScene).
 */
export function CoverageRings({ objects }: { objects: DesignerObject[] }) {
  const nodes = useMemo(
    () => objects.filter(o => o.type === 'gateway' || o.type === 'relay-node'),
    [objects],
  );

  return (
    <group>
      {nodes.map(g => {
        const isGateway = g.type === 'gateway';
        const radius = COMPONENT_SPECS[g.type].coverageRadius;
        return (
          <PulsingRing
            key={g.id}
            position={[g.position.x, g.position.y + 0.12, g.position.z]}
            radius={radius}
            color={isGateway ? '#22d3ee' : '#a78bfa'}
          />
        );
      })}
    </group>
  );
}

function PulsingRing({ position, radius, color }: { position: [number, number, number]; radius: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const s = 1 + Math.sin(t * 1.1) * 0.035;
    ref.current.scale.set(s, 1, s);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.14 + Math.sin(t * 1.1) * 0.04;
  });

  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.98, radius, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}
