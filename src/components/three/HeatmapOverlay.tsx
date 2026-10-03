import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HighRiskZone } from '../../data/types';
import { PIT } from '../../data/types';
import { usePrediction } from '../../hooks/usePrediction';
import { riskColorGradient, scoreToRisk } from '../../utils/helpers';
import { pitHeightAt, boundaryRadius } from './terrainField';

interface HeatmapOverlayProps {
  zones: HighRiskZone[];
}

const ANGLES = 128;
const RADII = 52;

const VERTEX_SHADER = `
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.004) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

function parseRgb(rgb: string): [number, number, number] {
  const m = rgb.match(/(\d+),(\d+),(\d+)/)!;
  return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
}

function angleInSector(a: number, start: number, end: number): boolean {
  const d = end - start;
  const da = (((a - start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return da <= d;
}

interface Target {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Semi-transparent risk heatmap projected directly onto the pit terrain.
 * Vertices follow the analytic bench profile, so the colours blend into the
 * slopes. Colours animate smoothly toward each zone's current risk level.
 */
export function HeatmapOverlay({ zones }: HeatmapOverlayProps) {
  const targetsRef = useRef<Target[]>([]);
  const { prediction } = usePrediction();
  const heatRisk = prediction ? scoreToRisk(prediction.score) : null;
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    const maxR = PIT.R + 4.5;
    for (let i = 0; i <= ANGLES; i++) {
      const a = (i / ANGLES) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let j = 0; j <= RADII; j++) {
        const r = (j / RADII) * maxR;
        const x = ca * r;
        const z = sa * r;
        positions.push(x, pitHeightAt(x, z) + 0.12, z);
      }
    }
    const cols = RADII + 1;
    for (let i = 0; i < ANGLES; i++) {
      for (let j = 0; j < RADII; j++) {
        const a0 = i * cols + j;
        const b0 = a0 + cols;
        indices.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
    }
    const count = positions.length / 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(count), 1));
    return g;
  }, []);

  useEffect(() => {
    const targets: Target[] = [];
    const maxR = PIT.R + 4.5;
    for (let i = 0; i <= ANGLES; i++) {
      const a = (i / ANGLES) * Math.PI * 2;
      for (let j = 0; j <= RADII; j++) {
        const r = (j / RADII) * maxR;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        let target: Target = { r: 0, g: 0, b: 0, a: 0 };
        for (const zz of zones) {
          const [l1, l2] = zz.levels;
          const rOut = boundaryRadius(l1, a);
          const rIn = boundaryRadius(l2 + 1, a);
          if (r > rOut || r < rIn) continue;
          if (!angleInSector(a, zz.angleStart, zz.angleEnd)) continue;

          const span = Math.max(1, rOut - rIn);
          const band = span * 0.24;
          const rFade = Math.min((r - rIn) / band, (rOut - r) / band);
          const aMid = (zz.angleStart + zz.angleEnd) / 2;
          const aSpan = zz.angleEnd - zz.angleStart;
          const aFade = (aSpan / 2 - Math.abs(a - aMid)) / Math.max(0.001, aSpan * 0.13);
          const alpha = THREE.MathUtils.clamp(Math.min(rFade, aFade), 0, 1) * 0.85;

          const [cr, cg, cb] = parseRgb(riskColorGradient(heatRisk ?? zz.currentRisk));
          target = { r: cr, g: cg, b: cb, a: alpha };
          break;
        }
        targets.push(target);
      }
    }
    targetsRef.current = targets;
  }, [zones, heatRisk]);

  useFrame(() => {
    const targets = targetsRef.current;
    if (targets.length === 0) return;
    const colorAttr = geometry.getAttribute('aColor') as THREE.BufferAttribute;
    const alphaAttr = geometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    const colors = colorAttr.array as Float32Array;
    const alphas = alphaAttr.array as Float32Array;
    let dirty = false;
    for (let k = 0; k < targets.length; k++) {
      const t = targets[k];
      const ci = k * 3;
      const nr = colors[ci] + (t.r - colors[ci]) * 0.16;
      const ng = colors[ci + 1] + (t.g - colors[ci + 1]) * 0.16;
      const nb = colors[ci + 2] + (t.b - colors[ci + 2]) * 0.16;
      const na = alphas[k] + (t.a - alphas[k]) * 0.16;
      if (Math.abs(nr - colors[ci]) > 0.0015 || Math.abs(na - alphas[k]) > 0.0015) dirty = true;
      colors[ci] = nr;
      colors[ci + 1] = ng;
      colors[ci + 2] = nb;
      alphas[k] = na;
    }
    if (dirty) {
      colorAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    }
  });

  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
      />
    </mesh>
  );
}
