// Full 3D street cars loaded from slimmed GLB models (see tools/slim.mjs).
// Models (all CC BY 4.0, credited in the help screen and README):
//   Nexia 2 — uzb_rx7; Chevrolet Malibu 2022 — slavanik24250794; Chevrolet Damas — own.guest;
//   Chevrolet Nexia3 Midnight — doniyorgroup (Sketchfab).
import * as THREE from './three.module.min.js';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import { plateTexture } from './models.js';

export const GLB_MODELS = [
  { id: 'nexia2', name: 'Chevrolet Nexia 2', file: 'models/nexia2.glb', length: 4.48, width: 1.66, height: 1.39, paint: 'carpaint', glass: ['windowglass'] },
  { id: 'nexia3', name: 'Chevrolet Nexia 3', file: 'models/nexia3.glb', length: 4.31, width: 1.71, height: 1.505, paint: 'Matte_FFFFFFFF', glass: ['Matte_827F7F7F'],
    unskew: [0.99124, -0.01391, 0.13134, 0.12391, 0.44202, -0.8884, -0.0457, 0.8969, 0.43988] },
  { id: 'malibu', name: 'Chevrolet Malibu', file: 'models/malibu.glb', length: 4.93, width: 1.85, height: 1.46, paint: 'malibupaint', glass: ['malibuglass'] },
  { id: 'damas', name: 'Chevrolet Damas', file: 'models/damas.glb', length: 3.23, width: 1.40, height: 1.90, paint: 'material_3', glass: ['material_5'], flip: true },
];

const loaded = {}; // id -> { template, box }
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
        const g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        g.deleteAttribute('normal');
        g.computeVertexNormals();
        const m = o.material;
        const hex = /Matte_([0-9A-F]{2})([0-9A-F]{6})/i.exec(m.name || '');
        if (hex && !m.map) { // some exporters keep the colour only in the material name
          m.color.set('#' + hex[2]);
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
  g.userData = { wheels: [], body, signal: sig };
  return g;
}
