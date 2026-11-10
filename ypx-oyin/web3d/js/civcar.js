// Street cars built from orthographic reference sheets (see models/*.json, textures/civ_*).
// The side silhouette is extruded across the width; side/top/front/rear photos are mapped on,
// windshield and rear window become real glass, and the white paint is tinted per car.
import * as THREE from './three.module.min.js';
import { plateTexture } from './models.js';

const loader = new THREE.TextureLoader();
const texCache = {};
function tex(name) {
  if (!texCache[name]) {
    const t = loader.load(`textures/${name}.jpg`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache[name] = t;
  }
  return texCache[name];
}

function fit(points, ci, vi) {
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  const n = points.length;
  for (const p of points) { sx += p[ci]; sy += p[vi]; sxx += p[ci] * p[ci]; sxy += p[ci] * p[vi]; }
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return [a, (sy - a * sx) / n];
}

const geoCache = {};
function bodyGeometry(D) {
  if (geoCache[D.id]) return geoCache[D.id];
  const { poly, width: W, length: L, height: H } = D;
  const shape = new THREE.Shape();
  poly.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const BV = 0.04;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: W - 2 * BV, bevelEnabled: true, bevelThickness: BV, bevelSize: BV * 0.6, bevelSegments: 2, curveSegments: 1,
  }).toNonIndexed();
  g.translate(0, 0, -(W - 2 * BV) / 2);
  const [ua, ub] = fit(poly, 0, 2), [va, vb] = fit(poly, 1, 3);
  const [fs, ft] = D.topMap;
  const topU = f => {
    for (let i = 1; i < fs.length; i++) if (f <= fs[i]) return ft[i - 1] + (ft[i] - ft[i - 1]) * (f - fs[i - 1]) / (fs[i] - fs[i - 1]);
    return 1;
  };
  const hoodY = Math.max(...poly.filter(p => p[0] > L / 2 - 0.3).map(p => p[1]));
  const trunkY = Math.max(...poly.filter(p => p[0] < -L / 2 + 0.3).map(p => p[1]));
  const pos = g.attributes.position;
  const buckets = [[], [], [], [], [], [], []]; // sideL, sideR, top, front, rear, bottom, glass
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    let k;
    if (n.z < -0.75) k = 0; else if (n.z > 0.75) k = 1;
    else if (n.y > 0.35) k = 2; else if (n.y < -0.35) k = 5;
    else k = n.x > 0 ? 3 : 4;
    const cy = (a.y + b.y + c.y) / 3;
    if ((k === 3 && cy > hoodY + 0.02) || (k === 4 && cy > trunkY + 0.02)) k = 2;
    if (k >= 2 && k <= 4) {
      const f = (L / 2 - (a.x + b.x + c.x) / 3) / L, cz = Math.abs((a.z + b.z + c.z) / 3);
      const inWs = f > fs[1] + 0.01 && f < fs[2] - 0.004, inRw = f > fs[3] + 0.004 && f < fs[4] - 0.01;
      if ((inWs || inRw) && cz < W / 2 * 0.84) k = 6;
    }
    buckets[k].push([a.clone(), b.clone(), c.clone()]);
  }
  const uvOf = (k, p) => {
    switch (k) {
      case 0: return [ua * p.x + ub, va * p.y + vb];
      case 1: return [1 - (ua * p.x + ub), va * p.y + vb];
      case 2: return [topU((L / 2 - p.x) / L), 0.5 + p.z / W];
      case 3: return [0.5 - p.z / W, Math.min(1, p.y / H)];
      case 4: return [0.5 + p.z / W, Math.min(1, p.y / H)];
      default: return [0, 0];
    }
  };
  const P = [], U = [], groups = [];
  buckets.forEach((tris, k) => {
    const start = P.length / 3;
    for (const t of tris) for (const p of t) { P.push(p.x, p.y, p.z); U.push(...uvOf(k, p)); }
    groups.push([start, P.length / 3 - start, k]);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.computeVertexNormals();
  for (const [s, cnt, k] of groups) if (cnt) geo.addGroup(s, cnt, k);
  geoCache[D.id] = geo;
  return geo;
}

const matCache = {};
function materials(D, tint, tinted) {
  const key = D.id + tint + (tinted ? 't' : '');
  if (matCache[key]) return matCache[key];
  const p = `civ_${D.id}`;
  const paint = name => new THREE.MeshPhongMaterial({ map: tex(name), color: tint, shininess: 80, specular: 0x555555 });
  const glass = new THREE.MeshPhongMaterial({ color: tinted ? 0x040506 : 0x1c2733, shininess: 140, specular: 0xbfd4e6 });
  matCache[key] = [
    paint(p + '_side_l'), paint(p + '_side_r'), paint(p + '_top'), paint(p + '_front'), paint(p + '_rear'),
    new THREE.MeshLambertMaterial({ color: 0x151515 }), glass,
  ];
  return matCache[key];
}

// x of the silhouette's front (dir=1) or rear (dir=-1) at height y
function edgeX(poly, y, dir) {
  let best = dir > 0 ? -Infinity : Infinity;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    if ((p[1] - y) * (q[1] - y) > 0 || p[1] === q[1]) continue;
    const x = p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]);
    best = dir > 0 ? Math.max(best, x) : Math.min(best, x);
  }
  return best;
}

let shadowTex = null;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  return (shadowTex = new THREE.CanvasTexture(cv));
}

// opts: { tint, tinted, noPlate, plate, baldTire }
export function makeCivCar(D, opts = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const W = D.width;
  const shell = new THREE.Mesh(bodyGeometry(D), materials(D, opts.tint ?? 0xffffff, opts.tinted));
  shell.castShadow = true;
  body.add(shell);

  const wheelGeo = new THREE.CylinderGeometry(D.wheelR, D.wheelR, 0.24, 18);
  wheelGeo.rotateX(Math.PI / 2);
  const rim = new THREE.MeshLambertMaterial({ map: tex(`civ_${D.id}_wheel`) });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const bald = new THREE.MeshLambertMaterial({ color: 0x8d8678 });
  const wheels = [];
  for (const x of D.wheelX) for (const s of [1, -1]) {
    const isBald = opts.baldTire && x > 0 && s > 0;
    const w = new THREE.Mesh(wheelGeo, [isBald ? bald : tyre, rim, rim]);
    w.position.set(x, D.wheelY, s * (W / 2 - 0.1));
    body.add(w); wheels.push(w);
  }

  if (!opts.noPlate && opts.plate) {
    const pm = new THREE.MeshBasicMaterial({ map: plateTexture(opts.plate) });
    const fx = edgeX(D.poly, D.plateFront, 1), rx = edgeX(D.poly, D.plateRear, -1);
    if (isFinite(fx)) {
      const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.115), pm);
      fp.rotation.y = Math.PI / 2; fp.position.set(fx + 0.012, D.plateFront, 0); body.add(fp);
    }
    if (isFinite(rx)) {
      const bp = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.115), pm);
      bp.rotation.y = -Math.PI / 2; bp.position.set(rx - 0.012, D.plateRear, 0); body.add(bp);
    }
  }

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(D.length * 1.08, W * 1.45),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.5, color: 0x000000 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012;
  g.add(shadow);

  // right-front turn signal used when pulling over
  const sig = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffa000 }));
  sig.position.set(D.length / 2 - 0.3, D.plateFront + 0.2, W / 2 + 0.02);
  sig.visible = false;
  body.add(sig);
  g.userData = { wheels, body, signal: sig };
  return g;
}
