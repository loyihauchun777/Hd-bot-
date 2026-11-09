// Traffic simulation: spawning, lane following, traffic light, pull-over and leaving.
import { makeCar, randomFace, setLight } from './models.js';
import { ROAD } from './world.js';
import { CAR_TYPES, CAR_COLORS, FIRST_NAMES, LAST_NAMES, SPEED_LIMIT } from './data.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const chance = p => Math.random() < p;

function plateText() {
  const L = () => 'ABCDEFHKMOPTXYZ'[Math.floor(Math.random() * 15)];
  const n = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return pick(['01', '10', '20', '25', '30', '40', '50', '60', '70', '75', '80', '85', '90', '95']) + ' ' + L() + ' ' + n + ' ' + L() + L();
}

function otherPlate(p) { let q; do { q = plateText(); } while (q === p); return q; }

const fmtDate = d => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
function dateOffset(days) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + days); return fmtDate(d); }

// Build the hidden "truth" for a driver/car.
function makeProfile(nearSide) {
  const type = pick(CAR_TYPES);
  const [colorName, color] = pick(CAR_COLORS);
  const first = pick(FIRST_NAMES), last = pick(LAST_NAMES);
  const face = randomFace();
  const p = {
    type, color, colorName, plate: plateText(),
    name: first + ' ' + last, face, voice: Math.floor(Math.random() * 3),
    road: [], hidden: [], reckless: false, drunk: false, bribe: false,
    speedKmh: Math.round(rand(SPEED_LIMIT - 22, SPEED_LIMIT - 3)),
    tinted: false, noPlate: false, brokenLight: false, baldTire: false,
  };
  if (!nearSide) return p;

  if (chance(0.42)) {
    const r = Math.random();
    if (r < 0.3) { p.road.push('tezlik'); p.speedKmh = Math.round(rand(SPEED_LIMIT + 12, SPEED_LIMIT + 45)); }
    else if (r < 0.5) p.road.push('kamar');
    else if (r < 0.65) p.road.push('telefon');
    else if (r < 0.77) { p.road.push('tonirovka'); p.tinted = true; }
    else if (r < 0.85) { p.road.push('raqamsiz'); p.noPlate = true; }
    else p.reckless = true; // may run the red light
  }
  if (chance(0.08)) { p.reckless = true; }
  // hidden problems
  if (chance(0.12)) p.hidden.push('guvohnoma');
  if (chance(0.06)) p.hidden.push('rasm');
  if (chance(0.15)) p.hidden.push('sugurta');
  if (chance(0.06) && !p.noPlate) p.hidden.push('texraqam');
  if (chance(0.12)) { p.hidden.push('fara'); p.brokenLight = true; }
  if (chance(0.1)) { p.hidden.push('shina'); p.baldTire = true; }
  if (chance(0.1)) {
    p.drunk = true; p.hidden.push('mast'); p.face.drunk = true;
    if (!p.road.length) { p.road.push('tezlik'); p.speedKmh = Math.round(rand(SPEED_LIMIT + 12, SPEED_LIMIT + 35)); }
  }
  p.bribe = chance(p.road.length + p.hidden.length >= 2 ? 0.45 : 0.22);
  // a lawful twist: the car belongs to a relative (not a violation)
  p.ownerName = chance(0.2) ? pick(FIRST_NAMES) + ' ' + last : p.name;
  // documents
  p.docs = {
    licenseName: p.name,
    licenseUntil: p.hidden.includes('guvohnoma') ? dateOffset(-Math.round(rand(5, 400))) : dateOffset(Math.round(rand(60, 3000))),
    licensePhoto: p.hidden.includes('rasm') ? randomFace() : face,
    techPlate: p.hidden.includes('texraqam') ? otherPlate(p.plate) : p.plate,
    techOwner: p.ownerName,
    techModel: type.name + ' (' + colorName + ')',
    insuranceUntil: p.hidden.includes('sugurta') ? dateOffset(-Math.round(rand(3, 200))) : dateOffset(Math.round(rand(20, 360))),
  };
  if (p.noPlate) p.docs.techPlate = p.plate; // plate exists in papers, just missing on car
  return p;
}

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.light = 'green';
    this.lightT = 0;
    this.spawnNear = 1;
    this.spawnFar = 0.5;
    this.lights = null;
  }

  setLights(tls) { this.lights = tls; tls.forEach(t => setLight(t, this.light)); }

  clear() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
  }

  spawn(lane, x) {
    const near = lane < 2;
    const prof = makeProfile(near);
    const dir = ROAD.laneDir[lane];
    const startX = x ?? (dir > 0 ? -ROAD.length / 2 + 8 : ROAD.length / 2 - 8);
    // keep distance from the last car in this lane
    for (const c of this.cars) if (c.lane === lane && c.state === 'drive' && Math.abs(c.x - startX) < 14) return null;
    const mesh = makeCar(prof.type, {
      color: prof.color, tinted: prof.tinted, noPlate: prof.noPlate, plate: prof.plate,
      brokenLight: prof.brokenLight, baldTire: prof.baldTire, driverSkin: parseInt(prof.face.skin.slice(1), 16),
    });
    mesh.rotation.y = dir > 0 ? 0 : Math.PI;
    const car = {
      mesh, prof, lane, dir, x: startX, z: ROAD.laneZ[lane], v: prof.speedKmh / 3.6,
      state: 'drive', crossed: false, len: prof.type.l, weave: Math.random() * 6,
      stopX: 0, fade: 1, flagged: false,
    };
    mesh.position.set(car.x, 0, car.z);
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  front(c) { return c.x + c.dir * c.len / 2; }

  update(dt, t) {
    // traffic light cycle
    this.lightT += dt;
    const dur = { green: 11, yellow: 2.2, red: 7 }[this.light];
    if (this.lightT > dur) {
      this.lightT = 0;
      this.light = this.light === 'green' ? 'yellow' : this.light === 'yellow' ? 'red' : 'green';
      if (this.lights) this.lights.forEach(tl => setLight(tl, this.light));
    }

    // spawning
    this.spawnNear -= dt; this.spawnFar -= dt;
    if (this.spawnNear <= 0) { this.spawn(Math.random() < 0.55 ? 1 : 0); this.spawnNear = rand(1.8, 3.4); }
    if (this.spawnFar <= 0) { this.spawn(Math.random() < 0.5 ? 2 : 3); this.spawnFar = rand(1.6, 3.2); }

    // lane following
    for (let lane = 0; lane < 4; lane++) {
      const dir = ROAD.laneDir[lane];
      const laneZ = ROAD.laneZ[lane];
      const inLane = this.cars.filter(c => c.lane === lane && (c.state === 'drive' || (c.state === 'pullover' && Math.abs(c.z - laneZ) < 1.6)))
        .sort((a, b) => (b.x - a.x) * dir); // front-most first
      let aheadRear = Infinity; // progress coordinate of the rear of the car ahead
      for (const c of inLane) {
        if (c.state !== 'drive') { aheadRear = c.x * dir - c.len / 2; continue; }
        const frontP = c.x * dir + c.len / 2;
        let limitP = aheadRear - 3.5;
        const stopLine = dir > 0 ? ROAD.stopLineNear : -ROAD.stopLineFar; // progress coordinate
        const distLine = stopLine - frontP;
        if (!c.crossed && !c.prof.reckless && distLine > -0.5) {
          if (this.light === 'red' || (this.light === 'yellow' && distLine > 7)) limitP = Math.min(limitP, stopLine);
        }
        const cruise = c.prof.speedKmh / 3.6;
        const gap = limitP - frontP;
        let target = cruise;
        if (gap < 40) target = Math.min(cruise, Math.sqrt(Math.max(0, gap) * 2 * 5.5));
        if (target < c.v) c.v = Math.max(target, c.v - 9 * dt); else c.v = Math.min(target, c.v + 3.5 * dt);
        let np = frontP + c.v * dt;
        if (np > limitP && gap >= 0) { np = Math.max(frontP, limitP); c.v = Math.min(c.v, 0.5); }
        c.x = (np - c.len / 2) * dir;
        if (!c.crossed && np > stopLine + 0.3) {
          c.crossed = true;
          if (this.light === 'red' && lane < 2 && !c.prof.road.includes('qizil')) c.prof.road.push('qizil');
        }
        aheadRear = c.x * dir - c.len / 2;
        // drunk weaving
        c.z = laneZ + (c.prof.drunk ? Math.sin(t * 1.3 + c.weave) * 0.45 : 0);
      }
    }

    // pull-over / leaving / towed
    for (const c of this.cars) {
      if (c.state === 'pullover') {
        const dist = c.stopX - c.x;
        const target = Math.min(c.prof.speedKmh / 3.6, Math.sqrt(Math.max(0, dist) * 2 * 3.2));
        c.v += Math.max(-8 * dt, Math.min(3 * dt, target - c.v));
        c.x += c.v * dt;
        // stay out of the bay until past the parked patrol car
        const tz = c.x - c.len / 2 > -4.8 ? ROAD.bayZ : Math.min(ROAD.bayZ, 6.4);
        c.z += Math.sign(tz - c.z) * Math.min(Math.abs(tz - c.z), 2.2 * dt);
        c.mesh.userData.signal.visible = Math.floor(t * 3) % 2 === 0;
        if (dist < 0.15 && c.v < 0.6) { c.state = 'stopped'; c.v = 0; c.x = c.stopX; c.z = ROAD.bayZ; c.mesh.userData.signal.visible = false; }
      } else if (c.state === 'leaving') {
        c.v = Math.min(c.v + 2.5 * dt, 14);
        c.x += c.v * dt;
        if (c.x > ROAD.bayTo - 6) c.z += Math.sign(ROAD.laneZ[1] - c.z) * Math.min(Math.abs(ROAD.laneZ[1] - c.z), 1.6 * dt);
      } else if (c.state === 'towed') {
        c.fade -= dt * 0.8;
        c.mesh.scale.setScalar(Math.max(0.01, c.fade));
      }
      c.mesh.position.set(c.x, 0, c.z);
      if (c.state !== 'stopped' && c.state !== 'towed') {
        c.mesh.rotation.y = (c.dir > 0 ? 0 : Math.PI) - (c.state === 'pullover' && Math.abs(ROAD.bayZ - c.z) > 0.2 ? 0.12 : 0);
        for (const w of c.mesh.userData.wheels) w.rotation.z -= c.v * dt / 0.34;
      }
    }

    // despawn
    const missed = [];
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (Math.abs(c.x) > ROAD.length / 2 || (c.state === 'towed' && c.fade <= 0)) {
        this.scene.remove(c.mesh);
        this.cars.splice(i, 1);
      }
    }
    return missed;
  }

  // Ask a driving car to pull into the bay. Returns false if impossible.
  // place cars along the road so the street is busy right away
  prefill() {
    for (let lane = 0; lane < 4; lane++) {
      const dir = ROAD.laneDir[lane];
      for (let x = -130 + Math.random() * 10; x < 130; x += 22 + Math.random() * 20) {
        if (lane < 2 && x > -40) continue; // keep the area near the post clear for the player
        this.spawn(lane, x);
      }
    }
  }

  pullOver(car, preferX) {
    const minStop = car.x + 14;
    let stopX = Math.max(preferX, minStop);
    if (stopX > ROAD.bayTo - car.len / 2 - 1) return false;
    if (stopX < ROAD.bayFrom + 16) stopX = ROAD.bayFrom + 16;
    car.state = 'pullover';
    car.stopX = stopX;
    return true;
  }

  release(car) { car.state = 'leaving'; car.v = 0; }
  tow(car) { car.state = 'towed'; }
}
