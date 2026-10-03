import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ValidationIssue } from '../../data/designerTypes';
import { useDesigner } from '../../store/designerStore';
import { makeGlowTexture } from '../three/glow';

const SEVERITY_COLOR: Record<ValidationIssue['severity'], string> = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#38bdf8',
};

/**
 * Error/warning markers floating on the 3D model after validation.
 * Clicking a marker focuses the affected object.
 */
export function ValidationMarkers({ issues }: { issues: ValidationIssue[] }) {
  const focusOn = useDesigner(s => s.focusOn);

  return (
    <group>
      {issues.filter(i => i.position).map(issue => (
        <Marker key={issue.id} issue={issue} onFocus={() => issue.position && focusOn(issue.position)} />
      ))}
    </group>
  );
}

function Marker({ issue, onFocus }: { issue: ValidationIssue; onFocus: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const glow = makeGlowTexture();
  const color = SEVERITY_COLOR[issue.severity];
  const [hovered, setHovered] = useState(false);
  const showLabel = issue.severity === 'error' || hovered;

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = (issue.position?.y ?? 0) + 2.6 + Math.sin(t * 2) * 0.3;
    ref.current.rotation.y = t * 1.6;
  });

  const pos = issue.position!;

  return (
    <group position={[pos.x, 0, pos.z]}>
      <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onFocus(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} transparent opacity={0.92} />
      </mesh>
      <sprite position={[0, 0.1, 0]}>
        <spriteMaterial map={glow} color={color} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {showLabel && (
        <Html position={[0, 1.1, 0]} center style={{ pointerEvents: 'none' }}>
          <div
            className="glass-panel px-2 py-1.5 whitespace-nowrap"
            style={{ borderColor: `${color}66`, boxShadow: `0 0 14px ${color}40` }}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
              <span className="text-[8px] font-mono text-slate-300 max-w-[220px] truncate">{issue.message}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// Keep component tree stable — memo the markers group
export function useMarkerGeometries() {
  return useMemo(() => new THREE.OctahedronGeometry(0.34, 0), []);
}
