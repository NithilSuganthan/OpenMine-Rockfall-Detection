import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Procedural "HDRI" sky: an equirectangular gradient sky with a warm sun,
 * soft clouds and a hazy horizon. Used both as the scene background and as
 * the image-based lighting environment (PMREM), so PBR materials pick up
 * real sky reflections — no external HDR assets required.
 */

let cachedCanvas: HTMLCanvasElement | null = null;

export function makeSkyCanvas(): HTMLCanvasElement {
  if (cachedCanvas) return cachedCanvas;
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, '#0b1422');   // zenith deep navy
  g.addColorStop(0.42, '#1c2f47');  // upper sky
  g.addColorStop(0.62, '#3d556e');  // mid sky
  g.addColorStop(0.7, '#67788c');   // horizon haze (bright)
  g.addColorStop(0.78, '#5d6b78');  // just below horizon
  g.addColorStop(1.0, '#33393f');   // ground below horizon
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Warm sun + glow (matches the directional light direction)
  const sx = 122;
  const sy = 116;
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 170);
  glow.addColorStop(0, 'rgba(255,240,214,1)');
  glow.addColorStop(0.05, 'rgba(255,228,190,0.95)');
  glow.addColorStop(0.18, 'rgba(255,216,170,0.5)');
  glow.addColorStop(0.5, 'rgba(255,205,155,0.12)');
  glow.addColorStop(1, 'rgba(255,200,150,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Soft cloud streaks
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 10; i++) {
    const y = 62 + Math.sin(i * 3.7) * 56;
    const x0 = (i * 173) % W;
    const w = 200 + ((i * 97) % 260);
    const cg = ctx.createLinearGradient(x0, y, x0 + w, y);
    cg.addColorStop(0, 'rgba(255,255,255,0)');
    cg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(x0, y - 6, w, 12);
  }
  ctx.globalAlpha = 1;

  cachedCanvas = c;
  return c;
}

export function HDRIEnvironment() {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);

  useEffect(() => {
    const canvas = makeSkyCanvas();
    const bgTex = new THREE.CanvasTexture(canvas);
    bgTex.mapping = THREE.EquirectangularReflectionMapping;
    bgTex.colorSpace = THREE.SRGBColorSpace;
    scene.background = bgTex;

    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromEquirectangular(bgTex);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();

    return () => {
      scene.background = null;
      scene.environment = null;
      bgTex.dispose();
      rt.texture.dispose();
    };
  }, [gl, scene]);

  return null;
}
