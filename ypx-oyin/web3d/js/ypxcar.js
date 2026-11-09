// YPX patrol sedan built from the user's drawing: the side silhouette is extruded across the
// car's width and the drawing's side / top / front / rear views are mapped onto the faces.
import * as THREE from './three.module.min.js';
import { YPX_CAR } from './ypxcar_data.js';
import { YPX_CAR2 } from './ypxcar2_data.js';
const VARIANTS = { 1: YPX_CAR, 2: YPX_CAR2 };

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

// linear fit value = a * coord + b from the silhouette points
function fit(points, ci, vi) {
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  const n = points.length;
  for (const p of points) { sx += p[ci]; sy += p[vi]; sxx += p[ci] * p[ci]; sxy += p[ci] * p[vi]; }
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return [a, (sy - a * sx) / n];
}

const bodyGeos = {};
function buildBodyGeometry(D) {
  const { poly, width: W, length: L, height: H } = D;
  const shape = new THREE.Shape();
  poly.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const BV = 0.045; // rounded edges
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: W - 2 * BV, bevelEnabled: true, bevelThickness: BV, bevelSize: BV * 0.6, bevelSegments: 3, curveSegments: 1,
  }).toNonIndexed();
  g.translate(0, 0, -(W - 2 * BV) / 2);
  const [ua, ub] = fit(poly, 0, 2), [va, vb] = fit(poly, 1, 3);
  const pos = g.attributes.position;
  const buckets = [[], [], [], [], [], []]; // sideL, sideR, top, front, rear, bottom
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    let k;
    if (n.z < -0.75) k = 0; else if (n.z > 0.75) k = 1;
    else if (n.y > 0.35) k = 2; else if (n.y < -0.35) k = 5;
    else k = n.x > 0 ? 3 : 4;
    buckets[k].push([a.clone(), b.clone(), c.clone()]);
  }
  const P = [], U = [], groups = [];
  const uvOf = (k, p) => {
    switch (k) {
      case 0: return [ua * p.x + ub, va * p.y + vb];                 // left side: drawing as is
      case 1: return [1 - (ua * p.x + ub), va * p.y + vb];           // right side: mirrored drawing (text fixed)
      case 2: return [(L / 2 - p.x) / L, 0.5 + p.z / W];             // top view, front at the image's left
      case 3: return [0.5 - p.z / W, Math.min(1, p.y / H)];          // front view
      case 4: return [0.5 + p.z / W, Math.min(1, p.y / H)];          // rear view
      default: return [0, 0];
    }
  };
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
  return geo;
}

export function makeYpxCar(variant = 1) {
  const D = VARIANTS[variant] || YPX_CAR;
  const bodyGeo = bodyGeos[variant] || (bodyGeos[variant] = buildBodyGeometry(D));
  const P = D.prefix || 'ypx';
  const { width: W, wheelR, wheelX, wheelY, barX, roofY } = D;
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const lam = map => new THREE.MeshLambertMaterial({ map });
  // glossy car paint
  const paint = map => new THREE.MeshPhongMaterial({ map, shininess: 90, specular: 0x666666 });
  const shell = new THREE.Mesh(bodyGeo, [
    paint(tex(P + '_side_l')), paint(tex(P + '_side_r')), paint(tex(P + '_top')),
    paint(tex(P + '_front')), paint(tex(P + '_rear')), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  ]);
  shell.castShadow = true; shell.receiveShadow = true;
  body.add(shell);

  // wheels with the drawing's rim on both faces
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.26, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const rim = lam(tex(P + '_wheel'));
  const tyre = new THREE.MeshLambertMaterial({ color: 0x151515 });
  const wheels = [];
  for (const x of wheelX) for (const s of [1, -1]) {
    const w = new THREE.Mesh(wheelGeo, [tyre, rim, rim]);
    w.position.set(x, wheelY, s * (W / 2 - 0.1));
    w.castShadow = true;
    body.add(w); wheels.push(w);
  }

  // light bar: blue | grey | red (as in the drawing's front view)
  const bar = new THREE.Group();
  bar.position.set(barX, roofY + 0.06, 0);
  bar.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, W * 0.78), new THREE.MeshLambertMaterial({ color: 0x222222 })));
  const seg = W * 0.26;
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, seg), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
  const grey = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, seg * 0.8), new THREE.MeshLambertMaterial({ color: 0xc8ccd2 }));
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, seg), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  blue.position.set(0, 0.06, seg * 0.9); grey.position.y = 0.06; red.position.set(0, 0.06, -seg * 0.9);
  bar.add(blue, grey, red);
  body.add(bar);

  // light-bar glow
  const glowTex = radialTexture();
  const glow = (color, z) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(1.3, 1.3, 1); sp.position.set(0, 0.08, z);
    bar.add(sp); return sp;
  };
  const glowBlue = glow(0x3a6bff, seg * 0.9), glowRed = glow(0xff3030, -seg * 0.9);

  // side mirrors
  const { mirrorX, mirrorY, length: L } = D;
  const white = new THREE.MeshPhongMaterial({ color: 0xf2f4f6, shininess: 90, specular: 0x666666 });
  const black = new THREE.MeshLambertMaterial({ color: 0x1b1d22 });
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.1), black); arm.position.z = s * 0.05;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.2), white); head.position.z = s * 0.15;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.17), new THREE.MeshPhongMaterial({ color: 0x8fa9c0, shininess: 120, specular: 0xffffff }));
    glass.position.set(-0.055, 0, s * 0.15);
    m.add(arm, head, glass);
    m.position.set(mirrorX, mirrorY, s * (W / 2 - 0.02));
    head.castShadow = true;
    body.add(m);
  }

  // soft contact shadow under the car
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.08, W * 1.45),
    new THREE.MeshBasicMaterial({ map: radialTexture(true), transparent: true, depthWrite: false, opacity: 0.55, color: 0x000000 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012;
  g.add(shadow);

  const signal = new THREE.Object3D(); signal.visible = false; body.add(signal);
  g.userData = { lights: { red, blue, glowRed, glowBlue }, wheels, body, signal };
  g.scale.setScalar(0.9); // match the other cars on the street
  return g;
}

// radial gradient: soft glow (default) or an elliptical blob for the contact shadow
let glowCache = null, shadowCache = null;
function radialTexture(shadow = false) {
  if (shadow ? shadowCache : glowCache) return shadow ? shadowCache : glowCache;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (shadow) { gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); }
  else { gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); }
  c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  if (shadow) shadowCache = t; else glowCache = t;
  return t;
}
