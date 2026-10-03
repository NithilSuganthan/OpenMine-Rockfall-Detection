import { useMemo } from 'react';
import * as THREE from 'three';
import { PIT } from '../../data/types';
import { mulberry32 } from '../../utils/helpers';
import { makeGlowTexture } from './glow';
import { MineVehicles, TelecomTowers, MonitoringPoles, ControlFacility } from './MineTerrain';
import { pitHeightAt, boundaryRadius, roadNearest, roadCurve, fbm, ROAD_HALF } from './terrainField';

/**
 * World-scale factor applied to the whole Digital Twin scene so the mine
 * fills the viewport like professional mining software.
 */
export const PIT_SCALE = 1.22;

/* ─── PBR texture set: albedo detail + tangent-space normal map ─── */
function makePBRTextures(seed: number): { albedo: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const size = 256;
  const rng = mulberry32(seed);

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(140,134,124)';
  ctx.fillRect(0, 0, size, size);

  // Strata banding
  for (let i = 0; i < 14; i++) {
    const y = rng() * size;
    const hh = 3 + rng() * 18;
    const light = rng() > 0.5;
    const v = light ? 150 + rng() * 90 : 55 + rng() * 55;
    ctx.fillStyle = `rgba(${v},${v - 9},${v - 18},${0.1 + rng() * 0.15})`;
    ctx.fillRect(0, y, size, hh);
  }

  // Mineral speckles
  for (let i = 0; i < 4200; i++) {
    const v = 55 + rng() * 130;
    ctx.fillStyle = `rgba(${v},${v - 10},${v - 20},${0.1 + rng() * 0.3})`;
    ctx.fillRect(rng() * size, rng() * size, 0.8 + rng() * 2.6, 0.8 + rng() * 2.6);
  }

  // Fracture lines
  ctx.strokeStyle = 'rgba(28,26,22,0.32)';
  for (let i = 0; i < 22; i++) {
    ctx.beginPath();
    let x = rng() * size;
    let y = rng() * size;
    ctx.moveTo(x, y);
    const steps = 3 + Math.floor(rng() * 5);
    for (let s = 0; s < steps; s++) {
      x += (rng() - 0.5) * 34;
      y += (rng() - 0.5) * 34;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 0.6 + rng() * 1.4;
    ctx.stroke();
  }

  // Height canvas (extra micro detail) → normal map via Sobel
  const hgt = document.createElement('canvas');
  hgt.width = hgt.height = size;
  const hctx = hgt.getContext('2d')!;
  hctx.drawImage(albedoCanvas, 0, 0);
  for (let i = 0; i < 1800; i++) {
    const v = 30 + rng() * 70;
    hctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    hctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2.2, 1 + rng() * 2.2);
  }

  const albedoTex = new THREE.CanvasTexture(albedoCanvas);
  albedoTex.wrapS = albedoTex.wrapT = THREE.RepeatWrapping;
  albedoTex.colorSpace = THREE.SRGBColorSpace;
  albedoTex.anisotropy = 4;

  const normalTex = makeNormalFromHeight(hgt);
  return { albedo: albedoTex, normal: normalTex };
}

function makeNormalFromHeight(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const size = canvas.width;
  const src = canvas.getContext('2d')!.getImageData(0, 0, size, size).data;
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(size, size);
  const strength = 2.4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = src[y * size * 4 + Math.max(0, x - 1) * 4];
      const x1 = src[y * size * 4 + Math.min(size - 1, x + 1) * 4];
      const y0 = src[Math.max(0, y - 1) * size * 4 + x * 4];
      const y1 = src[Math.min(size - 1, y + 1) * size * 4 + x * 4];
      const dx = (x1 - x0) / 255;
      const dy = (y1 - y0) / 255;
      const i = (y * size + x) * 4;
      img.data[i] = 128 + dx * strength * 127;
      img.data[i + 1] = 128 + dy * strength * 127;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* ─── Geological strata → vertex colour (bedded bands, contorted by noise) ─── */
function terrainColor(h: number, x: number, z: number): [number, number, number] {
  const j = fbm(x * 0.35, z * 0.35, 51) * 3.2 + fbm(x * 0.9, z * 0.9, 79) * 1.1;
  const ht = h + j;
  let c: [number, number, number];
  if (ht > -2.5) c = [0.55, 0.5, 0.42]; // overburden
  else if (ht > -7.5) c = [0.62, 0.56, 0.45]; // upper benches (tan)
  else if (ht > -12.5) c = [0.58, 0.45, 0.32]; // iron / copper zone (oxide)
  else c = [0.4, 0.38, 0.35]; // deep grey rock
  // Bedding planes: alternating light/dark strata layers, contorted by noise
  const bed = Math.sin(ht * 1.1 + fbm(x * 0.3, z * 0.3, 33) * 3.2);
  if (bed > 0.35) {
    const k = 1 - (bed - 0.35) * 0.75;
    c = [c[0] * k, c[1] * k, c[2] * k];
  }
  return c;
}

/* ─── Displaced terrain mesh (256×256 over ±98) ─── */
function buildTerrainMesh(): THREE.BufferGeometry {
  const GRID = 256;
  const EXT = 98;
  const stride = GRID + 1;
  const positions = new Float32Array(stride * stride * 3);
  const colors = new Float32Array(stride * stride * 3);
  const uvs = new Float32Array(stride * stride * 2);
  const indices = new Uint32Array(GRID * GRID * 6);

  let vi = 0;
  for (let iz = 0; iz <= GRID; iz++) {
    const z = -EXT + (2 * EXT * iz) / GRID;
    for (let ix = 0; ix <= GRID; ix++) {
      const x = -EXT + (2 * EXT * ix) / GRID;
      const h = pitHeightAt(x, z);
      const o3 = vi * 3;
      positions[o3] = x;
      positions[o3 + 1] = h;
      positions[o3 + 2] = z;
      uvs[vi * 2] = (x + EXT) / 5;
      uvs[vi * 2 + 1] = (z + EXT) / 5;
      const [cr, cg, cb] = terrainColor(h, x, z);
      colors[o3] = cr;
      colors[o3 + 1] = cg;
      colors[o3 + 2] = cb;
      vi++;
    }
  }

  let ii = 0;
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const a = iz * stride + ix;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices[ii++] = a;
      indices[ii++] = c;
      indices[ii++] = b;
      indices[ii++] = b;
      indices[ii++] = c;
      indices[ii++] = d;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.computeVertexNormals();
  return g;
}

/* ─── Cyan engineering wireframe following the terrain ─── */
function buildTerrainGrid(radial = 60, angular = 128, lift = 0.12, maxR = 70): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= angular; i++) {
    const a = (i / angular) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let j = 0; j <= radial; j++) {
      const r = 0.8 + (j / radial) * maxR;
      positions.push(ca * r, pitHeightAt(ca * r, sa * r) + lift, sa * r);
    }
  }
  const cols = radial + 1;
  for (let i = 0; i < angular; i++) {
    for (let j = 0; j < radial; j++) {
      const a0 = i * cols + j;
      const b0 = a0 + cols;
      indices.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  return g;
}

/* ─── Haul road ribbon + crisp edge lines (the terrain shelf is carved by
       pitHeightAt, and the ribbon follows roadCurve so it always sits
       recessed in the rock) ─── */
function buildRoad() {
  const steps = 300;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = roadCurve(i / steps);
    pts.push(new THREE.Vector3(p.x, p.y, p.z));
  }

  const width = 4.4;
  const positions: number[] = [];
  const leftPts: number[] = [];
  const rightPts: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    const n = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(width / 2);
    const l1 = new THREE.Vector3().copy(p1).add(n);
    const r1 = new THREE.Vector3().copy(p1).sub(n);
    const l2 = new THREE.Vector3().copy(p2).add(n);
    const r2 = new THREE.Vector3().copy(p2).sub(n);
    positions.push(l1.x, l1.y, l1.z, r1.x, r1.y, r1.z, l2.x, l2.y, l2.z);
    positions.push(r1.x, r1.y, r1.z, r2.x, r2.y, r2.z, l2.x, l2.y, l2.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const edgeLift = 0.09;
  const leftLine: number[] = [];
  const rightLine: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dir = new THREE.Vector3().subVectors(next, p).normalize();
    const n = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(width / 2 + 0.14);
    leftLine.push(p.x + n.x, p.y + edgeLift, p.z + n.z);
    rightLine.push(p.x - n.x, p.y + edgeLift, p.z - n.z);
  }
  const leftGeo = new THREE.BufferGeometry();
  leftGeo.setAttribute('position', new THREE.Float32BufferAttribute(leftLine, 3));
  const rightGeo = new THREE.BufferGeometry();
  rightGeo.setAttribute('position', new THREE.Float32BufferAttribute(rightLine, 3));

  return { roadGeo: geo, leftGeo, rightGeo };
}

/* ─── Scattered rock piles on treads and rim for scale & realism ─── */
function buildRockScatter(tex: { albedo: THREE.CanvasTexture; normal: THREE.CanvasTexture }): THREE.InstancedMesh {
  const rng = mulberry32(20260807);
  const geo = new THREE.DodecahedronGeometry(0.75, 0);
  const mat = new THREE.MeshStandardMaterial({
    map: tex.albedo,
    normalMap: tex.normal,
    color: '#a89a84',
    roughness: 0.95,
    metalness: 0.02,
    envMapIntensity: 0.5,
  });
  const count = 240;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let idx = 0;

  const tryPlace = (x: number, z: number) => {
    if (roadNearest(x, z).dist < ROAD_HALF + 1.4) return;
    const h = pitHeightAt(x, z);
    if (h < -15.5) return;
    p.set(x, h - 0.02, z);
    s.set(0.7 + rng() * 1.8, 0.45 + rng() * 0.75, 0.7 + rng() * 1.7);
    q.setFromEuler(new THREE.Euler(rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6));
    m.compose(p, q, s);
    mesh.setMatrixAt(idx++, m);
  };

  for (let b = 0; b < PIT.BENCHES && idx < count; b++) {
    const perBench = 26;
    for (let i = 0; i < perBench && idx < count; i++) {
      const theta = (i / perBench) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const bOut = boundaryRadius(b, theta);
      const bIn = boundaryRadius(b + 1, theta);
      const r = bIn + (bOut - bIn) * (0.2 + rng() * 0.55);
      tryPlace(Math.cos(theta) * r, Math.sin(theta) * r);
    }
  }
  while (idx < count) {
    const theta = rng() * Math.PI * 2;
    const rim = boundaryRadius(0, theta);
    const r = rim + 1 + rng() * 12;
    tryPlace(Math.cos(theta) * r, Math.sin(theta) * r);
  }

  mesh.count = idx;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function PitTerrain() {
  const tex = useMemo(() => makePBRTextures(404), []);
  const terrainGeo = useMemo(() => buildTerrainMesh(), []);
  const gridGeo = useMemo(() => buildTerrainGrid(), []);
  const road = useMemo(() => buildRoad(), []);
  const glowTexture = useMemo(() => makeGlowTexture(), []);
  const rocks = useMemo(() => buildRockScatter(tex), [tex]);

  return (
    <group>
      {/* ─── 1. IRREGULAR OPEN-PIT TERRAIN (PBR, strata vertex colours) ─── */}
      <mesh geometry={terrainGeo} receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={tex.albedo}
          normalMap={tex.normal}
          normalScale={[0.9, 0.9]}
          roughness={0.94}
          metalness={0.02}
          envMapIntensity={0.6}
        />
      </mesh>

      {/* ─── 2. SUBTLE CYAN ENGINEERING WIREFRAME ─── */}
      <mesh geometry={gridGeo}>
        <meshBasicMaterial color="#3ba7c9" wireframe transparent opacity={0.16} depthWrite={false} />
      </mesh>

      {/* ─── 3. HAUL ROAD (cut into the terrain by the height field) ─── */}
      <mesh geometry={road.roadGeo} position={[0, 0.06, 0]} receiveShadow>
        <meshStandardMaterial color="#8a7d64" roughness={0.9} metalness={0.03} side={THREE.DoubleSide} envMapIntensity={0.4} />
      </mesh>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[road.leftGeo.getAttribute('position').array, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#16130f" transparent opacity={0.7} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[road.rightGeo.getAttribute('position').array, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#16130f" transparent opacity={0.7} />
      </line>

      {/* ─── 4. SCATTERED ROCK DEBRIS ─── */}
      <primitive object={rocks} castShadow receiveShadow />

      {/* ─── 5. MINE MACHINERY ─── */}
      <MineVehicles pathAt={roadCurve} />

      {/* ─── 6. RIM INFRASTRUCTURE (grounded on the natural terrain) ─── */}
      <TelecomTowers
        glowTexture={glowTexture}
        positions={[
          { x: -50, z: -35, rot: 0.2, y: pitHeightAt(-50, -35) },
          { x: 45, z: 42, rot: -0.6, y: pitHeightAt(45, 42) },
        ]}
      />
      <MonitoringPoles
        glowTexture={glowTexture}
        positions={[
          { x: -35, y: pitHeightAt(-35, 20), z: 20, color: '#22d3ee' },
          { x: 30, y: pitHeightAt(30, -15), z: -15, color: '#f59e0b' },
          { x: -14, y: pitHeightAt(-14, -22), z: -22, color: '#ef4444' },
        ]}
      />
      <group position={[0, pitHeightAt(5, 64), 0]}>
        <ControlFacility glowTexture={glowTexture} />
      </group>
    </group>
  );
}
