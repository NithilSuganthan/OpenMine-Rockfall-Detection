import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SensorNode } from '../../data/types';
import { usePrediction } from '../../hooks/usePrediction';
import { statusColors, statusLabels, tierColors } from '../../utils/helpers';
import { makeGlowTexture } from './glow';

interface SensorNode3DProps {
  sensor: SensorNode;
  isSelected: boolean;
  onSelect: () => void;
}

export function SensorNode3D({ sensor, isSelected, onSelect }: SensorNode3DProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const spriteRef = useRef<THREE.Sprite>(null!);
  const [hovered, setHovered] = useState(false);
  const glowTexture = makeGlowTexture();
  const { prediction } = usePrediction();

  const color = prediction ? tierColors[prediction.tier] : statusColors[sensor.status];
  const offline = sensor.status === 'offline';
  const active = hovered || isSelected;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ringRef.current && !offline) {
      const phase = t * 2.2 + sensor.angle;
      const s = 1 + Math.sin(phase) * 0.35;
      ringRef.current.scale.setScalar(s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.55 - Math.sin(phase) * 0.35;
      ringRef.current.rotation.z = t * 0.4;
    }
    if (spriteRef.current) {
      const s = offline ? 0.6 : 1 + Math.sin(t * 2.4 + sensor.angle) * 0.22 + (active ? 0.35 : 0);
      spriteRef.current.scale.setScalar(s);
      (spriteRef.current.material as THREE.SpriteMaterial).opacity = offline ? 0.25 : 0.42 + (active ? 0.3 : 0);
    }
  });

  return (
    <group ref={groupRef} position={[sensor.position.x, sensor.position.y, sensor.position.z]}>
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.42, 0.54, 0.12, 12]} />
        <meshStandardMaterial color="#10161f" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.03, 0.045, 0.6, 8]} />
        <meshStandardMaterial color="#3b4654" metalness={0.8} roughness={0.35} />
      </mesh>

      <mesh
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[offline ? 0.28 : 0.32, 20, 20]} />
        <meshStandardMaterial
          color={offline ? '#454f5c' : color}
          emissive={offline ? '#1e2530' : color}
          emissiveIntensity={active ? 2.2 : 1.25}
          roughness={0.25}
          metalness={0.1}
          transparent
          opacity={offline ? 0.55 : 1}
        />
      </mesh>

      <sprite ref={spriteRef} scale={[1.3, 1.3, 1]}>
        <spriteMaterial
          map={glowTexture}
          color={offline ? '#64748b' : color}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {!offline && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.5, 0.72, 40]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.85, 1.05, 40]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {(hovered || isSelected) && (
        <>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([0, 0.5, 0, 0, 1.08, 0]), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={offline ? '#64748b' : color} transparent opacity={0.3} depthWrite={false} />
          </line>
          <Html position={[0, 1.38, 0]} center style={{ pointerEvents: 'none' }}>
            <div
              className="glass-panel px-2.5 py-1.5 whitespace-nowrap"
              style={{ borderColor: `${color}55`, boxShadow: `0 0 18px ${color}35, 0 8px 20px rgba(0,0,0,0.5)` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-display font-bold tracking-wider text-white">{sensor.id}</span>
                <span className="text-[9px] text-slate-400">{sensor.zone}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: offline ? '#64748b' : color }} />
                <span className="text-[9px] font-mono" style={{ color: offline ? '#94a3b8' : color }}>
                  {offline ? 'OFFLINE' : `${statusLabels[sensor.status].toUpperCase()} · RISK ${sensor.riskScore.toFixed(0)}%`}
                </span>
              </div>
              {!offline && (
                <div className="text-[8px] font-mono text-slate-500 mt-0.5">
                  BAT {sensor.battery.toFixed(0)}% · SIG {sensor.signalStrength}%
                </div>
              )}
            </div>
          </Html>
        </>
      )}
    </group>
  );
}
