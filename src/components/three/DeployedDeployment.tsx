import { useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useDeployment } from '../../store/designerStore';
import { COMPONENT_SPECS } from '../../data/designerCatalog';
import { benchLabel } from '../../utils/terrain';
import { makeGlowTexture } from './glow';
import { ModelBody } from '../designer/DesignerObject3D';

/**
 * Renders the deployment serialized by the Mine Designer inside the live
 * Digital Twin scene. The twin loads EXACTLY the designed scene: the same
 * terrain, the same hardware models, positions, IDs, labels, yaw and
 * communication links.
 */
export function DeployedDeployment() {
  const deployed = useDeployment(s => s.deployed);
  const objects = useDeployment(s => s.objects);
  const links = useDeployment(s => s.links);
  const glow = makeGlowTexture();

  const byId = useMemo(() => new Map(objects.map(o => [o.id, o])), [objects]);

  if (!deployed || objects.length === 0) return null;

  return (
    <group>
      {objects.map(o => {
        const spec = COMPONENT_SPECS[o.type];
        return (
          <DeployedNode
            key={o.id}
            id={o.id}
            name={o.name}
            bench={o.bench}
            type={o.type}
            yaw={o.yaw}
            color={spec.color}
            position={[o.position.x, o.position.y, o.position.z]}
            glow={glow}
          />
        );
      })}

      {links.map(l => {
        const a = byId.get(l.from);
        const b = byId.get(l.to);
        if (!a || !b) return null;
        return (
          <line key={l.id}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([
                    a.position.x, a.position.y + 0.5, a.position.z,
                    b.position.x, b.position.y + 0.5, b.position.z,
                  ]),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#22d3ee" transparent opacity={0.28} depthWrite={false} />
          </line>
        );
      })}
    </group>
  );
}

function DeployedNode({
  id, name, bench, type, yaw, color, position, glow,
}: {
  id: string;
  name: string;
  bench: number;
  type: Parameters<typeof ModelBody>[0]['type'];
  yaw: number;
  color: string;
  position: [number, number, number];
  glow: THREE.Texture;
}) {
  const [hovered, setHovered] = useState(false);
  const spec = COMPONENT_SPECS[type];

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* Ground plate keeps the model seated on the terrain */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[type === 'gateway' ? 1.1 : 0.62, type === 'gateway' ? 1.3 : 0.78, 0.12, 16]} />
        <meshStandardMaterial color="#121a28" metalness={0.7} roughness={0.45} />
      </mesh>

      {/* The exact hardware model from the Mine Designer */}
      <ModelBody type={type} />

      <sprite position={[0, spec.baseHeight * 0.95, 0]} scale={[2.3, 2.3, 1]}>
        <spriteMaterial map={glow} color={color} transparent opacity={hovered ? 0.75 : 0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* Hover ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.42, 0.6, 24]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.5 : 0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <mesh
        position={[0, spec.baseHeight * 0.45, 0]}
        onClick={(e) => e.stopPropagation()}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <cylinderGeometry args={[0.9, 0.95, spec.baseHeight, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {hovered && (
        <Html position={[0, spec.baseHeight + 0.8, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="glass-panel px-2 py-1 whitespace-nowrap" style={{ borderColor: `${color}55` }}>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-display font-bold text-white">{id}</span>
              <span className="text-[7.5px] text-slate-400">{benchLabel(bench)}</span>
            </div>
            <div className="text-[7.5px] font-mono" style={{ color }}>{name.toUpperCase()}</div>
          </div>
        </Html>
      )}
    </group>
  );
}
