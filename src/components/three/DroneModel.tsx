import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useApp } from '../../store/AppContext';
import { benchOuterRadius, benchY } from '../../data/types';
import { makeGlowTexture } from './glow';

export function DroneModel() {
  const { zones } = useApp();
  const groupRef = useRef<THREE.Group>(null!);
  const rotorRef = useRef<THREE.Group>(null!);
  const glowTexture = useMemo(() => makeGlowTexture(), []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (rotorRef.current) {
      rotorRef.current.rotation.y += 0.6;
    }
    if (!groupRef.current) return;

    // Inspect the highest-risk zone: orbit its sector at bench level
    let target = zones[0];
    for (const z of zones) {
      if (z.currentRisk > target.currentRisk) target = z;
    }
    const [l1, l2] = target.levels;
    const midLevel = (l1 + l2) / 2;
    const orbitR = benchOuterRadius(midLevel) * 0.72;
    const angle = t * 0.45;
    const x = Math.cos(angle) * orbitR;
    const z = Math.sin(angle) * orbitR;
    const y = benchY(midLevel) + 9 + Math.sin(t * 0.9) * 1.8;

    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = -angle + Math.PI / 2;
  });

  const arms: [number, number, number][] = [
    [1.1, 0, 1.1],
    [1.1, 0, -1.1],
    [-1.1, 0, 1.1],
    [-1.1, 0, -1.1],
  ];

  return (
    <group ref={groupRef}>
      <group>
        <mesh castShadow>
          <boxGeometry args={[0.9, 0.28, 0.9]} />
          <meshStandardMaterial color="#1c2735" metalness={0.75} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[0.5, 0.1, 0.5]} />
          <meshStandardMaterial color="#12202f" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.16, 0.5]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2.4} />
        </mesh>
        <mesh position={[0, -0.3, 0.25]}>
          <sphereGeometry args={[0.14, 10, 10]} />
          <meshStandardMaterial color="#0a1220" metalness={0.9} roughness={0.1} />
        </mesh>
        {arms.map((pos, i) => (
          <group key={i} position={pos}>
            <mesh rotation={[0, 0, 0]}>
              <boxGeometry args={[0.09, 0.07, 0.09]} />
              <meshStandardMaterial color="#33415a" metalness={0.7} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.18, 8]} />
              <meshStandardMaterial color="#46566e" metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={rotorRef}>
        {arms.map((pos, i) => (
          <mesh key={i} position={[pos[0], 0.3, pos[2]]}>
            <boxGeometry args={[1.5, 0.02, 0.12]} />
            <meshStandardMaterial color="#6b7d94" metalness={0.5} roughness={0.5} transparent opacity={0.55} />
          </mesh>
        ))}
      </group>

      <sprite scale={[3, 3, 1]}>
        <spriteMaterial map={glowTexture} color="#38bdf8" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      <spotLight
        position={[0, -0.4, 0]}
        target-position={[0, -30, 0]}
        angle={0.34}
        penumbra={0.7}
        intensity={14}
        color="#8be9ff"
        distance={55}
      />
      <pointLight position={[0, -1, 0]} color="#38bdf8" intensity={1.6} distance={14} />
    </group>
  );
}
