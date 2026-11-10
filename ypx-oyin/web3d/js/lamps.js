// Head/tail light glows used during the vehicle check: all lamps light up, a broken headlight stays dark.
import * as THREE from './three.module.min.js';

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return (glowTex = new THREE.CanvasTexture(cv));
}

const mats = {};
function glowMat(color) {
  if (!mats[color]) mats[color] = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  return mats[color];
}
const crackMat = new THREE.SpriteMaterial({ color: 0x111111, transparent: true, opacity: 0.85 });
// bright lamp core (normal blending so it shows even on a white car) and the light pool it throws on the road
let coreTex = null;
function coreTexture() {
  if (coreTex) return coreTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.55, 'rgba(255,236,150,1)'); g.addColorStop(0.75, 'rgba(255,220,110,0.6)'); g.addColorStop(1, 'rgba(255,220,110,0)');
  c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  return (coreTex = new THREE.CanvasTexture(cv));
}
const coreMat = new THREE.SpriteMaterial({ map: null, transparent: true, depthWrite: false });
const poolMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });

// pos: { fx, fy, rx, ry, hz } in the car's local frame (front = +x); brokenSide: 1 / -1 / 0
export function addLamps(car, pos, brokenSide = 0) {
  if (!pos) return;
  const body = car.userData.body || car;
  const grp = new THREE.Group();
  grp.visible = false;
  const lamp = (x, y, z, color, size, broken) => {
    if (broken) { // dead lamp: a small dark smudge instead of a glow
      const s = new THREE.Sprite(crackMat); s.scale.set(0.16, 0.12, 1); s.position.set(x, y, z); grp.add(s); return;
    }
    const s = new THREE.Sprite(glowMat(color));
    s.scale.set(size, size, 1); s.position.set(x, y, z); grp.add(s);
    if (color !== 0xff2a1a) { // headlight: solid core + pool of light on the road ahead
      if (!coreMat.map) coreMat.map = coreTexture();
      const core = new THREE.Sprite(coreMat); core.scale.set(0.24, 0.2, 1); core.position.set(x + 0.02, y, z); grp.add(core);
      if (!poolMat.map) poolMat.map = glowTexture();
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.5), poolMat);
      pool.rotation.x = -Math.PI / 2; pool.position.set(x + 2.0, 0.02, z * 1.1); grp.add(pool);
    }
  };
  for (const side of [1, -1]) {
    lamp(pos.fx, pos.fy, side * pos.hz, 0xfff4d6, 1.0, side === brokenSide);
    lamp(pos.rx, pos.ry, side * pos.hz, 0xff2a1a, 0.6, false);
  }
  body.add(grp);
  car.userData.lamps = grp;
}

export function setLamps(car, on) {
  if (car && car.userData.lamps) car.userData.lamps.visible = on;
}
