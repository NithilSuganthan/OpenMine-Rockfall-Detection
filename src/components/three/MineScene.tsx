import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO, SMAA, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useApp } from '../../store/AppContext';
import { PitTerrain, PIT_SCALE } from './PitTerrain';
import { HDRIEnvironment } from './environment';
import { pitHeightAt } from './terrainField';
import { SensorNode3D } from './SensorNode3D';
import { CommunicationLines } from './CommunicationLines';
import { HeatmapOverlay } from './HeatmapOverlay';
import { DroneModel } from './DroneModel';
import { RiskZone3D } from './RiskZone3D';
import { DeployedDeployment } from './DeployedDeployment';
import { GATEWAYS } from '../../utils/network';
import { lerp } from '../../utils/helpers';
import { makeGlowTexture } from './glow';

export function MineScene() {
  const {
    heatmapVisible, droneMode, displaySensors, zones, selectedSensor, selectedZone,
    selectSensor, selectZone, clearSelection, playback, autoRotate, showZoneLabels,
  } = useApp();

  const displayZones = useMemo(() => {
    if (!playback.enabled) return zones;
    const t = playback.position / 100;
    return zones.map(z => ({
      ...z,
      currentRisk: Math.round(lerp(z.historicalRisk, z.currentRisk, t)),
      historicalRisk: Math.round(lerp(z.historicalRisk, z.currentRisk, t) * 0.82),
    }));
  }, [zones, playback]);

  return (
    <Canvas
      shadows
      camera={{ position: [84, 80, 98], fov: 46, near: 0.1, far: 700 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.75]}
      onPointerMissed={clearSelection}
      style={{ background: 'transparent' }}
    >
      {/* ─── LIGHTING: HDRI sky + soft directional sun ─── */}
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

      {/* Atmospheric haze blended toward the sky horizon */}
      <fog attach="fog" args={['#5f7080', 150, 520]} />

      {/* ─── SCALED WORLD: the mine becomes the hero of the viewport ─── */}
      <group scale={PIT_SCALE}>
        <PitTerrain />

        {displayZones.map(zone => (
          <RiskZone3D
            key={zone.id}
            zone={zone}
            isSelected={selectedZone?.id === zone.id}
            onSelect={() => selectZone(zone.id)}
            showLabel={showZoneLabels}
          />
        ))}

        {displaySensors.map(sensor => (
          <SensorNode3D
            key={sensor.id}
            sensor={sensor}
            isSelected={selectedSensor?.id === sensor.id}
            onSelect={() => selectSensor(sensor.id)}
          />
        ))}

        <GatewayTowers />

        <CommunicationLines />

        <DeployedDeployment />

        {heatmapVisible && <HeatmapOverlay zones={displayZones} />}

        {droneMode && <DroneModel />}
      </group>

      <CameraRig />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        minDistance={18}
        maxDistance={280}
        maxPolarAngle={1.52}
        autoRotate={autoRotate}
        autoRotateSpeed={0.35}
        target={[0, -7, 0]}
      />

      {/* ─── POST PROCESSING: AO, focused bloom, SMAA, subtle vignette ─── */}
      <EffectComposer multisampling={0}>
        <N8AO intensity={2.2} aoRadius={6} distanceFalloff={1.4} halfRes color="#05070b" />
        <Bloom intensity={0.65} luminanceThreshold={1} luminanceSmoothing={0.25} mipmapBlur radius={0.72} />
        <SMAA />
        <Vignette offset={0.18} darkness={0.5} />
      </EffectComposer>
    </Canvas>
  );
}

function GatewayTowers() {
  const glowTexture = makeGlowTexture();
  return (
    <group>
      {GATEWAYS.map(g => (
        <group
          key={g.id}
          position={[g.position.x, pitHeightAt(g.position.x, g.position.z), g.position.z]}
        >
          <mesh position={[0, 3.4, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.5, 6.8, 10]} />
            <meshStandardMaterial color="#4a5a70" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, 7, 0]}>
            <cylinderGeometry args={[1.6, 1.6, 0.25, 24, 1, false, 0, Math.PI * 0.8]} />
            <meshStandardMaterial color="#33506e" metalness={0.7} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 7.35, 0]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.8} />
          </mesh>
          <sprite scale={[2.2, 2.2, 1]} position={[0, 7.4, 0]}>
            <spriteMaterial map={glowTexture} color="#22d3ee" transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </group>
  );
}

function CameraRig() {
  const { selectedSensor, selectedZone } = useApp();
  const controls = useThree(s => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const current = useRef(new THREE.Vector3(0, -7, 0));
  const desired = useRef(new THREE.Vector3(0, -7, 0));

  useFrame((_, dt) => {
    const s = selectedSensor;
    const z = selectedZone;
    desired.current.set(
      (s ? s.position.x : z ? z.position.x : 0) * PIT_SCALE,
      (s ? s.position.y + 1 : z ? z.position.y + 2 : -7) * PIT_SCALE,
      (s ? s.position.z : z ? z.position.z : 0) * PIT_SCALE,
    );
    current.current.lerp(desired.current, Math.min(1, dt * 3));
    if (controls) {
      controls.target.copy(current.current);
    }
  });

  return null;
}
