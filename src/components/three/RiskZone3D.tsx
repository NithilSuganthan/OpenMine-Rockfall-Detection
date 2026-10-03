import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { HighRiskZone } from '../../data/types';
import { benchY } from '../../data/types';
import { riskColorGradient } from '../../utils/helpers';
import { boundaryRadius, pitHeightAt } from './terrainField';

interface RiskZone3DProps {
  zone: HighRiskZone;
  isSelected: boolean;
  onSelect: () => void;
  showLabel: boolean;
}

/**
 * Risk zone annotation for the terrain-centric Digital Twin. The old radar
 * wedge visuals are gone; risk is painted by HeatmapOverlay. This component
 * keeps the interactive hot spot, a clean floating label with a thin leader
 * line and a subtle selection ring on the bench surface.
 */
export function RiskZone3D({ zone, isSelected, onSelect, showLabel }: RiskZone3DProps) {
  const [hovered, setHovered] = useState(false);
  const ringRef = useRef<THREE.Mesh>(null!);
  const color = riskColorGradient(zone.currentRisk);

  const [l1, l2] = zone.levels;
  const midLevel = (l1 + l2) / 2;
  const midAngle = (zone.angleStart + zone.angleEnd) / 2;
  // Anchor on the actual (irregular) bench boundary and terrain height
  const anchorRadius = boundaryRadius(midLevel, midAngle) - 4.0;
  const anchorX = Math.cos(midAngle) * anchorRadius;
  const anchorZ = Math.sin(midAngle) * anchorRadius;
  const anchorY = pitHeightAt(anchorX, anchorZ);

  const labelPos: [number, number, number] = [
    anchorX,
    benchY(midLevel) + 6.4,
    anchorZ,
  ];
  const anchorPos: [number, number, number] = [
    anchorX,
    anchorY + 0.5,
    anchorZ,
  ];

  const leaderPoints = useMemo(() => new Float32Array([...anchorPos, ...labelPos]), [anchorPos[0], labelPos[0]]);

  const labelActive = showLabel || hovered || isSelected;

  useFrame((state) => {
    if (ringRef.current) {
      const t = state.clock.getElapsedTime();
      ringRef.current.scale.setScalar(isSelected ? 1 + Math.sin(t * 2.4) * 0.06 : 1);
    }
  });

  return (
    <group
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      {/* Invisible interaction hot spot on the bench surface */}
      <mesh position={[anchorPos[0], anchorY + 0.15, anchorPos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[10, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Selection / hover ring on the bench tread */}
      {(isSelected || hovered) && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, anchorY + 0.06, 0]}>
          <ringGeometry args={[anchorRadius - 1.1, anchorRadius + 0.3, 96]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={isSelected ? 0.75 : 0.32}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Thin leader line to the floating label */}
      {labelActive && (
        <line>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[leaderPoints, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
        </line>
      )}

      {labelActive && (
        <Html position={labelPos} center style={{ pointerEvents: 'none' }}>
          <div
            className="px-2.5 py-1 rounded-md whitespace-nowrap font-display"
            style={{
              background: 'rgba(7,11,18,0.72)',
              border: `1px solid ${color}66`,
              backdropFilter: 'blur(6px)',
              boxShadow: `0 0 16px ${color}40`,
            }}
          >
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color }}>
              {zone.shortName}
            </div>
            <div className="text-[9px] font-mono text-slate-300">
              RISK {zone.currentRisk}% · CONF {zone.confidence.toFixed(0)}%
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
