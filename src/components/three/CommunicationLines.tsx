import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SensorNode } from '../../data/types';
import { buildNetwork, GATEWAYS, gatewayPosition } from '../../utils/network';
import { useApp } from '../../store/AppContext';
import { clamp, riskColorGradient } from '../../utils/helpers';

export function CommunicationLines() {
  const { displaySensors } = useApp();
  const { links } = useMemo(() => buildNetwork(displaySensors), [displaySensors]);

  const byId = useMemo(() => new Map(displaySensors.map(s => [s.id, s])), [displaySensors]);

  const { positions, colors, packets } = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const pk: { from: THREE.Vector3; to: THREE.Vector3; color: string; rerouted: boolean; seed: number }[] = [];
    const c = new THREE.Color();

    links.forEach((link, i) => {
      const a = byId.get(link.from) ?? gatewayAsSensor(link.from);
      const b = byId.get(link.to) ?? gatewayAsSensor(link.to);
      if (!a || !b) return;
      const ax = a.position.x, ay = a.position.y, az = a.position.z;
      const bx = b.position.x, by = b.position.y, bz = b.position.z;
      pos.push(ax, ay, az, bx, by, bz);

      const avgRisk = (a.riskScore + b.riskScore) / 2;
      if (link.rerouted) {
        c.set('#f97316');
      } else {
        c.set('#38bdf8');
        c.lerp(new THREE.Color('#ef4444'), clamp(avgRisk / 100, 0, 1) * 0.55);
      }
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);

      if (link.active) {
        pk.push({
          from: new THREE.Vector3(ax, ay + 0.4, az),
          to: new THREE.Vector3(bx, by + 0.4, bz),
          color: `#${c.getHexString()}`,
          rerouted: link.rerouted,
          seed: i,
        });
      }
    });

    return { positions: pos, colors: col, packets: pk };
  }, [links, byId]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  return (
    <group>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.13}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      {packets.map(p => (
        <DataPacket key={`${p.from.x}-${p.seed}`} p={p} />
      ))}
    </group>
  );
}

function gatewayAsSensor(id: string): SensorNode | null {
  const g = gatewayPosition(id);
  if (!g) return null;
  return {
    id,
    name: id,
    zone: 'Gateway',
    zoneIndex: -1,
    status: 'safe',
    position: g,
    angle: 0,
    bench: -1,
    location: 'Rim Gateway',
    battery: 100,
    signalStrength: 100,
    tilt: 0,
    vibration: 0,
    moisture: 0,
    temperature: 0,
    humidity: 0,
    lastUpdated: new Date().toISOString(),
    healthScore: 100,
    communicationRoute: [],
    predictionConfidence: 0,
    riskScore: 0,
    historicalRisk: 0,
  };
}

function DataPacket({ p }: { p: { from: THREE.Vector3; to: THREE.Vector3; color: string; rerouted: boolean; seed: number } }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!meshRef.current) return;
    const speed = p.rerouted ? 1.5 : 0.4 + (p.seed % 5) * 0.09;
    const t = (state.clock.getElapsedTime() * speed + p.seed * 0.37) % 1;
    meshRef.current.position.lerpVectors(p.from, p.to, t);
    const s = 1 + Math.sin(state.clock.getElapsedTime() * 8 + p.seed) * 0.35;
    meshRef.current.scale.setScalar(s * 0.11);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={p.color} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

export { GATEWAYS };
