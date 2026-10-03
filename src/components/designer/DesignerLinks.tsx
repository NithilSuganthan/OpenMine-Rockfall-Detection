import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { DesignerLink, DesignerObject } from '../../data/designerTypes';
import { useDesigner } from '../../store/designerStore';
import { liftedMidpoint } from '../../utils/terrain';

interface Props {
  objects: DesignerObject[];
  links: DesignerLink[];
  interactive?: boolean;
  preview?: boolean;
  faultedId?: string | null;
}

const LINK_MESH = '#a78bfa';
const LINK_BACKBONE = '#22d3ee';
const LINK_FAULT = '#f97316';

export function DesignerLinks({ objects, links, interactive, preview, faultedId }: Props) {
  const hoveredLinkId = useDesigner(s => s.hoveredLinkId);
  const linkPendingId = useDesigner(s => s.linkPendingId);
  const setHoveredLink = useDesigner(s => s.setHoveredLink);
  const clickLink = useDesigner(s => s.clickLink);
  const byId = useMemo(() => new Map(objects.map(o => [o.id, o])), [objects]);

  return (
    <group>
      {links.map(link => {
        const a = byId.get(link.from);
        const b = byId.get(link.to);
        if (!a || !b) return null;
        const active = !(faultedId && (faultedId === link.from || faultedId === link.to));
        const isHovered = hoveredLinkId === link.id;
        const isPending = linkPendingId === link.id;
        const mid = liftedMidpoint(a.position, b.position);
        // LoRa mesh roles: relay/gateway hops are the mesh backbone
        const backbone = a.type === 'gateway' || b.type === 'gateway';

        return (
          <LinkTube
            key={link.id}
            link={link}
            from={a.position}
            to={b.position}
            mid={mid}
            isHovered={isHovered}
            isPending={isPending}
            isFaulted={!active}
            backbone={backbone}
            pendingLinkId={linkPendingId}
            interactive={interactive}
            onHover={setHoveredLink}
            onClick={() => clickLink(link.id)}
          >
            {preview && <Packets from={a.position} to={b.position} mid={mid} speed={active ? 0.9 : 2.2} color={active ? (backbone ? '#7dd3fc' : '#c4b5fd') : LINK_FAULT} />}
          </LinkTube>
        );
      })}
    </group>
  );
}

function LinkTube({
  link, from, to, mid, isHovered, isPending, isFaulted, backbone, pendingLinkId, interactive, onHover, onClick, children,
}: {
  link: DesignerLink;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  mid: { x: number; y: number; z: number };
  isHovered: boolean;
  isPending: boolean;
  isFaulted: boolean;
  backbone: boolean;
  pendingLinkId: string | null;
  interactive?: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  const curve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(mid.x, mid.y, mid.z),
      new THREE.Vector3(to.x, to.y, to.z),
    );
  }, [from, to, mid]);

  const tube = useMemo(() => {
    const points = curve.getPoints(24);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [curve]);

  const glowTube = useMemo(() => {
    return new THREE.TubeGeometry(curve, 18, 0.07, 6, false);
  }, [curve]);

  const color = isPending ? '#22d3ee' : isFaulted ? LINK_FAULT : isHovered ? '#e0f2fe' : backbone ? LINK_BACKBONE : LINK_MESH;

  return (
    <group>
      {/* Glowing underlay (additive) */}
      <mesh geometry={glowTube}>
        <meshBasicMaterial color={color} transparent opacity={isFaulted ? 0.12 : 0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Visual line */}
      <LineGeometryMesh points={tube} color={color} opacity={isFaulted ? 0.55 : isHovered ? 0.95 : 0.75} pending={isPending} />
      {/* Fat invisible hit-target */}
      {interactive && (
        <mesh
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onPointerOver={(e) => { e.stopPropagation(); onHover(link.id); }}
          onPointerOut={() => onHover(null)}
        >
          <tubeGeometry args={[curve, 12, 0.55, 6, false]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {/* Latency tooltip */}
      {isHovered && (
        <Html position={[mid.x, mid.y + 0.5, mid.z]} center style={{ pointerEvents: 'none' }}>
          <div className="glass-panel px-2.5 py-1.5 whitespace-nowrap"
            style={{ borderColor: 'rgba(125,211,252,0.4)', boxShadow: '0 0 16px rgba(56,189,248,0.25)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-cyan-200">{link.from}</span>
              <span className="text-[8px] text-slate-500">↔</span>
              <span className="text-[10px] font-mono font-bold text-cyan-200">{link.to}</span>
            </div>
            <div className="text-[8px] font-mono text-slate-400 mt-0.5">
              LATENCY {link.latency} ms · {backbone ? 'BACKBONE' : link.kind.toUpperCase()}
            </div>
            {interactive && (
              <div className="text-[7.5px] font-mono text-cyan-400/80 mt-0.5">
                {pendingLinkId === link.id ? 'CLICK TO REMOVE' : 'CLICK TO SELECT'}
              </div>
            )}
          </div>
        </Html>
      )}
      {children}
    </group>
  );
}

function LineGeometryMesh({ points, color, opacity, pending }: {
  points: THREE.BufferGeometry; color: string; opacity: number; pending: boolean;
}) {
  const line = useMemo(() => {
    const l = new THREE.Line(
      points,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
    l.frustumCulled = false;
    return l;
  }, [points]);

  const ref = useRef<THREE.Line>(null);
  useEffect(() => {
    if (ref.current) {
      const mat = ref.current.material as THREE.LineBasicMaterial;
      mat.color.set(color);
      mat.opacity = opacity;
    }
  }, [color, opacity]);

  useFrame((state) => {
    if (ref.current && pending) {
      const mat = ref.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.3 + Math.abs(Math.sin(state.clock.getElapsedTime() * 5)) * 0.6;
    }
  });

  return <primitive object={line} ref={ref} />;
}

/* ─── Animated data packets along links during preview ──────────────────── */

function Packets({ from, to, mid, speed, color }: {
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  mid: { x: number; y: number; z: number };
  speed: number;
  color: string;
}) {
  const curve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(mid.x, mid.y, mid.z),
      new THREE.Vector3(to.x, to.y, to.z),
    );
  }, [from, to, mid]);

  return (
    <group>
      {[0, 1, 2].map(i => (
        <PacketParticle key={i} curve={curve} offset={i / 3} speed={speed} color={color} />
      ))}
    </group>
  );
}

function PacketParticle({ curve, offset, speed, color }: {
  curve: THREE.QuadraticBezierCurve3;
  offset: number;
  speed: number;
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = (state.clock.getElapsedTime() * speed + offset) % 1;
    const pt = curve.getPoint(t);
    meshRef.current.position.copy(pt);
    const s = 0.09 + Math.sin(state.clock.getElapsedTime() * 9 + offset * 9) * 0.03;
    meshRef.current.scale.setScalar(Math.max(0.06, s));
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}
