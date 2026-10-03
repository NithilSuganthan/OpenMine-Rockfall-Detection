import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PIT, benchOuterRadius, benchY } from '../../data/types';
import { mulberry32 } from '../../utils/helpers';
import { makeGlowTexture } from './glow';

// Curated PBR colors for open pit minerals & rock strata
const strataColors = [
  { color: '#2b241d', roughness: 0.95, metalness: 0.05 }, // Top overburden
  { color: '#382f25', roughness: 0.92, metalness: 0.08 },
  { color: '#443729', roughness: 0.90, metalness: 0.12 }, // Iron/copper rich zone
  { color: '#3a3229', roughness: 0.95, metalness: 0.05 },
  { color: '#2b2721', roughness: 0.98, metalness: 0.02 }, // Deep basalt
  { color: '#1e1c18', roughness: 0.99, metalness: 0.01 }, // Pit floor
];

// Winding haul road points calculation
export function getHaulRoadPoint(t: number): THREE.Vector3 {
  const a0 = 0.15;
  const a1 = Math.PI * 4.15;
  const a = a0 + (a1 - a0) * t;
  const r = 61.5 - 50.5 * t;
  const y = -Math.pow(t, 1.12) * 17.4;
  return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
}

// Build custom geometry for the winding haul road
function buildRoadGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const steps = 300;
  for (let i = 0; i <= steps; i++) {
    pts.push(getHaulRoadPoint(i / steps));
  }
  const positions: number[] = [];
  const width = 3.6;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    const n = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(width);
    const l1 = new THREE.Vector3().copy(p1).add(n);
    const r1 = new THREE.Vector3().copy(p1).sub(n);
    const l2 = new THREE.Vector3().copy(p2).add(n);
    const r2 = new THREE.Vector3().copy(p2).sub(n);

    // Quad 1
    positions.push(l1.x, l1.y, l1.z);
    positions.push(r1.x, r1.y, r1.z);
    positions.push(l2.x, l2.y, l2.z);
    // Quad 2
    positions.push(r1.x, r1.y, r1.z);
    positions.push(r2.x, r2.y, r2.z);
    positions.push(l2.x, l2.y, l2.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

export function MineTerrain() {
  const roadGeo = useMemo(() => buildRoadGeometry(), []);
  const glowTexture = useMemo(() => makeGlowTexture(), []);

  return (
    <group>
      {/* ─── 1. TERRACED BENCHES & PIT WALLS ─── */}
      <group>
        {Array.from({ length: PIT.BENCHES }, (_, i) => {
          const outer = benchOuterRadius(i);
          const inner = benchOuterRadius(i + 1);
          const y = benchY(i);
          const cfg = strataColors[i] || strataColors[0];
          return (
            <group key={`bench-${i}`}>
              {/* Flat bench surface */}
              <mesh position={[0, y + 0.01, 0]} receiveShadow>
                <ringGeometry args={[inner, outer, 96]} />
                <meshStandardMaterial
                  color={cfg.color}
                  roughness={cfg.roughness}
                  metalness={cfg.metalness}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Sloped pit wall to next bench */}
              <mesh position={[0, y - PIT.STEP_H / 2, 0]} receiveShadow>
                <cylinderGeometry args={[inner, inner - 0.7, PIT.STEP_H, 96, 1, true]} />
                <meshStandardMaterial
                  color={cfg.color}
                  roughness={cfg.roughness + 0.05}
                  metalness={cfg.metalness}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}
        {/* Bottom-most pit floor */}
        <mesh position={[0, -PIT.DEPTH + 0.01, 0]} receiveShadow>
          <circleGeometry args={[benchOuterRadius(PIT.BENCHES) - 0.1, 96]} />
          <meshStandardMaterial color={strataColors[PIT.BENCHES - 1].color} roughness={0.99} side={THREE.DoubleSide} />
        </mesh>
        {/* Top natural surface ring surrounding the pit */}
        <mesh position={[0, -0.02, 0]} receiveShadow>
          <ringGeometry args={[PIT.R, 120, 96]} />
          <meshStandardMaterial color="#1a1612" roughness={0.98} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ─── 2. HAUL ROAD ─── */}
      <mesh geometry={roadGeo} position={[0, 0.03, 0]} receiveShadow>
        <meshStandardMaterial color="#2c2820" roughness={0.94} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* ─── 3. SAFETY BARRIERS (BERMS) ALONG BENCHES ─── */}
      <SafetyBerms />

      {/* ─── 4. WINDING HAULAGE VEHICLES (DUMP TRUCKS & EXCAVATORS) ─── */}
      <MineVehicles />

      {/* ─── 5. INFRASTRUCTURE: COMMUNICATIONS & MONITORING ─── */}
      <TelecomTowers glowTexture={glowTexture} />
      <MonitoringPoles glowTexture={glowTexture} />
      <ControlFacility glowTexture={glowTexture} />

      {/* ─── 6. OUTER SURROUNDINGS & LIGHTING SWEEP ─── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -22, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#040609" roughness={1} />
      </mesh>
      <RadarScanSweep />
    </group>
  );
}

/* ─── Instanced Safety Berms along edges of Benches ─── */
export function SafetyBerms() {
  const count = 180;
  const geom = new THREE.DodecahedronGeometry(0.3, 0);
  const mat = new THREE.MeshStandardMaterial({ color: '#2b231c', roughness: 0.97 });

  const instancedMesh = useMemo(() => {
    const mesh = new THREE.InstancedMesh(geom, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let idx = 0;

    const rng = mulberry32(42);
    // Place berms along the outer edge of benches 1, 2, and 3
    for (let b = 0; b < 3; b++) {
      const radius = benchOuterRadius(b) - 0.4;
      const y = benchY(b) + 0.12;
      const numBerms = 60;
      for (let i = 0; i < numBerms; i++) {
        const angle = (i / numBerms) * Math.PI * 2 + rng() * 0.05;
        // Skip haul road path area to keep it clear
        if (angle % (Math.PI * 2) > 0.1 && angle % (Math.PI * 2) < 2.5) {
          p.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
          s.set(0.7 + rng() * 0.6, 0.6 + rng() * 0.4, 0.7 + rng() * 0.6);
          q.setFromEuler(new THREE.Euler(rng() * 0.2, angle, rng() * 0.2));
          m.compose(p, q, s);
          mesh.setMatrixAt(idx++, m);
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, []);

  return <primitive object={instancedMesh} castShadow receiveShadow />;
}

/* ─── Active Mine Machinery: Excavators and Heavy Dump Trucks ─── */
export function MineVehicles({
  pathAt,
}: { pathAt?: (t: number) => { x: number; y: number; z: number } } = {}) {
  const truck1Ref = useRef<THREE.Group>(null);
  const truck2Ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Dump Truck 1 winds down the haul road
    if (truck1Ref.current) {
      const t = (time * 0.015) % 1.0;
      if (pathAt) {
        // Grounded on a scene-provided road curve (switchback system)
        const p1 = pathAt(t);
        const p2 = pathAt(Math.min(0.999, t + 0.005));
        truck1Ref.current.position.set(p1.x, p1.y + 0.4, p1.z);
        truck1Ref.current.lookAt(p2.x, p1.y + 0.4, p2.z);
      } else {
        const p1 = getHaulRoadPoint(t);
        const p2 = getHaulRoadPoint(Math.min(0.999, t + 0.005));
        truck1Ref.current.position.copy(p1);
        truck1Ref.current.translateY(0.4); // sit above road
        const lookTarget = new THREE.Vector3().copy(p2);
        lookTarget.y = truck1Ref.current.position.y; // keep level rotation
        truck1Ref.current.lookAt(lookTarget);
      }
    }

    // Dump Truck 2 moves at the bottom pit floor loop
    if (truck2Ref.current) {
      const radius = 8.5;
      const angle = time * 0.08;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const nextAngle = angle + 0.01;
      truck2Ref.current.position.set(x, -17.3, z);
      truck2Ref.current.lookAt(Math.cos(nextAngle) * radius, -17.3, Math.sin(nextAngle) * radius);
    }
  });

  return (
    <group>
      {/* Truck 1: Moving down haul road */}
      <group ref={truck1Ref}>
        <HeavyDumpTruck color="#fbbf24" scale={0.72} />
      </group>

      {/* Truck 2: Bottom of pit loop */}
      <group ref={truck2Ref}>
        <HeavyDumpTruck color="#e2e8f0" scale={0.72} />
      </group>

      {/* Primary Excavator at bottom pit floor */}
      <group position={[-5, -17.4, -4]} rotation={[0, 0.8, 0]}>
        <HeavyExcavator />
      </group>

      {/* Secondary Excavator on Bench 2 */}
      <group position={[28, -7.5, -28]} rotation={[0, -1.2, 0]}>
        <HeavyExcavator />
      </group>
    </group>
  );
}

/* ─── Heavy Duty Mining Dump Truck 3D Model ─── */
function HeavyDumpTruck({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <group scale={[scale, scale, scale]}>
      {/* Main Chassis / Underframe */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.5, 0.4, 3.2]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* 6 Large Mud Wheels */}
      {[-0.85, 0.85].map((x, xi) =>
        [-1, 0, 1].map((z, zi) => (
          <mesh key={`${xi}-${zi}`} position={[x, 0.1, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.48, 16]} />
            <meshStandardMaterial color="#090d16" roughness={0.9} />
          </mesh>
        ))
      )}

      {/* Operator Cabin */}
      <mesh position={[-0.45, 0.95, 0.9]} castShadow>
        <boxGeometry args={[0.7, 0.8, 0.9]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Cabin Windows */}
      <mesh position={[-0.45, 1.05, 1.36]}>
        <planeGeometry args={[0.52, 0.45]} />
        <meshBasicMaterial color="#0ea5e9" transparent opacity={0.8} />
      </mesh>

      {/* Large Dump Bed Container */}
      <mesh position={[0, 1.0, -0.45]} rotation={[-0.1, 0, 0]} castShadow>
        <boxGeometry args={[1.6, 0.9, 2.2]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.45} />
      </mesh>

      {/* Glowing Headlights */}
      {[-0.55, 0.55].map((x, i) => (
        <mesh key={i} position={[x, 0.4, 1.62]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#fef08a" />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Heavy Mining Hydraulic Excavator 3D Model ─── */
function HeavyExcavator() {
  const armRef = useRef<THREE.Group>(null);
  const cabRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // Simulate digging movement cycle
    if (armRef.current) {
      armRef.current.rotation.x = Math.sin(time * 1.5) * 0.12 - 0.2;
    }
    if (cabRef.current) {
      cabRef.current.rotation.y = Math.sin(time * 0.6) * 0.25;
    }
  });

  return (
    <group>
      {/* Crawler Track Base */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.8, 0.5, 2.5]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.5} />
      </mesh>
      {/* Left/Right Tracks */}
      {[-1.0, 1.0].map((x, i) => (
        <mesh key={i} position={[x, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.35, 12]} />
          <meshStandardMaterial color="#020617" roughness={0.9} />
        </mesh>
      ))}

      {/* Rotating Upper Cabin Structure */}
      <group ref={cabRef} position={[0, 0.5, 0]}>
        {/* Main Body */}
        <mesh position={[0, 0.6, -0.25]} castShadow>
          <boxGeometry args={[1.6, 1.1, 1.9]} />
          <meshStandardMaterial color="#fb923c" metalness={0.4} roughness={0.4} />
        </mesh>
        {/* Tinted Operator glass */}
        <mesh position={[0.5, 0.8, 0.71]}>
          <planeGeometry args={[0.5, 0.7]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.75} />
        </mesh>

        {/* Boom Joint & Hydraulics */}
        <group position={[-0.4, 0.8, 0.7]} ref={armRef}>
          {/* Main Boom Segment */}
          <mesh position={[0, 0.8, 0.6]} rotation={[0.6, 0, 0]} castShadow>
            <boxGeometry args={[0.22, 1.8, 0.22]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Stick/Arm Segment */}
          <group position={[0, 1.5, 1.1]} rotation={[-1.2, 0, 0]}>
            <mesh position={[0, 0.6, 0]} castShadow>
              <boxGeometry args={[0.18, 1.4, 0.18]} />
              <meshStandardMaterial color="#fb923c" metalness={0.5} roughness={0.4} />
            </mesh>
            {/* Bucket / Digging Scoop */}
            <mesh position={[0, 1.2, 0.2]} rotation={[0.8, 0, 0]} castShadow>
              <boxGeometry args={[0.65, 0.55, 0.65]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/* ─── Communication Lattice Towers ─── */
export interface TowerPosition {
  x: number;
  z: number;
  rot: number;
  y?: number;
}

const DEFAULT_TOWERS: TowerPosition[] = [
  { x: -50, z: -35, rot: 0.2 },
  { x: 45, z: 42, rot: -0.6 },
];

export function TelecomTowers({ glowTexture, positions = DEFAULT_TOWERS }: {
  glowTexture: THREE.Texture;
  positions?: TowerPosition[];
}) {
  const towers = positions;

  return (
    <group>
      {towers.map((t, idx) => (
        <group key={idx} position={[t.x, t.y ?? 0, t.z]} rotation={[0, t.rot, 0]}>
          {/* Vertical main structural legs */}
          <mesh position={[0, 5, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.35, 10, 4]} />
            <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.25} />
          </mesh>
          {/* Cross braces */}
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i} position={[0, i * 2.5 + 1.25, 0]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[1.5 - i * 0.25, 0.05, 0.05]} />
              <meshStandardMaterial color="#64748b" metalness={0.9} />
            </mesh>
          ))}
          {/* Dish Antennas */}
          <mesh position={[0.4, 8.5, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <cylinderGeometry args={[0.9, 0.9, 0.22, 16, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
          {/* Obstruction Beacon Light */}
          <mesh position={[0, 10.15, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2.5} />
          </mesh>
          <sprite scale={[2.6, 2.6, 1]} position={[0, 10.15, 0]}>
            <spriteMaterial map={glowTexture} color="#ef4444" transparent opacity={0.65} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </group>
  );
}

/* ─── Slope Stability Monitoring Poles ─── */
export function MonitoringPoles({
  glowTexture,
  positions,
}: {
  glowTexture: THREE.Texture;
  positions?: { x: number; y: number; z: number; color: string }[];
}) {
  const poles = positions ?? [
    { x: -35, y: -3.8, z: 20, color: '#22d3ee' },
    { x: 30, y: -7.5, z: -15, color: '#f59e0b' },
    { x: -14, y: -15.0, z: -22, color: '#ef4444' },
  ];

  return (
    <group>
      {poles.map((p, idx) => (
        <group key={idx} position={[p.x, p.y, p.z]}>
          {/* Ground Anchor Base */}
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.4, 0.5, 0.2, 8]} />
            <meshStandardMaterial color="#334155" roughness={0.6} />
          </mesh>
          {/* Support Pole */}
          <mesh position={[0, 2.0, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 4.0, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Angled Solar Panel */}
          <mesh position={[-0.25, 3.65, 0]} rotation={[0.4, 0, 0.4]} castShadow>
            <boxGeometry args={[0.6, 0.05, 0.8]} />
            <meshStandardMaterial color="#1e1b4b" metalness={0.95} roughness={0.1} />
          </mesh>
          {/* Solar Panel mounting frame */}
          <mesh position={[-0.1, 3.5, 0]}>
            <boxGeometry args={[0.2, 0.3, 0.05]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          {/* LED Signal Beacon at top */}
          <mesh position={[0, 4.08, 0]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={2.0} />
          </mesh>
          <sprite scale={[1.8, 1.8, 1]} position={[0, 4.08, 0]}>
            <spriteMaterial map={glowTexture} color={p.color} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </group>
  );
}

/* ─── Control Room Facility ─── */
export function ControlFacility({ glowTexture }: { glowTexture: THREE.Texture }) {
  return (
    <group position={[5, 0, 64.0]} rotation={[0, -0.45, 0]}>
      {/* Main Server & Ops Cabin */}
      <mesh position={[0, 2.4, 0]} castShadow>
        <boxGeometry args={[8.5, 4.8, 5.0]} />
        <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Angled Roof overhang */}
      <mesh position={[0, 5.0, 0]} castShadow>
        <boxGeometry args={[9.5, 0.4, 6.0]} />
        <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Front glass window array */}
      {[-2.6, 0, 2.6].map((x, i) => (
        <mesh key={i} position={[x, 2.6, 2.52]}>
          <planeGeometry args={[1.4, 1.8]} />
          <meshStandardMaterial
            color="#67e8f9"
            emissive="#22d3ee"
            emissiveIntensity={0.6}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
      {/* Signal whip antenna */}
      <mesh position={[3.5, 7.1, -1.5]}>
        <cylinderGeometry args={[0.03, 0.03, 3.8, 6]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
      </mesh>
      <mesh position={[3.5, 9.0, -1.5]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2.0} />
      </mesh>
      <sprite scale={[2.0, 2.0, 1]} position={[3.5, 9.0, -1.5]}>
        <spriteMaterial map={glowTexture} color="#22d3ee" transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}

/* ─── Animated Radar/LiDAR scanning effect ring ─── */
function RadarScanSweep() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.getElapsedTime() * 0.45;
    }
  });

  return (
    <group position={[0, -5, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh ref={meshRef}>
        <ringGeometry args={[1, 52, 64, 1, 0, Math.PI * 0.2]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.07}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
