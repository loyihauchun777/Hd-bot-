// Static city scene around the YPX post.
import * as THREE from './three.module.min.js';
import { mat, makeBuilding, makeChinor, makeLamp, makeBooth, makeTrafficLight, makeSpeedSign } from './models.js';
import { SPEED_LIMIT } from './data.js';

export const ROAD = {
  half: 7,
  laneZ: [1.75, 5.25, -1.75, -5.25], // 0,1: towards +x (near side); 2,3: towards -x
  laneDir: [1, 1, -1, -1],
  bayZ: 8.5, bayFrom: -12, bayTo: 18,
  stopLineNear: -31.5, stopLineFar: -24.5, crossX: -28,
  length: 300,
};

function plane(w, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
  return m;
}

function slab(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z); m.receiveShadow = true;
  return m;
}

export function buildWorld(scene) {
  const L = ROAD.length;
  scene.background = new THREE.Color(0x9fd0f0);
  scene.fog = new THREE.Fog(0x9fd0f0, 70, 160);

  const hemi = new THREE.HemisphereLight(0xdff1ff, 0x5a6b4a, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(-30, 50, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 140;
  scene.add(sun); scene.add(sun.target);

  // ground
  scene.add(plane(L, 120, 0x6f9a52, 0, -0.02, 0));
  // asphalt
  const asphaltTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d'); c.fillStyle = '#4a4e55'; c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},0.05)`; c.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(L / 8, 2); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(L, ROAD.half * 2), new THREE.MeshLambertMaterial({ map: asphaltTex }));
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true;
  scene.add(road);
  // bay asphalt
  scene.add(plane(ROAD.bayTo - ROAD.bayFrom, 3, 0x4a4e55, (ROAD.bayFrom + ROAD.bayTo) / 2, 0.005, ROAD.bayZ));

  // markings
  const white = 0xf0f0f0;
  scene.add(plane(L, 0.15, 0xf2c230, 0, 0.01, -0.12)); // double centre line (yellow)
  scene.add(plane(L, 0.15, 0xf2c230, 0, 0.01, 0.12));
  for (let x = -L / 2; x < L / 2; x += 9) {
    if (Math.abs(x - ROAD.crossX) < 5) continue;
    scene.add(plane(4, 0.15, white, x, 0.01, 3.5));
    scene.add(plane(4, 0.15, white, x, 0.01, -3.5));
  }
  scene.add(plane(L, 0.15, white, 0, 0.01, 6.85));
  scene.add(plane(L, 0.15, white, 0, 0.01, -6.85));
  // crosswalk + stop lines
  for (let z = -6.4; z <= 6.4; z += 1.2) scene.add(plane(3, 0.6, white, ROAD.crossX, 0.012, z));
  scene.add(plane(0.4, 7, white, ROAD.stopLineNear, 0.012, 3.5));
  scene.add(plane(0.4, 7, white, ROAD.stopLineFar, 0.012, -3.5));

  // sidewalks (near side has the bay cut out)
  const sw = 0xb9b4a8, curb = 0xdedad0;
  const nearLeftLen = ROAD.bayFrom + L / 2, nearRightLen = L / 2 - ROAD.bayTo;
  scene.add(slab(nearLeftLen, 0.15, 3, sw, -L / 2 + nearLeftLen / 2, 0.075, 8.5));
  scene.add(slab(nearRightLen, 0.15, 3, sw, ROAD.bayTo + nearRightLen / 2, 0.075, 8.5));
  scene.add(slab(L, 0.15, 3, sw, 0, 0.075, 11.5));
  scene.add(slab(L, 0.18, 0.2, curb, 0, 0.09, 7.05));
  scene.add(slab(L, 0.15, 4, sw, 0, 0.075, -9));
  scene.add(slab(L, 0.18, 0.2, curb, 0, 0.09, -7.05));
  // ariq (irrigation channels) with water
  for (const z of [13.6, -11.6]) {
    scene.add(slab(L, 0.3, 0.12, 0x9a968c, 0, -0.05, z - 0.45));
    scene.add(slab(L, 0.3, 0.12, 0x9a968c, 0, -0.05, z + 0.45));
    scene.add(plane(L, 0.8, 0x3f7fa8, 0, -0.12, z));
  }

  // trees, lamps
  for (let x = -L / 2 + 6; x < L / 2; x += 11) {
    const t1 = makeChinor(0.9 + Math.random() * 0.35); t1.position.set(x + Math.random() * 2, 0, 20.5); t1.rotation.y = Math.random() * 6; scene.add(t1);
    const t2 = makeChinor(0.9 + Math.random() * 0.35); t2.position.set(x + 4 + Math.random() * 2, 0, -13.4); t2.rotation.y = Math.random() * 6; scene.add(t2);
  }
  for (let x = -L / 2 + 10; x < L / 2; x += 26) {
    const l1 = makeLamp(); l1.position.set(x, 0, 7.4); l1.rotation.y = -Math.PI / 2; scene.add(l1);
    const l2 = makeLamp(); l2.position.set(x + 13, 0, -7.4); l2.rotation.y = Math.PI / 2; scene.add(l2);
  }

  // apartment blocks
  for (let x = -L / 2 + 10; x < L / 2; x += 34 + Math.random() * 8) {
    const floors = [4, 5, 9, 9, 9, 12][Math.floor(Math.random() * 6)];
    const b = makeBuilding(24 + Math.random() * 10, floors * 3, 11); b.position.set(x, 0, 27 + Math.random() * 3); scene.add(b);
  }
  for (let x = -L / 2 + 20; x < L / 2; x += 34 + Math.random() * 8) {
    const floors = [4, 5, 9, 9, 9, 12][Math.floor(Math.random() * 6)];
    const b = makeBuilding(24 + Math.random() * 10, floors * 3, 11); b.position.set(x, 0, -25 - Math.random() * 3); scene.add(b);
  }

  // post booth
  const booth = makeBooth(); booth.position.set(-16, 0.15, 11.6); scene.add(booth);

  // traffic lights
  const tlNear = makeTrafficLight(); tlNear.position.set(ROAD.stopLineNear, 0.15, 7.6); scene.add(tlNear);
  const tlFar = makeTrafficLight(); tlFar.position.set(ROAD.stopLineFar, 0.15, -7.6); tlFar.rotation.y = Math.PI; scene.add(tlFar);

  // speed limit signs
  const s1 = makeSpeedSign(SPEED_LIMIT); s1.position.set(-48, 0.15, 7.7); s1.rotation.y = -Math.PI / 2; scene.add(s1);
  const s2 = makeSpeedSign(SPEED_LIMIT); s2.position.set(10, 0.15, 10.2); s2.rotation.y = -Math.PI / 2; scene.add(s2);
  const s3 = makeSpeedSign(SPEED_LIMIT); s3.position.set(40, 0.15, -7.7); s3.rotation.y = Math.PI / 2; scene.add(s3);

  return { sun, trafficLights: [tlNear, tlFar], booth };
}
