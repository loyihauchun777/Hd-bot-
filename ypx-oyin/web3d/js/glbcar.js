// Full 3D street cars loaded from slimmed GLB models (see tools/slim.mjs).
// Models (all CC BY 4.0, credited in the help screen and README):
//   Nexia 2 — uzb_rx7; Chevrolet Malibu 2022 — slavanik24250794; Chevrolet Damas — own.guest;
//   Chevrolet Nexia3 Midnight — doniyorgroup (Sketchfab).
// Daewoo Matiz (nyranarod), Chevrolet Spark (Q.SARDOR): Sketchfab Standard licence, used under the owner's licence.
// Chevrolet Tracker: model supplied by the owner (converted via imagetostl.com).
import * as THREE from './three.module.min.js';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import { toCreasedNormals } from './jsm/utils/BufferGeometryUtils.js';
import { plateTexture } from './models.js';

export const GLB_MODELS = [
  { id: 'nexia2', name: 'Chevrolet Nexia 2', file: 'models/nexia2.glb', length: 4.48, width: 1.66, height: 1.39, paint: 'carpaint', glass: ['windowglass'] },
  { id: 'nexia3', name: 'Chevrolet Nexia 3', file: 'models/nexia3.glb', length: 4.31, width: 1.71, height: 1.505, paint: 'Matte_FFFFFFFF', glass: ['Matte_827F7F7F'], matColor: { Matte_FFBBAD4C: 0xdfe6ee },
    unskew: [0.99124, -0.01391, 0.13134, 0.12391, 0.44202, -0.8884, -0.0457, 0.8969, 0.43988] },
  { id: 'matiz', name: 'Daewoo Matiz', file: 'models/matiz.glb', length: 3.50, width: 1.50, height: 1.485, paint: 'Car_Paint', glass: ['Car_windshield_glass'], flip: true },
  { id: 'spark', name: 'Chevrolet Spark', file: 'models/spark.glb', length: 3.64, width: 1.60, height: 1.52, paint: 'Chevrolet_Beat_2010_carpaint', glass: ['Chevrolet_Beat_2010_greenglass', 'Chevrolet_Beat_2010_clearglass'] },
  { id: 'tracker', name: 'Chevrolet Tracker', file: 'models/tracker.glb', length: 4.27, width: 1.79, height: 1.63, paint: 'ID986', glass: ['ID486'] },
  { id: 'malibu', name: 'Chevrolet Malibu', file: 'models/malibu.glb', length: 4.93, width: 1.85, height: 1.46, paint: 'malibupaint', glass: ['malibuglass'] },
  { id: 'damas', name: 'Chevrolet Damas', file: 'models/damas.glb', length: 3.23, width: 1.40, height: 1.90, lampY: 0.75, tailY: 0.7, paint: 'material_3', glass: ['material_5'], flip: true },
];

const loaded = {}; // id -> { template, box }
const readyCbs = [];
export const onGlbLoaded = cb => readyCbs.push(cb);
const loader = new GLTFLoader();

export function loadGlbModels() {
  for (const M of GLB_MODELS) {
    loader.load(M.file, gltf => {
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      // bake transforms, recompute smooth normals (the slimmed file has none)
      const parts = [];
      root.traverse(o => {
        if (!o.isMesh) return;
        let g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        g.deleteAttribute('normal');
        // smooth panels but keep sharp edges (bumpers, pillars, lamp rims) crisp
        g = toCreasedNormals(g, Math.PI / 5);
        const m = o.material;
        const hex = /Matte_([0-9A-F]{2})([0-9A-F]{6})/i.exec(m.name || '');
        if (hex && !m.map) { // some exporters keep the colour only in the material name
          m.color.set(M.matColor && M.matColor[m.name] !== undefined ? M.matColor[m.name] : '#' + hex[2]);
          const a = parseInt(hex[1], 16) / 255;
          if (a < 0.99) { m.transparent = true; m.opacity = Math.max(0.35, a); }
        }
        parts.push(new THREE.Mesh(g, m));
      });
      if (M.unskew) { // parts were exported with a common skewed rotation R: apply Rx(-90°)·Rᵀ
        const R = new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(M.unskew));
        const fix = new THREE.Matrix4().makeRotationX(-Math.PI / 2).multiply(R.clone().transpose());
        parts.forEach(p => p.geometry.applyMatrix4(fix));
      }
      const box = new THREE.Box3();
      parts.forEach(p => box.expandByObject(p));
      // ground = bottom of the tyres when the model has them (ignores stray parts hanging below)
      const tyres = parts.filter(p => /tire|tyre|shina/i.test(p.material.name || ''));
      if (tyres.length) {
        const tb = new THREE.Box3(); tyres.forEach(p => tb.expandByObject(p));
        box.min.y = tb.min.y;
        // drop parts that sit entirely below the tyres (shadow planes, debris)
        for (let i = parts.length - 1; i >= 0; i--) {
          const pb = new THREE.Box3().setFromObject(parts[i]);
          if (pb.max.y < tb.min.y + 0.02 * (tb.max.y - tb.min.y)) parts.splice(i, 1);
        }
      }
      const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
      // the long horizontal axis becomes +x (front), y is up, scaled to the real length
      const alongZ = size.z > size.x;
      const s = M.length / (alongZ ? size.z : size.x);
      const tpl = new THREE.Group();
      for (const p of parts) {
        p.geometry.translate(-centre.x, -box.min.y, -centre.z);
        if (alongZ) p.geometry.rotateY(Math.PI / 2);
        if (M.flip) p.geometry.rotateY(Math.PI); // model was built facing the other way
        p.geometry.scale(s, s, s);
        p.castShadow = true;
        tpl.add(p);
      }
      loaded[M.id] = { template: tpl, model: M };
      readyCbs.forEach(cb => cb(M.id));
    }, undefined, e => console.warn('GLB load failed', M.file, e));
  }
}

export const glbReady = id => !!loaded[id];

const paintCache = {};
function paintFor(base, tint) {
  const key = base.uuid + tint;
  if (!paintCache[key]) {
    const m = new THREE.MeshPhongMaterial({ color: tint, shininess: 90, specular: 0x777777 });
    paintCache[key] = m;
  }
  return paintCache[key];
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

// opts: { tint, tinted, noPlate, plate }
export function makeGlbCar(id, opts = {}) {
  const { template, model: M } = loaded[id];
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const tint = opts.tint ?? 0xf2f2f2;
  for (const p of template.children) {
    const name = p.material.name || '';
    let mat = p.material;
    if (name === M.paint) mat = paintFor(p.material, tint);
    else if ((M.glass || []).includes(name) && opts.tinted) mat = new THREE.MeshPhongMaterial({ color: 0x050608, shininess: 120 });
    const m = new THREE.Mesh(p.geometry, mat);
    m.castShadow = true;
    body.add(m);
  }
  if (!opts.noPlate && opts.plate) {
    const pm = new THREE.MeshBasicMaterial({ map: plateTexture(opts.plate) });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.115), pm);
    fp.rotation.y = Math.PI / 2; fp.position.set(M.length / 2 + 0.03, 0.42, 0); body.add(fp);
    const bp = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.115), pm);
    bp.rotation.y = -Math.PI / 2; bp.position.set(-M.length / 2 - 0.03, 0.55, 0); body.add(bp);
  }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(M.length * 1.08, M.width * 1.45),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.5, color: 0x000000 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012;
  g.add(shadow);
  const sig = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffa000 }));
  sig.position.set(M.length / 2 - 0.3, 0.65, M.width / 2 + 0.02); sig.visible = false;
  body.add(sig);
  g.userData = { wheels: [], body, signal: sig,
    lampPos: { fx: M.length / 2 + 0.03, fy: M.lampY ?? 0.62, rx: -M.length / 2 - 0.03, ry: M.tailY ?? 0.78, hz: M.width / 2 - 0.3 } };
  return g;
}

// ---------- YPX patrol car: a GLB body (Malibu) wearing the YPX drawing's livery ----------
const texLoader = new THREE.TextureLoader();
const liveryTex = {};
function ltex(name) {
  if (!liveryTex[name]) {
    const t = texLoader.load(`textures/${name}.jpg`);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    liveryTex[name] = t;
  }
  return liveryTex[name];
}

const liveryGeo = {};
// Re-lay the paint mesh by facing direction and project the drawing's views onto it:
// sides <- side view, top <- top view (remapped so hood/roof/trunk line up), nose/tail <- front/rear views.
function liveryGeometry(id, geo, L, W, H, topMap) {
  if (liveryGeo[id]) return liveryGeo[id];
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position, nor = g.attributes.normal;
  const [fs, ft] = topMap || [[0, 1], [0, 1]];
  const topU = f => {
    for (let i = 1; i < fs.length; i++) if (f <= fs[i]) return ft[i - 1] + (ft[i] - ft[i - 1]) * (f - fs[i - 1]) / (fs[i] - fs[i - 1]);
    return 1;
  };
  const buckets = [[], [], [], [], []]; // sideL(-z), sideR(+z), top, front, rear
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) n.add(new THREE.Vector3().fromBufferAttribute(nor, i + k));
    n.normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let b;
    if (az >= ax && az >= ay * 0.8) b = n.z < 0 ? 0 : 1;
    else if (ay >= ax) b = 2;          // roof, hood, trunk (and the underside, unseen)
    else b = n.x > 0 ? 3 : 4;
    buckets[b].push(i);
  }
  const P = [], N = [], U = [], groups = [];
  const v = new THREE.Vector3(), vn = new THREE.Vector3();
  buckets.forEach((tris, b) => {
    const start = P.length / 3;
    for (const i of tris) for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, i + k); vn.fromBufferAttribute(nor, i + k);
      P.push(v.x, v.y, v.z); N.push(vn.x, vn.y, vn.z);
      const fy = Math.min(1, Math.max(0, v.y / H));
      if (b === 0) U.push(0.5 - v.x / L, fy);                 // left side: drawing as is (front at the image's left)
      else if (b === 1) U.push(0.5 + v.x / L, fy);            // right side: mirrored drawing with redrawn lettering
      else if (b === 2) U.push(topU(0.5 - v.x / L), 0.5 + v.z / W);
      else if (b === 3) U.push(0.5 - v.z / W, fy);
      else U.push(0.5 + v.z / W, fy);
    }
    groups.push([start, P.length / 3 - start, b]);
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  for (const [s0, c, b] of groups) if (c) out.addGroup(s0, c, b);
  return (liveryGeo[id] = out);
}

// prefix: texture set of the drawing (e.g. 'ypx2'); topMap: drawing's hood/roof/trunk alignment
export function makePatrolGlb(id, prefix, topMap) {
  const { template, model: M } = loaded[id];
  const box = new THREE.Box3().setFromObject(template);
  const L = box.max.x - box.min.x, W = box.max.z - box.min.z, H = box.max.y;
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const paintMat = name => new THREE.MeshPhongMaterial({ map: ltex(name), shininess: 90, specular: 0x666666 });
  const livery = [paintMat(prefix + '_side_l'), paintMat(prefix + '_side_r'), paintMat(prefix + '_top'),
    paintMat(prefix + '_front'), paintMat(prefix + '_rear')];
  for (const p of template.children) {
    if ((p.material.name || '') === M.paint) {
      const m = new THREE.Mesh(liveryGeometry(id + prefix, p.geometry, L, W, H, topMap), livery);
      m.castShadow = true; body.add(m);
    } else {
      const m = new THREE.Mesh(p.geometry, p.material); m.castShadow = true; body.add(m);
    }
  }
  // light bar: blue | grey | red
  const bar = new THREE.Group();
  bar.position.set(-0.15 * L, H + 0.02, 0);
  bar.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, W * 0.7), new THREE.MeshLambertMaterial({ color: 0x222222 })));
  const seg = W * 0.24;
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, seg), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
  const grey = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, seg * 0.8), new THREE.MeshLambertMaterial({ color: 0xc8ccd2 }));
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, seg), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  blue.position.set(0, 0.06, seg * 0.9); grey.position.y = 0.06; red.position.set(0, 0.06, -seg * 0.9);
  bar.add(blue, grey, red);
  const glowT = shadowTexture();
  const glow = (color, z) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(1.2, 1.2, 1); sp.position.set(0, 0.08, z); bar.add(sp); return sp;
  };
  const glowBlue = glow(0x3a6bff, seg * 0.9), glowRed = glow(0xff3030, -seg * 0.9);
  body.add(bar);
  const pm = new THREE.MeshBasicMaterial({ map: plateTexture('01 YPX 777') });
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.115), pm);
  fp.rotation.y = Math.PI / 2; fp.position.set(box.max.x + 0.02, 0.42, 0); body.add(fp);
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.115), pm);
  bp.rotation.y = -Math.PI / 2; bp.position.set(box.min.x - 0.02, 0.55, 0); body.add(bp);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.08, W * 1.45),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.55, color: 0x000000 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012;
  g.add(shadow);
  const signal = new THREE.Object3D(); signal.visible = false; body.add(signal);
  g.userData = { lights: { red, blue, glowRed, glowBlue }, wheels: [], body, signal };
  return g;
}
