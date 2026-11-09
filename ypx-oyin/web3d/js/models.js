// Procedural low-poly models: officer, cars, buildings, trees, booth, traffic light.
import * as THREE from './three.module.min.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, seg, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ---------- officer ----------
export function makeOfficer(uniform) {
  const g = new THREE.Group();
  const skin = mat(0xd9a77c);
  const parts = {};

  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.add(box(0.2, 0.85, 0.22, mat(uniform.pants), 0, -0.42, 0));
  legR.add(box(0.2, 0.85, 0.22, mat(uniform.pants), 0, -0.42, 0));
  legL.add(box(0.22, 0.12, 0.32, mat(0x111111), 0, -0.86, 0.05));
  legR.add(box(0.22, 0.12, 0.32, mat(0x111111), 0, -0.86, 0.05));
  legL.position.set(-0.13, 0.92, 0); legR.position.set(0.13, 0.92, 0);
  g.add(legL, legR);

  const torso = new THREE.Group();
  torso.position.y = 0.92;
  const shirt = box(0.54, 0.62, 0.3, mat(uniform.shirt), 0, 0.32, 0);
  torso.add(shirt);
  if (uniform.coat) torso.add(box(0.58, 0.3, 0.33, mat(uniform.shirt), 0, -0.02, 0));
  if (uniform.vest) {
    torso.add(box(0.56, 0.4, 0.32, mat(0xc9f24a), 0, 0.34, 0));
    torso.add(box(0.57, 0.05, 0.33, mat(0xdddddd), 0, 0.42, 0));
    torso.add(box(0.57, 0.05, 0.33, mat(0xdddddd), 0, 0.26, 0));
  }
  torso.add(box(0.56, 0.06, 0.32, mat(0x111111), 0, 0.03, 0)); // belt
  torso.add(box(0.08, 0.08, 0.02, mat(0xd9b44a), 0.14, 0.52, 0.17)); // badge
  // head
  const head = new THREE.Group();
  head.position.y = 0.82;
  head.add(box(0.3, 0.32, 0.3, skin, 0, 0.0, 0));
  head.add(box(0.06, 0.04, 0.02, mat(0x222222), -0.07, 0.03, 0.16));
  head.add(box(0.06, 0.04, 0.02, mat(0x222222), 0.07, 0.03, 0.16));
  head.add(box(0.14, 0.03, 0.02, mat(0x3a2418), 0, -0.07, 0.16)); // moustache
  const cap = new THREE.Group();
  cap.add(cyl(0.2, 0.18, 0.12, 10, mat(uniform.coat ? 0x1e283b : 0x2b3a55), 0, 0.2, 0));
  cap.add(cyl(0.24, 0.24, 0.03, 10, mat(0x2b3a55), 0, 0.26, 0.02));
  cap.add(box(0.3, 0.02, 0.14, mat(0x111111), 0, 0.15, 0.18)); // visor
  cap.add(box(0.07, 0.07, 0.02, mat(0xd9b44a), 0, 0.22, 0.2));
  head.add(cap);
  torso.add(head);

  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.add(box(0.15, 0.6, 0.16, mat(uniform.shirt), 0, -0.28, 0));
  armL.add(box(0.13, 0.12, 0.13, skin, 0, -0.62, 0));
  armR.add(box(0.15, 0.6, 0.16, mat(uniform.shirt), 0, -0.28, 0));
  armR.add(box(0.13, 0.12, 0.13, skin, 0, -0.62, 0));
  // baton (jezl) in right hand
  const baton = new THREE.Group();
  for (let i = 0; i < 6; i++) baton.add(cyl(0.025, 0.025, 0.08, 6, mat(i % 2 ? 0x111111 : 0xffffff), 0, -0.04 - i * 0.08, 0));
  baton.add(cyl(0.05, 0.05, 0.03, 8, mat(0xe5484d), 0, -0.5, 0));
  baton.position.set(0, -0.66, 0.05);
  baton.rotation.x = -1.2;
  armR.add(baton);
  armL.position.set(-0.36, 0.6, 0); armR.position.set(0.36, 0.6, 0);
  torso.add(armL, armR);
  g.add(torso);

  Object.assign(parts, { legL, legR, armL, armR, torso, head, baton });
  g.userData.parts = parts;
  return g;
}

export function animateOfficer(officer, t, speed, pose) {
  const p = officer.userData.parts;
  const s = Math.min(speed / 3, 1);
  const sw = Math.sin(t * 9) * 0.6 * s;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw * 0.8;
  p.torso.position.y = 0.92 + Math.abs(Math.sin(t * 9)) * 0.04 * s;
  if (pose === 'jezl') { p.armR.rotation.x = -2.6; p.armR.rotation.z = 0.2; }
  else if (pose === 'whistle') { p.armR.rotation.x = -2.1; p.armR.rotation.z = 0.6; }
  else { p.armR.rotation.x = sw * 0.8; p.armR.rotation.z = 0; }
}

// ---------- faces (2D canvas portraits, shared by UI) ----------
export function drawFace(canvas, f) {
  const c = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  c.fillStyle = f.bg || '#cfd8e3'; c.fillRect(0, 0, W, H);
  // shoulders
  c.fillStyle = f.shirt; c.beginPath(); c.ellipse(W / 2, H * 1.02, W * 0.48, H * 0.3, 0, 0, 7); c.fill();
  // neck + head
  c.fillStyle = f.skin; c.fillRect(W * 0.42, H * 0.58, W * 0.16, H * 0.16);
  c.beginPath(); c.ellipse(W / 2, H * 0.45, W * 0.23, H * 0.25, 0, 0, 7); c.fill();
  // hair
  c.fillStyle = f.hair;
  if (f.hairStyle === 0) { c.beginPath(); c.ellipse(W / 2, H * 0.3, W * 0.24, H * 0.12, 0, Math.PI, 0); c.fill(); }
  else if (f.hairStyle === 1) { c.fillRect(W * 0.27, H * 0.2, W * 0.46, H * 0.09); }
  // doppi (skullcap)
  if (f.doppi) {
    c.fillStyle = '#1a1a1a'; c.beginPath(); c.moveTo(W * 0.28, H * 0.27); c.lineTo(W * 0.72, H * 0.27); c.lineTo(W * 0.66, H * 0.14); c.lineTo(W * 0.34, H * 0.14); c.fill();
    c.strokeStyle = '#eee'; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(W * (0.38 + i * 0.12), H * 0.21, W * 0.03, 0, 7); c.stroke(); }
  }
  // eyes
  c.fillStyle = '#222';
  c.beginPath(); c.arc(W * 0.42, H * 0.44, W * 0.022, 0, 7); c.arc(W * 0.58, H * 0.44, W * 0.022, 0, 7); c.fill();
  c.strokeStyle = f.hair; c.lineWidth = 3;
  c.beginPath(); c.moveTo(W * 0.37, H * 0.39); c.lineTo(W * 0.46, H * 0.385); c.moveTo(W * 0.54, H * 0.385); c.lineTo(W * 0.63, H * 0.39); c.stroke();
  if (f.glasses) {
    c.strokeStyle = '#111'; c.lineWidth = 2;
    c.strokeRect(W * 0.35, H * 0.4, W * 0.13, H * 0.08); c.strokeRect(W * 0.52, H * 0.4, W * 0.13, H * 0.08);
    c.beginPath(); c.moveTo(W * 0.48, H * 0.44); c.lineTo(W * 0.52, H * 0.44); c.stroke();
  }
  // nose + mouth
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(W * 0.5, H * 0.46); c.lineTo(W * 0.48, H * 0.53); c.lineTo(W * 0.52, H * 0.53); c.stroke();
  if (f.moustache) { c.fillStyle = f.hair; c.fillRect(W * 0.42, H * 0.555, W * 0.16, H * 0.03); }
  if (f.beard) { c.fillStyle = f.hair; c.beginPath(); c.ellipse(W / 2, H * 0.63, W * 0.15, H * 0.07, 0, 0, Math.PI); c.fill(); }
  c.strokeStyle = '#7a3b2e'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(W * 0.45, H * 0.6); c.quadraticCurveTo(W * 0.5, H * (f.drunk ? 0.63 : 0.615), W * 0.55, H * 0.6); c.stroke();
  if (f.drunk) { c.fillStyle = 'rgba(220,60,60,.25)'; c.beginPath(); c.arc(W * 0.37, H * 0.52, W * 0.05, 0, 7); c.arc(W * 0.63, H * 0.52, W * 0.05, 0, 7); c.fill(); }
}

export function randomFace(rng = Math.random) {
  const pick = a => a[Math.floor(rng() * a.length)];
  return {
    skin: pick(['#e0b08a', '#d29a6e', '#c58c5e', '#e8c09c', '#b97f53']),
    hair: pick(['#1a1410', '#2b1d14', '#3b2a1e', '#555', '#8a8a8a']),
    hairStyle: Math.floor(rng() * 3),
    moustache: rng() < 0.45, beard: rng() < 0.2, glasses: rng() < 0.2, doppi: rng() < 0.25,
    shirt: pick(['#2b3a55', '#f2f2f2', '#6b4a2f', '#3a5f3a', '#8a2b2b', '#444']),
  };
}

// ---------- cars ----------
function windowMat(tinted) { return mat(tinted ? 0x050608 : 0x6f8ca8, tinted ? {} : { transparent: true, opacity: 0.75 }); }

export function plateTexture(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 56;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 56);
  c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeRect(2, 2, 252, 52);
  c.beginPath(); c.moveTo(52, 4); c.lineTo(52, 52); c.stroke();
  c.fillStyle = '#111'; c.font = 'bold 34px sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center';
  const [reg, ...rest] = text.split(' ');
  c.fillText(reg, 27, 30);
  c.fillText(rest.join(' '), 150, 30);
  c.fillStyle = '#1e5bb8'; c.fillRect(220, 8, 26, 16); c.fillStyle = '#2fbf71'; c.fillRect(220, 24, 26, 8);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// opts: { type, color, tinted, noPlate, plate, brokenLight, baldTire, police, driverSkin }
export function makeCar(type, opts = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const { w, l, h } = type;
  const paint = mat(opts.color);
  const dark = mat(0x1a1a1a);
  const wheelY = 0.34;
  // lower body
  const lowH = type.id === 'van' ? h * 0.5 : h * 0.45;
  body.add(box(l, lowH, w, paint, 0, wheelY + lowH / 2 - 0.05, 0));
  // cabin
  let cabL = l * 0.52, cabX = -l * 0.05, cabH = h - lowH - 0.25;
  if (type.id === 'van') { cabL = l * 0.82; cabX = -l * 0.06; }
  if (type.id === 'hatch') { cabL = l * 0.58; cabX = -l * 0.1; }
  if (type.id === 'suv') { cabL = l * 0.62; cabX = -l * 0.08; }
  const cabY = wheelY + lowH - 0.05 + cabH / 2;
  body.add(box(cabL, cabH, w * 0.9, paint, cabX, cabY, 0));
  const wm = windowMat(opts.tinted);
  // side windows
  body.add(box(cabL * 0.86, cabH * 0.62, w * 0.92, wm, cabX, cabY + 0.02, 0));
  // windshield + rear window
  const ws = box(0.06, cabH * 0.7, w * 0.8, windowMat(false), cabX + cabL / 2 + 0.01, cabY + 0.02, 0);
  body.add(ws);
  body.add(box(0.06, cabH * 0.65, w * 0.78, wm, cabX - cabL / 2 - 0.01, cabY + 0.02, 0));
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheels = [];
  for (const sx of [l * 0.32, -l * 0.32]) for (const sz of [w / 2 - 0.08, -w / 2 + 0.08]) {
    const bald = opts.baldTire && sx > 0 && sz > 0;
    const wh = new THREE.Mesh(wheelGeo, mat(bald ? 0x8d8678 : 0x151515));
    wh.position.set(sx, wheelY, sz); wh.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.26, 8).rotateX(Math.PI / 2), mat(0xaab0b8));
    wh.add(hub);
    body.add(wh); wheels.push(wh);
  }
  // headlights (front = +x)
  const hl = mat(0xfff6c8, { emissive: 0x555533 });
  const broken = mat(0x2a2a2a);
  body.add(box(0.06, 0.14, 0.32, hl, l / 2, wheelY + lowH * 0.65, w / 2 - 0.25));
  body.add(box(0.06, 0.14, 0.32, opts.brokenLight ? broken : hl, l / 2, wheelY + lowH * 0.65, -w / 2 + 0.25));
  // taillights
  const tl = mat(0x8a1010, { emissive: 0x330000 });
  body.add(box(0.06, 0.14, 0.3, tl, -l / 2, wheelY + lowH * 0.7, w / 2 - 0.22));
  body.add(box(0.06, 0.14, 0.3, tl, -l / 2, wheelY + lowH * 0.7, -w / 2 + 0.22));
  // bumpers
  body.add(box(0.12, 0.16, w * 0.98, dark, l / 2 + 0.02, wheelY + 0.05, 0));
  body.add(box(0.12, 0.16, w * 0.98, dark, -l / 2 - 0.02, wheelY + 0.05, 0));
  // plates
  if (!opts.noPlate && opts.plate) {
    const pt = plateTexture(opts.plate);
    const pm = new THREE.MeshBasicMaterial({ map: pt });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.12), pm);
    fp.rotation.y = Math.PI / 2; fp.position.set(l / 2 + 0.09, wheelY + 0.12, 0); body.add(fp);
    const bp = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.12), pm);
    bp.rotation.y = -Math.PI / 2; bp.position.set(-l / 2 - 0.09, wheelY + 0.12, 0); body.add(bp);
  }
  // driver (left seat = -z side when heading +x)
  if (!opts.police) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mat(opts.driverSkin || 0xd29a6e));
    head.position.set(cabX + cabL * 0.12, cabY + 0.05, -w * 0.22);
    body.add(head);
  }
  // police livery + light bar
  if (opts.police) {
    body.add(box(l * 0.98, 0.16, w + 0.01, mat(0x1f5fd0), 0, wheelY + lowH * 0.55, 0));
    const bar = new THREE.Group();
    bar.position.set(cabX, cabY + cabH / 2 + 0.08, 0);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.45), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.45), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    red.position.z = 0.25; blue.position.z = -0.25;
    bar.add(red, blue);
    body.add(bar);
    g.userData.lights = { red, blue };
    // "YPX" text on doors
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('YPX', 128, 34);
    const tex = new THREE.CanvasTexture(cv);
    const tm = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    for (const s of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), tm);
      p.position.set(0, wheelY + lowH * 0.55, s * (w / 2 + 0.02));
      if (s < 0) p.rotation.y = Math.PI;
      body.add(p);
    }
  }
  // turn signal (right side, for pull-over)
  const sig = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffa000 }));
  sig.position.set(l / 2 - 0.05, wheelY + lowH * 0.65, w / 2 + 0.02);
  sig.visible = false;
  body.add(sig);
  g.userData.signal = sig;
  g.userData.wheels = wheels;
  g.userData.body = body;
  return g;
}

// ---------- environment pieces ----------
function windowsTexture(cols, rows, wall) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = wall; c.fillRect(0, 0, 256, 512);
  const cw = 256 / cols, rh = 512 / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    c.fillStyle = Math.random() < 0.15 ? '#e9d79a' : '#4a5d72';
    c.fillRect(x * cw + cw * 0.2, y * rh + rh * 0.22, cw * 0.6, rh * 0.5);
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x * cw + cw * 0.15, y * rh + rh * 0.72, cw * 0.7, rh * 0.06); // balcony line
  }
  // panel seams
  c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 2;
  for (let y = 0; y <= rows; y++) { c.beginPath(); c.moveTo(0, y * rh); c.lineTo(256, y * rh); c.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const buildingTextures = [];
export function makeBuilding(w, h, d) {
  if (!buildingTextures.length) {
    for (const wall of ['#d9d2c3', '#c9c1b0', '#e3dccd', '#cdbfa6', '#bfc7cc']) buildingTextures.push(windowsTexture(6, 9, wall));
  }
  const tex = buildingTextures[Math.floor(Math.random() * buildingTextures.length)].clone();
  tex.needsUpdate = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 27)));
  const side = new THREE.MeshLambertMaterial({ map: tex });
  const roof = mat(0x6b6b6b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, side, side]);
  m.position.y = h / 2;
  m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m);
  // ground-floor shop strip
  g.add(box(w + 0.1, 3, d + 0.1, mat(0x8e8577), 0, 1.5, 0));
  return g;
}

export function makeChinor(scale = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.22 * scale, 0.32 * scale, 3.2 * scale, 7, mat(0xd8d2c0), 0, 1.6 * scale, 0)); // whitewashed trunk base look
  g.add(cyl(0.2 * scale, 0.22 * scale, 2.5 * scale, 7, mat(0x8a7c64), 0, 4.2 * scale, 0));
  const leaf = mat(0x3f7f3a), leaf2 = mat(0x4f9445);
  const blobs = [[0, 6, 0, 2.2], [1.2, 5.4, 0.4, 1.6], [-1.1, 5.6, -0.3, 1.7], [0.3, 7.1, -0.5, 1.6], [-0.4, 5.2, 1, 1.4]];
  blobs.forEach(([x, y, z, r], i) => {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r * scale, 0), i % 2 ? leaf : leaf2);
    s.position.set(x * scale, y * scale, z * scale); s.castShadow = true;
    g.add(s);
  });
  return g;
}

export function makeLamp() {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.1, 7, 6, mat(0x555a60), 0, 3.5, 0));
  g.add(box(1.4, 0.08, 0.08, mat(0x555a60), -0.6, 7, 0));
  g.add(box(0.5, 0.12, 0.25, mat(0xfff3c0, { emissive: 0x333322 }), -1.2, 6.92, 0));
  return g;
}

export function makeBooth() {
  const g = new THREE.Group();
  g.add(box(2.6, 0.2, 2.6, mat(0x9a9a9a), 0, 0.1, 0));
  g.add(box(2.4, 1.0, 2.4, mat(0xf2f2f2), 0, 0.7, 0));
  // glass walls
  g.add(box(2.42, 1.4, 2.42, mat(0x7fa6c4, { transparent: true, opacity: 0.55 }), 0, 1.9, 0));
  g.add(box(2.7, 0.3, 2.7, mat(0x1f5fd0), 0, 2.75, 0));
  g.add(box(2.9, 0.12, 2.9, mat(0xeeeeee), 0, 2.96, 0));
  // sign
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const c = cv.getContext('2d'); c.fillStyle = '#1f5fd0'; c.fillRect(0, 0, 256, 64);
  c.fillStyle = '#fff'; c.font = 'bold 46px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('YPX', 128, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.28), new THREE.MeshBasicMaterial({ map: tex }));
    const a = i * Math.PI / 2;
    p.position.set(Math.sin(a) * 1.36, 2.75, Math.cos(a) * 1.36);
    p.rotation.y = a;
    g.add(p);
  }
  return g;
}

export function makeTrafficLight() {
  const g = new THREE.Group();
  g.add(cyl(0.08, 0.1, 3.2, 6, mat(0x333333), 0, 1.6, 0));
  g.add(box(0.4, 1.1, 0.35, mat(0x1a1a1a), 0, 3.6, 0));
  const lamps = {};
  [['red', 0xff2a2a, 3.95], ['yellow', 0xffc020, 3.6], ['green', 0x20e060, 3.25]].forEach(([n, col, y]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    m.position.set(-0.19, y, 0);
    m.userData.on = col;
    g.add(m); lamps[n] = m;
  });
  g.userData.lamps = lamps;
  return g;
}

export function setLight(tl, state) {
  for (const [n, m] of Object.entries(tl.userData.lamps)) m.material.color.setHex(n === state ? m.userData.on : 0x222222);
}

export function makeSpeedSign(limit) {
  const g = new THREE.Group();
  g.add(cyl(0.05, 0.05, 2.6, 6, mat(0x777777), 0, 1.3, 0));
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill();
  c.strokeStyle = '#d42a2a'; c.lineWidth = 14; c.beginPath(); c.arc(64, 64, 52, 0, 7); c.stroke();
  c.fillStyle = '#111'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(limit, 64, 68);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  s.position.y = 2.7;
  g.add(s);
  return g;
}

export function makeMarker() {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 4), new THREE.MeshBasicMaterial({ color: 0xffd400 }));
  m.rotation.x = Math.PI;
  return m;
}
