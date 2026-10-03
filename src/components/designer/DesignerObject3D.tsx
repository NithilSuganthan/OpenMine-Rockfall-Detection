import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { DesignerObject } from '../../data/designerTypes';
import { COMPONENT_SPECS } from '../../data/designerCatalog';
import { benchLabel } from '../../utils/terrain';
import { makeGlowTexture } from '../three/glow';
import { useDesigner } from '../../store/designerStore';

interface Props {
  object: DesignerObject;
  isSelected: boolean;
  isHovered: boolean;
  highlight?: boolean;
  ghost?: boolean;
  isInvalid?: boolean;
  overrideYaw?: number;
  preview?: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onHover: (id: string | null) => void;
}

/**
 * CAD-style node for a deployed hardware component. Supports ghost previews
 * (placement / move), validity indication (green/red ground ring), a
 * drop-in placement animation and full per-type hardware models.
 */
export function DesignerObject3D({
  object, isSelected, isHovered, highlight, ghost, isInvalid, overrideYaw, preview, onClick, onDoubleClick, onHover,
}: Props) {
  const spec = COMPONENT_SPECS[object.type];
  const color = spec.color;
  const glowTexture = makeGlowTexture();
  const [hover, setHover] = useState(false);
  const placedAnimation = useDesigner(s => s.placedAnimation);
  const clearPlacedAnimation = useDesigner(s => s.clearPlacedAnimation);

  const active = hover || isHovered || isSelected || highlight;
  const animating = !ghost && placedAnimation?.id === object.id;
  const dropProgress = useRef(0);

  useFrame((_, dt) => {
    if (animating && placedAnimation) {
      dropProgress.current = Math.min(1, dropProgress.current + dt / 0.7);
      if (dropProgress.current >= 1) clearPlacedAnimation(placedAnimation.nonce);
    } else {
      dropProgress.current = 0;
    }
  });

  useEffect(() => {
    if (!ghost) document.body.style.cursor = active ? 'pointer' : 'default';
    return () => { document.body.style.cursor = 'default'; };
  }, [active, ghost]);

  const dropY = animating ? (1 - dropProgress.current) * 5 : 0;
  const dropScale = animating ? 0.45 + dropProgress.current * 0.55 : 1;
  const yaw = overrideYaw ?? object.yaw;
  const ringColor = ghost ? (isInvalid ? '#ef4444' : '#22c55e') : isSelected || highlight ? '#38bdf8' : color;

  return (
    <group
      position={[object.position.x, object.position.y + dropY, object.position.z]}
      rotation={[0, yaw, 0]}
      scale={dropScale}
    >
      {/* Ground plate */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[spec.type === 'gateway' ? 1.1 : 0.62, spec.type === 'gateway' ? 1.3 : 0.78, 0.12, 16]} />
        <meshStandardMaterial
          color="#121a28"
          metalness={0.7}
          roughness={0.45}
          transparent={ghost}
          opacity={ghost ? 0.35 : 1}
        />
      </mesh>

      {/* Type-specific hardware model */}
      <ModelBody type={object.type} ghost={ghost} />

      {/* Ground ring: selection / validity */}
      {(isSelected || highlight || ghost) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
          <ringGeometry args={[1.0, 1.24, 40]} />
          <meshBasicMaterial
            color={ringColor}
            transparent
            opacity={ghost ? (isInvalid ? 0.95 : 0.8) : 0.85}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Drop-in shockwave ring */}
      {animating && placedAnimation && (
        <DropShockwave
          progress={dropProgress.current}
          color={color}
          nonce={placedAnimation.nonce}
        />
      )}

      {/* Glow halo */}
      {!ghost && (
        <sprite scale={[active ? 3.1 : 2.3, active ? 3.1 : 2.3, 1]} position={[0, spec.baseHeight * 0.95, 0]}>
          <spriteMaterial
            map={glowTexture}
            color={color}
            transparent
            opacity={active ? 0.75 : 0.38}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      )}

      {/* Interaction surface */}
      <mesh
        visible={!ghost}
        position={[0, spec.baseHeight * 0.45, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); onHover(object.id); }}
        onPointerOut={() => { setHover(false); onHover(null); }}
      >
        <cylinderGeometry args={[0.9, 0.95, spec.baseHeight, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Label */}
      {!ghost && (hover || isSelected) && (
        <Html position={[0, spec.baseHeight + 0.8, 0]} center style={{ pointerEvents: 'none' }}>
          <div
            className="glass-panel px-2.5 py-1.5 whitespace-nowrap"
            style={{ borderColor: `${color}55`, boxShadow: `0 0 18px ${color}35, 0 8px 20px rgba(0,0,0,0.5)` }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-display font-bold tracking-wider text-white">{object.id}</span>
              <span className="text-[9px] text-slate-400">{benchLabel(object.bench)}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] font-mono" style={{ color }}>
                {spec.label.toUpperCase()}
              </span>
            </div>
            <div className="text-[8px] font-mono text-slate-500 mt-0.5">
              BAT {object.battery.toFixed(0)}% · RATE {object.samplingRate}s
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function DropShockwave({ progress, color, nonce }: { progress: number; color: string; nonce: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const p = Math.min(1, progress + dt / 0.4);
    const s = 1 + p * 6.5;
    ref.current.scale.set(s, 1, s);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - p);
    ref.current.rotation.z = p * 0.6;
  });
  void nonce;
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
      <ringGeometry args={[0.55, 0.95, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/* ─── Hardware models (shared with the deployed Digital Twin) ────────────── */

export function ModelBody({ type, ghost }: { type: DesignerObject['type']; ghost?: boolean }) {
  switch (type) {
    case 'monitoring-pole': return <Pole ghost={ghost} />;
    case 'tilt-sensor': return <TiltSensor ghost={ghost} />;
    case 'geophone': return <Geophone ghost={ghost} />;
    case 'soil-moisture': return <SoilMoisture ghost={ghost} />;
    case 'camera': return <CameraModel ghost={ghost} />;
    case 'weather-station': return <WeatherStation ghost={ghost} />;
    case 'gateway': return <GatewayModel ghost={ghost} />;
    case 'relay-node': return <RelayNode ghost={ghost} />;
    case 'emergency-siren': return <Siren ghost={ghost} />;
  }
}

function useMat(ghost?: boolean) {
  return (base: THREE.MeshStandardMaterialParameters): Partial<THREE.MeshStandardMaterialParameters> => ({
    ...base,
    transparent: true,
    opacity: ghost ? 0.35 : 1,
  });
}

function Pole({ ghost }: { ghost?: boolean }) {
  const m = useMat(ghost);
  const beaconRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    if (beaconRef.current) {
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(t * 3) * 1.1;
    }
  });
  return (
    <group>
      <mesh position={[0, 1.7, 0]} castShadow {...m({ color: '#8fa3b8', metalness: 0.85, roughness: 0.3 })}>
        <cylinderGeometry args={[0.05, 0.09, 3.4, 8]} />
      </mesh>
      <mesh position={[-0.32, 3.05, 0]} rotation={[0.35, 0, 0.45]} {...m({ color: '#1e1b4b', metalness: 0.95, roughness: 0.12 })}>
        <boxGeometry args={[0.5, 0.05, 0.72]} />
      </mesh>
      <mesh position={[-0.14, 2.95, 0]} {...m({ color: '#475569', metalness: 0.7 })}>
        <boxGeometry args={[0.16, 0.28, 0.05]} />
      </mesh>
      <mesh ref={beaconRef} position={[0, 3.52, 0]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2} {...m({})} />
      </mesh>
    </group>
  );
}

function TiltSensor({ ghost }: { ghost?: boolean }) {
  const m = useMat(ghost);
  const headRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(t * 1.4) * 0.12;
      (headRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + Math.sin(t * 2.6) * 0.5;
    }
  });
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow {...m({ color: '#3b4654', metalness: 0.8, roughness: 0.35 })}>
        <cylinderGeometry args={[0.04, 0.06, 1.1, 8]} />
      </mesh>
      <mesh ref={headRef} position={[0, 1.02, 0]} castShadow {...m({ color: '#38bdf8', metalness: 0.4, roughness: 0.35, emissive: '#38bdf8', emissiveIntensity: 0.5 })}>
        <boxGeometry args={[0.44, 0.3, 0.3]} />
      </mesh>
      <mesh position={[0, 1.42, 0]} {...m({ color: '#8fa3b8', metalness: 0.9, roughness: 0.25 })}>
        <cylinderGeometry args={[0.015, 0.015, 0.42, 6]} />
      </mesh>
    </group>
  );
}

function Geophone({ ghost }: { ghost?: boolean }) {
  const m = useMat(ghost);
  const drumRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    if (drumRef.current) {
      (drumRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + (Math.sin(t * 6) + 1) * 0.5;
    }
  });
  return (
    <group>
      <mesh ref={drumRef} position={[0, 0.4, 0]} castShadow {...m({ color: '#fb923c', metalness: 0.35, roughness: 0.5, emissive: '#fb923c', emissiveIntensity: 0.5 })}>
        <cylinderGeometry args={[0.5, 0.44, 0.8, 14]} />
      </mesh>
      <mesh position={[0, 0.86, 0]} {...m({ color: '#1e293b', metalness: 0.8, roughness: 0.4 })}>
        <cylinderGeometry args={[0.26, 0.26, 0.08, 14]} />
      </mesh>
      <mesh position={[0.28, 0.78, 0]} rotation={[0, 0, -Math.PI / 3]} {...m({ color: '#94a3b8', metalness: 0.9 })}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
      </mesh>
    </group>
  );
}

function SoilMoisture({ ghost }: { ghost?: boolean }) {
  const m = useMat(ghost);
  const ledRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    if (ledRef.current) {
      (ledRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(t * 2.2) * 0.6;
    }
  });
  return (
    <group>
      {/* Sealed electronics head */}
      <mesh position={[0, 0.62, 0]} castShadow {...m({ color: '#2f9e77', metalness: 0.45, roughness: 0.4, emissive: '#34d399', emissiveIntensity: 0.18 })}>
        <boxGeometry args={[0.34, 0.22, 0.24]} />
      </mesh>
      <mesh ref={ledRef} position={[0.19, 0.62, 0]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={1.6} {...m({})} />
      </mesh>
      {/* Body tube */}
      <mesh position={[0, 0.32, 0]} castShadow {...m({ color: '#4b5a6b', metalness: 0.8, roughness: 0.35 })}>
        <cylinderGeometry args={[0.055, 0.07, 0.75, 8]} />
      </mesh>
      {/* Prongs buried into the slope material */}
      {[-0.09, 0, 0.09].map((x, i) => (
        <mesh key={i} position={[x, 0.12, 0]} castShadow {...m({ color: '#94a3b8', metalness: 0.9, roughness: 0.25 })}>
          <boxGeometry args={[0.028, 0.5, 0.028]} />
        </mesh>
      ))}
    </group>
  );
}

function CameraModel({ ghost }: { ghost?: boolean }) {
  const m = useMat(ghost);
  const groupRef = useRef<THREE.Group>(null);
  const [frustumVisible, setFrustumVisible] = useState(false);

  useEffect(() => {
    if (groupRef.current) {
      const target = new THREE.Vector3(0, -6, 0);
      groupRef.current.lookAt(target);
    }
  }, []);

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); setFrustumVisible(true); }}
      onPointerOut={() => setFrustumVisible(false)}
    >
      <group ref={groupRef}>
        {frustumVisible && !ghost && (
          <mesh position={[0, 1.1, 11]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[6, 22, 20, 1, true]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.07}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        )}
        {/* Camera head inside rotated group so cone follows sightline */}
        <group position={[0, 1.1, 0]}>
          <mesh castShadow {...m({ color: '#475569', metalness: 0.7, roughness: 0.4 })}>
            <boxGeometry args={[0.5, 0.34, 0.34]} />
          </mesh>
          <mesh position={[0.28, 0, 0]} rotation={[0, 0, Math.PI / 2]} {...m({ color: '#1e293b', metalness: 0.85, roughness: 0.3 })}>
            <cylinderGeometry args={[0.11, 0.11, 0.3, 12]} />
          </mesh>
          <mesh position={[0.43, 0, 0]} {...m({ color: '#67e8f9', emissive: '#22d3ee', emissiveIntensity: 1.4 })}>
            <sphereGeometry args={[0.075, 10, 10]} />
          </mesh>
        </group>
      </group>
      <mesh position={[0, 0.95, 0]} castShadow {...m({ color: '#8fa3b8', metalness: 0.85, roughness: 0.3 })}>
        <cylinderGeometry args={[0.05, 0.08, 1.9, 8]} />
      </mesh>
      <mesh position={[0.2, 1.95, 0]} {...m({ color: '#94a3b8', metalness: 0.9 })}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
      </mesh>
    </group>
  );
}

function WeatherStation({ ghost }: { ghost?: boolean }) {
  const m = useMat(ghost);
  const spinRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (spinRef.current) spinRef.current.rotation.y = s.clock.getElapsedTime() * 1.6;
  });
  return (
    <group>
      <mesh position={[0, 1.5, 0]} castShadow {...m({ color: '#8fa3b8', metalness: 0.85, roughness: 0.3 })}>
        <cylinderGeometry args={[0.05, 0.09, 3.0, 8]} />
      </mesh>
      <group position={[0, 2.6, 0]}>
        <mesh {...m({ color: '#64748b', metalness: 0.8 })}>
          <boxGeometry args={[0.06, 0.06, 0.06]} />
        </mesh>
        {[0, 1, 2].map(i => (
          <mesh key={i} rotation={[0, (i / 3) * Math.PI * 2, 0]} position={[0, 0, 0.42]} {...m({ color: '#cbd5e1', metalness: 0.9, roughness: 0.3 })}>
            <cylinderGeometry args={[0.025, 0.025, 0.05, 6]} />
          </mesh>
        ))}
        <mesh position={[0, 0.1, 0]} {...m({ color: '#94a3b8', metalness: 0.9 })}>
          <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
        </mesh>
      </group>
      <group ref={spinRef} position={[0, 2.95, 0]}>
        {[0, Math.PI / 2].map((a, i) => (
          <mesh key={i} rotation={[0, a, 0]} position={[0.55, 0, 0]} {...m({ color: '#e2e8f0', metalness: 0.9, roughness: 0.2 })}>
            <sphereGeometry args={[0.09, 8, 8]} />
          </mesh>
        ))}
        <mesh {...m({ color: '#64748b', metalness: 0.8 })}>
            <cylinderGeometry args={[0.02, 0.02, 0.24, 6]} />
        </mesh>
      </group>
    </group>
  );
}

function GatewayModel({ ghost }: { ghost?: boolean }) {
  const m = useMat(ghost);
  const beaconRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    if (beaconRef.current) {
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + Math.sin(t * 2.4) * 1.3;
    }
  });
  return (
    <group>
      <mesh position={[0, 3.05, 0]} castShadow {...m({ color: '#5b6b80', metalness: 0.85, roughness: 0.3 })}>
        <cylinderGeometry args={[0.14, 0.5, 6.1, 10]} />
      </mesh>
      {[0.5, 1.5, 2.5, 3.5].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[0, 0, Math.PI / 4]} {...m({ color: '#5b6b80', metalness: 0.9 })}>
          <boxGeometry args={[1.35 - i * 0.22, 0.05, 0.05]} />
        </mesh>
      ))}
      <mesh position={[0, 6.35, 0]} rotation={[0, Math.PI / 2, 0]} {...m({ color: '#94a3b8', metalness: 0.65, roughness: 0.35 })}>
        <cylinderGeometry args={[1.35, 1.35, 0.22, 18, 1, false, 0, Math.PI * 0.72]} />
      </mesh>
      <mesh position={[0, 6.32, -1.1]} {...m({ color: '#67e8f9', emissive: '#22d3ee', emissiveIntensity: 1.8 })}>
        <sphereGeometry args={[0.14, 10, 10]} />
      </mesh>
      <mesh ref={beaconRef} position={[0, 6.72, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} {...m({})} />
      </mesh>
    </group>
  );
}

function RelayNode({ ghost }: { ghost?: boolean }) {
  const m = useMat(ghost);
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + Math.sin(t * 3.2) * 0.12);
    }
  });
  return (
    <group>
      <mesh position={[0, 1.0, 0]} castShadow {...m({ color: '#5f5278', metalness: 0.85, roughness: 0.3 })}>
        <cylinderGeometry args={[0.05, 0.1, 2.0, 8]} />
      </mesh>
      <mesh position={[0, 1.75, 0]} {...m({ color: '#8b7cb8', metalness: 0.7, roughness: 0.35 })}>
        <boxGeometry args={[0.4, 0.22, 0.4]} />
      </mesh>
      <mesh ref={ringRef} position={[0, 2.05, 0]} rotation={[-Math.PI / 2, 0, 0]} {...m({ color: '#a78bfa', emissive: '#a78bfa', emissiveIntensity: 1.6 })}>
        <torusGeometry args={[0.16, 0.035, 8, 20]} />
      </mesh>
    </group>
  );
}

function Siren({ ghost }: { ghost?: boolean }) {
  const m = useMat(ghost);
  const lightRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    if (lightRef.current) {
      (lightRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + (Math.sin(t * 4.2) + 1) * 1.1;
    }
  });
  return (
    <group>
      <mesh position={[0, 1.15, 0]} castShadow {...m({ color: '#6b7a8e', metalness: 0.85, roughness: 0.3 })}>
        <cylinderGeometry args={[0.06, 0.1, 2.3, 8]} />
      </mesh>
      <mesh position={[0, 2.05, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow {...m({ color: '#ef4444', metalness: 0.4, roughness: 0.5, emissive: '#ef4444', emissiveIntensity: 0.4 })}>
        <cylinderGeometry args={[0.42, 0.3, 0.5, 14, 1, false, Math.PI / 4, Math.PI * 1.5]} />
      </mesh>
      <mesh ref={lightRef} position={[0, 2.42, 0]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.5} {...m({})} />
      </mesh>
      <mesh position={[0.3, 0.55, 0]} rotation={[0, 0, -Math.PI / 3]} {...m({ color: '#94a3b8', metalness: 0.9 })}>
        <cylinderGeometry args={[0.03, 0.03, 0.6, 6]} />
      </mesh>
    </group>
  );
}
