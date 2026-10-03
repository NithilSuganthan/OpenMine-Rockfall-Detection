import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO, SMAA, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { PitTerrain, PIT_SCALE } from '../three/PitTerrain';
import { HDRIEnvironment } from '../three/environment';
import { DesignerObject3D } from './DesignerObject3D';
import { DesignerLinks } from './DesignerLinks';
import { CoverageOverlay, CoverageRings } from './CoverageOverlay';
import { ValidationMarkers } from './ValidationMarker3D';
import { useDesigner } from '../../store/designerStore';
import type { ViewPreset } from '../../store/designerStore';
import type { DesignerObject, DesignerTool, DesignerVector3, Measurement } from '../../data/designerTypes';
import { COMPONENT_SPECS } from '../../data/designerCatalog';
import { isPlacementTool } from '../../data/designerTypes';
import { clampToMine, dist3, snapToTerrain } from '../../utils/terrain';
import { benchLabel } from '../../utils/terrain';
import { benchOuterRadius, benchY } from '../../data/types';
import { pitHeightAt } from '../three/terrainField';
import { makeGlowTexture } from '../three/glow';

/** Shared pointer bus — mutable, no React state, used by frame loops. */
export const pointerBus = {
  world: new THREE.Vector3(0, 0, 0),
  down: { x: 0, y: 0 } as { x: number; y: number } | null,
  markDown(e: PointerEvent) {
    pointerBus.down = { x: e.clientX, y: e.clientY };
  },
  movedSinceDown(e: PointerEvent | MouseEvent): boolean {
    if (!pointerBus.down) return true;
    const d = Math.hypot(e.clientX - pointerBus.down.x, e.clientY - pointerBus.down.y);
    return d > 6;
  },
};

const sceneRefs = {
  camera: null as THREE.Camera | null,
  dom: null as HTMLElement | null,
};

/**
 * The Mine Designer reuses the EXACT Digital Twin rendering pipeline:
 * PitTerrain (height field + PBR strata + haul road + wireframe grid),
 * HDRI sky, identical lighting/fog/post-processing and the same PIT_SCALE
 * world. The deployed twin is therefore an exact representation of the
 * designed scene.
 */
export function DesignerScene() {
  const objects = useDesigner(s => s.objects);
  const links = useDesigner(s => s.links);
  const selectedId = useDesigner(s => s.selectedId);
  const hoveredId = useDesigner(s => s.hoveredId);
  const linkFromId = useDesigner(s => s.linkFromId);
  const preview = useDesigner(s => s.preview);
  const previewFault = useDesigner(s => s.previewFault);
  const clickObject = useDesigner(s => s.clickObject);
  const setHovered = useDesigner(s => s.setHovered);
  const selectObject = useDesigner(s => s.selectObject);

  const connectedIds = useMemo(() => {
    if (!hoveredId) return new Set<string>();
    const set = new Set<string>();
    links.forEach(l => {
      if (l.from === hoveredId || l.to === hoveredId) {
        set.add(l.from);
        set.add(l.to);
      }
    });
    return set;
  }, [hoveredId, links]);

  return (
    <Canvas
      shadows
      camera={{ position: [84, 80, 98], fov: 46, near: 0.1, far: 700 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.75]}
      onPointerMissed={handleCanvasMissed}
      style={{ background: 'transparent' }}
    >
      {/* ─── LIGHTING: identical to the Digital Twin ─── */}
      <HDRIEnvironment />
      <ambientLight intensity={0.25} />
      <hemisphereLight args={['#8fa4bd', '#262b31', 0.45]} />
      <directionalLight
        position={[70, 120, 50]}
        intensity={2.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-camera-near={5}
        shadow-camera-far={380}
      />
      <directionalLight position={[-90, 70, -70]} intensity={0.5} color="#9db8d2" />
      <fog attach="fog" args={['#5f7080', 150, 520]} />

      {/* ─── SCALED WORLD: same terrain scale as the twin ─── */}
      <group scale={PIT_SCALE}>
        <PitTerrain />

        {objects.map(o => (
          <DesignerObject3D
            key={o.id}
            object={o}
            isSelected={selectedId === o.id}
            isHovered={hoveredId === o.id}
            highlight={connectedIds.has(o.id)}
            preview={preview}
            onClick={() => clickObject(o.id)}
            onDoubleClick={() => selectObject(o.id, true)}
            onHover={setHovered}
          />
        ))}

        <DesignerLinks
          objects={objects}
          links={links}
          interactive
          preview={preview}
          faultedId={previewFault}
        />

        {linkFromId && <PendingLinkLine fromId={linkFromId} />}

        <GhostPreview />

        {/* Always-on LoRa mesh coverage radii (gateway + relay) */}
        <CoverageRings objects={objects} />

        {preview && <CoverageOverlay objects={objects} />}

        <ValidationOverlay />

        <MeasureOverlay />

        <PlacementController />
        <TransformController />
        <TransformGhost />
        <FaultSimulator />
        <CameraFocusRig />
        <CameraPresetRig />
      </group>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        minDistance={18}
        maxDistance={280}
        maxPolarAngle={1.52}
        target={[0, -7, 0]}
      />

      {/* ─── POST PROCESSING: same as the Digital Twin ─── */}
      <EffectComposer multisampling={0}>
        <N8AO intensity={2.2} aoRadius={6} distanceFalloff={1.4} halfRes color="#05070b" />
        <Bloom intensity={0.65} luminanceThreshold={1} luminanceSmoothing={0.25} mipmapBlur radius={0.72} />
        <SMAA />
        <Vignette offset={0.18} darkness={0.5} />
      </EffectComposer>
    </Canvas>
  );
}

/* ─── Ghost preview while dragging / in placement mode ──────────────────── */

function GhostPreview() {
  const tool = useDesigner(s => s.tool);
  const dragType = useDesigner(s => s.dragType);
  const ghostPosition = useDesigner(s => s.ghostPosition);
  const objects = useDesigner(s => s.objects);

  const type = (dragType ?? (isPlacementTool(tool) ? tool : null)) as DesignerObject['type'] | null;
  if (!type || !ghostPosition) return null;

  const snap = snapToTerrain(ghostPosition.x, ghostPosition.z, false);
  const ghostObject: DesignerObject = {
    id: 'ghost',
    name: COMPONENT_SPECS[type].label,
    type,
    position: snap.position,
    bench: snap.bench,
    yaw: 0,
    status: 'planned',
    battery: 100,
    samplingRate: COMPONENT_SPECS[type].defaultRate,
    commGateway: null,
  };

  return (
    <>
      <PlacementAssist
        position={snap.position}
        bench={snap.bench}
        outOfBounds={snap.outOfBounds}
        type={type}
        objects={objects}
      />
      <DesignerObject3D
        object={ghostObject}
        isSelected={false}
        isHovered={false}
        ghost
        isInvalid={snap.outOfBounds}
        onClick={() => {}}
        onDoubleClick={() => {}}
        onHover={() => {}}
      />
    </>
  );
}

/* ─── CAD placement assist: validity ring, snap indicator, coverage radius,
       distance ruler and nearest-bench highlight ───────────────────────── */

function PlacementAssist({
  position, bench, outOfBounds, type, objects,
}: {
  position: DesignerVector3;
  bench: number;
  outOfBounds: boolean;
  type: DesignerObject['type'];
  objects: DesignerObject[];
}) {
  const spec = COMPONENT_SPECS[type];
  const valid = !outOfBounds;
  const glow = makeGlowTexture();

  const nearest = useMemo(() => {
    let best: DesignerObject | null = null;
    let bestD = Infinity;
    for (const o of objects) {
      const d = Math.hypot(o.position.x - position.x, o.position.z - position.z);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best && bestD < 60 ? { obj: best, d: bestD } : null;
  }, [objects, position]);

  return (
    <group>
      {/* Big placement ring — green valid / red invalid, pulsing */}
      <PulseRing
        position={[position.x, position.y + 0.12, position.z]}
        radius={valid ? 1.7 : 2.1}
        color={valid ? '#22c55e' : '#ef4444'}
        opacity={valid ? 0.85 : 0.95}
      />

      {/* Coverage radius while dragging (sensing components only) */}
      {spec.coverageRadius > 0 && (
        <PulseRing
          position={[position.x, position.y + 0.12, position.z]}
          radius={spec.coverageRadius}
          color={valid ? '#38bdf8' : '#ef4444'}
          opacity={0.12}
          slow
        />
      )}

      {/* Snap indicator — stake to the ground + bench tag */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([position.x, position.y, position.z, position.x, position.y + 1.4, position.z]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={valid ? '#4ade80' : '#f87171'} transparent opacity={0.65} depthWrite={false} />
      </line>
      <mesh position={[position.x, position.y + 1.45, position.z]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshBasicMaterial color={valid ? '#4ade80' : '#f87171'} />
      </mesh>
      <sprite position={[position.x, position.y + 1.5, position.z]} scale={[0.9, 0.9, 1]}>
        <spriteMaterial map={glow} color={valid ? '#22c55e' : '#ef4444'} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <Html position={[position.x, position.y + 1.9, position.z]} center style={{ pointerEvents: 'none' }}>
        <div className="glass-panel px-2 py-1 whitespace-nowrap" style={{ borderColor: valid ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.55)' }}>
          <span className={`text-[8px] font-mono font-bold ${valid ? 'text-green-300' : 'text-red-300'}`}>
            {outOfBounds ? 'OUT OF BOUNDS' : benchLabel(bench).toUpperCase()}
          </span>
          {!outOfBounds && <span className="ml-1.5 text-[7.5px] font-mono text-slate-400">SNAP ✓</span>}
        </div>
      </Html>

      {/* Distance ruler to the nearest placed object */}
      {nearest && (
        <DistanceRuler from={position} to={nearest.obj.position} distance={nearest.d} targetId={nearest.obj.id} />
      )}

      {/* Nearest bench highlight band */}
      {bench >= 0 && (
        <mesh position={[0, benchY(bench) + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[benchOuterRadius(bench + 1), benchOuterRadius(bench), 96]} />
          <meshBasicMaterial
            color="#22d3ee"
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}

function PulseRing({ position, radius, color, opacity, slow }: {
  position: [number, number, number];
  radius: number;
  color: string;
  opacity: number;
  slow?: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const s = 1 + Math.sin(t * (slow ? 1.1 : 2.2)) * (slow ? 0.02 : 0.05);
    ref.current.scale.set(s, 1, s);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = opacity + Math.sin(t * (slow ? 1.1 : 2.6)) * (slow ? 0.02 : 0.08);
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.94, radius, 64]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function DistanceRuler({ from, to, distance, targetId }: {
  from: DesignerVector3;
  to: DesignerVector3;
  distance: number;
  targetId: string;
}) {
  const mid = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2 + Math.min(4, distance * 0.04) + 1.2,
    z: (from.z + to.z) / 2,
  };
  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([from.x, from.y + 0.4, from.z, to.x, to.y + 0.4, to.z]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#22d3ee" transparent opacity={0.55} depthWrite={false} />
      </line>
      <Dot position={[from.x, from.y + 0.4, from.z]} color="#22d3ee" />
      <Dot position={[to.x, to.y + 0.4, to.z]} color="#22d3ee" />
      <Html position={[mid.x, mid.y, mid.z]} center style={{ pointerEvents: 'none' }}>
        <div className="glass-panel px-2 py-1 whitespace-nowrap" style={{ borderColor: 'rgba(34,211,238,0.4)' }}>
          <div className="text-[9px] font-mono font-bold text-cyan-200">{distance.toFixed(1)} m</div>
          <div className="text-[7px] font-mono text-slate-500">→ {targetId}</div>
        </div>
      </Html>
    </group>
  );
}

function Dot({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.16, 12, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
}

/* ─── Move / rotate transform (CAD) ─────────────────────────────────────── */

function TransformController() {
  const gl = useThree(s => s.gl);
  const camera = useThree(s => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    sceneRefs.camera = camera;
    sceneRefs.dom = el;

    const onMove = (e: PointerEvent) => {
      const s = useDesigner.getState();
      if (!s.transform) return;
      const pt = projectPointer(e.clientX, e.clientY);
      if (!pt) return;
      s.setTransformTarget({ x: pt.x, y: pt.y, z: pt.z });
    };

    const onDown = (e: PointerEvent) => pointerBus.markDown(e);

    const onUp = (e: PointerEvent) => {
      const s = useDesigner.getState();
      if (s.transform && pointerBus.movedSinceDown(e)) s.commitTransform();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
  }, [gl, camera]);

  return null;
}

function TransformGhost() {
  const transform = useDesigner(s => s.transform);
  const target = useDesigner(s => s.transformTarget);
  const objects = useDesigner(s => s.objects);

  if (!transform || !target) return null;
  const obj = objects.find(o => o.id === transform.id);
  if (!obj) return null;

  if (transform.mode === 'move') {
    const snap = snapToTerrain(target.x, target.z, false);
    const ghostObj: DesignerObject = { ...obj, position: snap.position, bench: snap.bench };
    return (
      <>
        <PlacementAssist
          position={snap.position}
          bench={snap.bench}
          outOfBounds={snap.outOfBounds}
          type={obj.type}
          objects={objects.filter(o => o.id !== obj.id)}
        />
        <DesignerObject3D
          object={ghostObj}
          isSelected
          isHovered={false}
          ghost
          isInvalid={snap.outOfBounds}
          onClick={() => {}}
          onDoubleClick={() => {}}
          onHover={() => {}}
        />
      </>
    );
  }

  const yaw = Math.atan2(target.x - obj.position.x, target.z - obj.position.z);
  return (
    <>
      <RotateIndicator position={obj.position} yaw={yaw} color={COMPONENT_SPECS[obj.type].color} />
      <DesignerObject3D
        object={obj}
        isSelected
        isHovered={false}
        ghost
        overrideYaw={yaw}
        onClick={() => {}}
        onDoubleClick={() => {}}
        onHover={() => {}}
      />
    </>
  );
}

function RotateIndicator({ position, yaw, color }: {
  position: DesignerVector3;
  yaw: number;
  color: string;
}) {
  return (
    <group position={[position.x, position.y + 0.12, position.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.0, 2.18, 72]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[Math.sin(yaw) * 2.09, 0.04, Math.cos(yaw) * 2.09]} rotation={[0, yaw, 0]}>
        <boxGeometry args={[0.09, 0.04, 0.42]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <Html position={[0, 0.7, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="glass-panel px-2 py-1 whitespace-nowrap" style={{ borderColor: `${color}55` }}>
          <span className="text-[9px] font-mono font-bold" style={{ color }}>
            ROT {((yaw * 180) / Math.PI).toFixed(0)}°
          </span>
        </div>
      </Html>
    </group>
  );
}

/* ─── Placement / pointer controllers ───────────────────────────────────── */

/**
 * Fired by the Canvas whenever a pointer-up hits no object. This is where
 * terrain actions happen (place, measure, link-cancel, transform commit).
 */
function handleCanvasMissed(e: MouseEvent) {
  const s = useDesigner.getState();
  if (s.transform) {
    s.commitTransform();
    return;
  }
  if (pointerBus.movedSinceDown(e)) return;

  const pt = projectPointer(e.clientX, e.clientY);
  if (!pt) return;
  const pos: DesignerVector3 = { x: pt.x, y: pt.y, z: pt.z };

  if (s.dragType || isPlacementTool(s.tool)) {
    s.placeObject(pos);
  } else if (s.tool === 'measure') {
    s.addMeasurePoint(pos);
  } else if (s.tool === 'connect') {
    s.cancelLinkPending();
  } else if (s.tool === 'select') {
    s.selectObject(null);
  }
}

function PlacementController() {
  const gl = useThree(s => s.gl);
  const camera = useThree(s => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    sceneRefs.camera = camera;
    sceneRefs.dom = el;

    const onMove = (e: PointerEvent) => {
      const pt = projectPointer(e.clientX, e.clientY);
      if (!pt) return;
      pointerBus.world.copy(pt);
      const s = useDesigner.getState();
      if (s.dragType || isPlacementTool(s.tool)) {
        s.setGhostPosition({ x: pt.x, y: pt.y, z: pt.z });
      }
    };

    const onDragOver = (e: DragEvent) => {
      const s = useDesigner.getState();
      if (!s.dragType) return;
      e.preventDefault();
      const pt = projectPointer(e.clientX, e.clientY);
      if (!pt) return;
      pointerBus.world.copy(pt);
      s.setGhostPosition({ x: pt.x, y: pt.y, z: pt.z });
    };

    const onDrop = (e: DragEvent) => {
      const s = useDesigner.getState();
      if (!s.dragType) return;
      e.preventDefault();
      const pt = projectPointer(e.clientX, e.clientY);
      if (!pt) return;
      s.placeObject({ x: pt.x, y: pt.y, z: pt.z });
    };

    const onDragLeave = () => {
      useDesigner.getState().setGhostPosition(null);
    };

    el.addEventListener('pointerdown', pointerBus.markDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    el.addEventListener('dragleave', onDragLeave);

    return () => {
      el.removeEventListener('pointerdown', pointerBus.markDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
      el.removeEventListener('dragleave', onDragLeave);
    };
  }, [gl, camera]);

  return null;
}

/** Project a client-space point onto the Digital Twin terrain surface. */
function projectPointer(clientX: number, clientY: number): THREE.Vector3 | null {
  const el = sceneRefs.dom;
  const camera = sceneRefs.camera;
  if (!el || !camera) return null;
  const rect = el.getBoundingClientRect();
  const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const worldPt = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, worldPt)) return null;
  // Un-scale from the PIT_SCALE world back into design coordinates
  const sx = worldPt.x / PIT_SCALE;
  const sz = worldPt.z / PIT_SCALE;
  const clamped = clampToMine(sx, sz);
  const y = pitHeightAt(clamped.x, clamped.z);
  return new THREE.Vector3(clamped.x, y, clamped.z);
}

/* ─── Pending connection line while linking ─────────────────────────────── */

function PendingLinkLine({ fromId }: { fromId: string }) {
  const from = useDesigner(s => s.objects.find(o => o.id === fromId));
  const lineRef = useRef<THREE.Line>(null);

  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.6, depthWrite: false }));
    l.frustumCulled = false;
    return l;
  }, []);

  useFrame(() => {
    const l = lineRef.current;
    if (!l || !from) return;
    const p = pointerBus.world;
    const y = pitHeightAt(p.x, p.z);
    const mid = {
      x: (from.position.x + p.x) / 2,
      y: (from.position.y + y) / 2 + Math.min(4, Math.hypot(from.position.x - p.x, from.position.z - p.z) * 0.04) + 0.8,
      z: (from.position.z + p.z) / 2,
    };
    const attr = l.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.setXYZ(0, from.position.x, from.position.y + 0.5, from.position.z);
    attr.setXYZ(1, mid.x, mid.y, mid.z);
    attr.setXYZ(2, p.x, y + 0.5, p.z);
    attr.needsUpdate = true;
  });

  if (!from) return null;
  return <primitive object={line} ref={lineRef} />;
}

/* ─── Measure overlay ───────────────────────────────────────────────────── */

function MeasureOverlay() {
  const measureFrom = useDesigner(s => s.measureFrom);
  const measurement = useDesigner(s => s.measurement);

  return (
    <group>
      {measureFrom && <PendingMeasureLine from={measureFrom} />}
      {measurement && <FinalMeasureLine measurement={measurement} />}
    </group>
  );
}

function PendingMeasureLine({ from }: { from: DesignerVector3 }) {
  const lineRef = useRef<THREE.Line>(null);

  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.5, depthWrite: false }));
    l.frustumCulled = false;
    return l;
  }, []);

  useFrame(() => {
    const l = lineRef.current;
    if (!l) return;
    const p = pointerBus.world;
    const y = pitHeightAt(p.x, p.z);
    const attr = l.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.setXYZ(0, from.x, from.y + 0.4, from.z);
    attr.setXYZ(1, p.x, y + 0.4, p.z);
    attr.needsUpdate = true;
  });

  return (
    <group>
      <Dot position={[from.x, from.y + 0.4, from.z]} color="#38bdf8" />
      <primitive object={line} ref={lineRef} />
    </group>
  );
}

function FinalMeasureLine({ measurement }: { measurement: Measurement }) {
  const { from, to, distance, deltaY } = measurement;
  const mid = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2 + Math.min(4, distance * 0.04) + 1.1,
    z: (from.z + to.z) / 2,
  };

  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(
      new Float32Array([from.x, from.y + 0.4, from.z, to.x, to.y + 0.4, to.z]), 3,
    ));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.7, depthWrite: false }));
  }, [from, to]);

  return (
    <group>
      <Dot position={[from.x, from.y + 0.4, from.z]} color="#38bdf8" />
      <Dot position={[to.x, to.y + 0.4, to.z]} color="#38bdf8" />
      <primitive object={line} />
      <Html position={[mid.x, mid.y, mid.z]} center style={{ pointerEvents: 'none' }}>
        <div className="glass-panel px-2.5 py-1.5 whitespace-nowrap" style={{ borderColor: 'rgba(56,189,248,0.4)' }}>
          <div className="text-[10px] font-mono font-bold text-cyan-200">{distance.toFixed(1)} m</div>
          <div className="text-[8px] font-mono text-slate-400">
            ΔY {deltaY >= 0 ? '+' : ''}{deltaY.toFixed(1)} m
          </div>
        </div>
      </Html>
    </group>
  );
}

/* ─── Validation markers (isolated subscription) ────────────────────────── */

function ValidationOverlay() {
  const validation = useDesigner(s => s.validation);
  if (!validation) return null;
  return <ValidationMarkers issues={validation.issues} />;
}

/* ─── Preview fault simulator (deterministic, no random) ────────────────── */

function FaultSimulator() {
  const preview = useDesigner(s => s.preview);

  useEffect(() => {
    if (!preview) return;
    let cleared = 0;
    let cycle = 0;
    const iv = setInterval(() => {
      const s = useDesigner.getState();
      if (cycle % 2 === 0) {
        const candidates = s.objects.filter(o => o.type !== 'gateway');
        if (candidates.length > 0) {
          const victim = candidates[Math.floor(cycle / 2) % candidates.length];
          s.setPreviewFault(victim.id);
        }
        cleared = Date.now() + 2600;
      } else if (Date.now() > cleared) {
        s.setPreviewFault(null);
      }
      cycle++;
    }, 3000);
    return () => clearInterval(iv);
  }, [preview]);

  return null;
}

/* ─── Camera focus rig (double-click focus, frame selected) ─────────────── */

function CameraFocusRig() {
  const focusRequest = useDesigner(s => s.focusRequest);
  const controls = useThree(s => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const current = useRef(new THREE.Vector3(0, -7, 0));
  const desired = useRef(new THREE.Vector3(0, -7, 0));
  const lastNonce = useRef<number | null>(null);

  useFrame((_, dt) => {
    if (focusRequest && focusRequest.nonce !== lastNonce.current) {
      lastNonce.current = focusRequest.nonce;
      desired.current.set(
        focusRequest.position.x * PIT_SCALE,
        (focusRequest.position.y + 1) * PIT_SCALE,
        focusRequest.position.z * PIT_SCALE,
      );
    }
    current.current.lerp(desired.current, Math.min(1, dt * 2.4));
    if (controls) {
      controls.target.copy(current.current);
    }
  });

  return null;
}

/* ─── CAD camera presets: perspective / top / isometric ─────────────────── */

const CAMERA_PRESETS: Record<ViewPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  perspective: { pos: [100, 95, 118], target: [0, -7, 0] },
  top: { pos: [0, 175, 0.01], target: [0, -4, 0] },
  iso: { pos: [125, 98, 125], target: [0, -6, 0] },
};

function CameraPresetRig() {
  const viewPreset = useDesigner(s => s.viewPreset);
  const camera = useThree(s => s.camera);
  const controls = useThree(s => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const lastNonce = useRef<number | null>(null);

  useFrame((_, dt) => {
    if (!viewPreset || viewPreset.nonce === lastNonce.current) return;
    lastNonce.current = viewPreset.nonce;
    const preset = CAMERA_PRESETS[viewPreset.kind];
    camera.position.set(preset.pos[0], preset.pos[1], preset.pos[2]);
    if (controls) {
      controls.target.set(preset.target[0], preset.target[1], preset.target[2]);
      controls.update();
    }
    camera.lookAt(preset.target[0], preset.target[1], preset.target[2]);
  });

  return null;
}
