// YPX xodimi 3D — main loop, player control, HUD, menus, progress.
import * as THREE from './three.module.min.js';
import { buildWorld, ROAD } from './world.js';
import { Traffic } from './traffic.js';
import { makeOfficer, animateOfficer, makeCar, makeMarker } from './models.js';
import { Inspection } from './inspect.js';
import { makeYpxCar } from './ypxcar.js';
import { sfx } from './audio.js';
import { RANKS, SHOP, SHIFT_SECONDS, CAR_TYPES } from './data.js';

const $ = id => document.getElementById(id);

// ---------- save ----------
const SAVE_KEY = 'ypx3d_save_v1';
const defaultSave = () => ({ xp: 0, money: 0, rep: 50, rank: 0, uniform: 'yozgi', car: 'sedan', owned: { uniform: ['yozgi'], car: ['sedan'] }, shifts: 0, best: 0 });
let save = defaultSave();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = { ...defaultSave(), ...s }; } catch (e) {}
if (save.car === 'sedan2') save.car = 'sedan';
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ---------- renderer ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const world = buildWorld(scene);
const traffic = new Traffic(scene);
traffic.setLights(world.trafficLights);

// ---------- player & patrol car ----------
let officer = null;
function uniformDef() { return SHOP.uniform.find(u => u.id === save.uniform) || SHOP.uniform[0]; }
function buildOfficer() {
  const pos = officer ? officer.position.clone() : new THREE.Vector3(0, 0.15, 9.6);
  const rot = officer ? officer.rotation.y : Math.PI;
  if (officer) scene.remove(officer);
  officer = makeOfficer(uniformDef());
  officer.traverse(o => { if (o.isMesh) o.castShadow = true; });
  officer.position.copy(pos);
  officer.rotation.y = rot;
  scene.add(officer);
}
let patrol = null;
function buildPatrol() {
  if (patrol) scene.remove(patrol);
  const def = SHOP.car.find(c => c.id === save.car) || SHOP.car[0];
  const type = CAR_TYPES.find(t => t.id === def.type);
  // the default patrol sedan is built from the user's YPX drawing
  patrol = def.ypx ? makeYpxCar() : makeCar(type, { color: 0xf4f6fa, police: true, plate: '01 YPX 777' });
  patrol.position.set(-7.5, 0, ROAD.bayZ);
  scene.add(patrol);
}
buildOfficer();
buildPatrol();
const marker = makeMarker();
scene.add(marker);
marker.visible = false;

// ---------- game state ----------
const G = {
  mode: 'menu', // menu | play | inspect | report
  t: 0,
  yaw: 0, pitch: 0.32,
  camMode: 'follow', camCar: null, orbitA: 0,
  shift: null,
  target: null,
  current: null, // car being stopped / inspected
  pose: null, poseT: 0,
};

function newShift() {
  const rank = RANKS[save.rank];
  G.shift = { time: SHIFT_SECONDS, quota: rank.quota, done: 0, correct: 0, points: 0, rep: 0, bribes: [], missed: 0, unjust: 0, refused: 0 };
}

// ---------- toast ----------
let toastTimer = 0;
function toast(msg, cls = 'info') {
  const t = $('toast');
  t.textContent = msg; t.className = 'show ' + cls;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = cls; }, 2000);
}

// ---------- inspection hooks ----------
const game = {
  toast,
  setCamMode(mode, car) { G.camMode = mode; G.camCar = car || G.camCar; if (mode === 'orbit') G.orbitA = Math.PI * 0.35; officer.visible = mode !== 'orbit'; },
  inspectionDone(car, res) {
    const s = G.shift;
    s.done++;
    s.points += res.points;
    s.rep += res.rep;
    if (res.correct) s.correct++;
    if (res.bribe) s.bribes.push(res.bribe);
    if (res.action === 'chetlatish') traffic.tow(car); else traffic.release(car);
    G.current = null;
    G.mode = 'play';
    showControls(true);
    toast((res.points >= 0 ? '+' : '') + res.points + ' ball', res.correct ? 'good' : 'bad');
    updateHud();
  },
};
const inspection = new Inspection(game);

// ---------- input: joystick, look, buttons, keyboard ----------
const joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
const look = { id: null, lx: 0, ly: 0 };
const keys = {};
const joyBase = $('joyBase'), joyKnob = $('joyKnob');

function joyStart(e) {
  for (const t of e.changedTouches) {
    if (joy.id !== null) break;
    joy.id = t.identifier; joy.cx = t.clientX; joy.cy = t.clientY;
    joyBase.style.left = t.clientX + 'px'; joyBase.style.top = t.clientY + 'px'; joyBase.style.bottom = 'auto';
    joyBase.style.margin = '-60px 0 0 -60px';
  }
  e.preventDefault();
}
function joyMove(e) {
  for (const t of e.changedTouches) if (t.identifier === joy.id) {
    let dx = t.clientX - joy.cx, dy = t.clientY - joy.cy;
    const d = Math.hypot(dx, dy), max = 50;
    if (d > max) { dx *= max / d; dy *= max / d; }
    joy.x = dx / max; joy.y = dy / max;
    joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
  }
  e.preventDefault();
}
function joyEnd(e) {
  for (const t of e.changedTouches) if (t.identifier === joy.id) {
    joy.id = null; joy.x = joy.y = 0; joyKnob.style.transform = 'translate(0,0)';
    joyBase.style.left = '70px'; joyBase.style.top = 'auto'; joyBase.style.bottom = '60px';
  }
}
const jz = $('joyZone');
jz.addEventListener('touchstart', joyStart, { passive: false });
jz.addEventListener('touchmove', joyMove, { passive: false });
jz.addEventListener('touchend', joyEnd); jz.addEventListener('touchcancel', joyEnd);

function lookStart(e) { for (const t of e.changedTouches) if (look.id === null) { look.id = t.identifier; look.lx = t.clientX; look.ly = t.clientY; } e.preventDefault(); }
function lookMove(e) {
  for (const t of e.changedTouches) if (t.identifier === look.id) {
    applyLook(t.clientX - look.lx, t.clientY - look.ly);
    look.lx = t.clientX; look.ly = t.clientY;
  }
  e.preventDefault();
}
function lookEnd(e) { for (const t of e.changedTouches) if (t.identifier === look.id) look.id = null; }
function applyLook(dx, dy) {
  if (G.camMode === 'orbit') { G.orbitA += dx * 0.01; return; }
  G.yaw -= dx * 0.006;
  G.pitch = Math.max(0.08, Math.min(0.9, G.pitch + dy * 0.004));
}
const lz = $('lookZone');
lz.addEventListener('touchstart', lookStart, { passive: false });
lz.addEventListener('touchmove', lookMove, { passive: false });
lz.addEventListener('touchend', lookEnd); lz.addEventListener('touchcancel', lookEnd);
// drag on the 3D view during vehicle check
canvas.addEventListener('touchstart', lookStart, { passive: false });
canvas.addEventListener('touchmove', lookMove, { passive: false });
canvas.addEventListener('touchend', lookEnd);
// mouse (desktop testing)
let mouseDown = false, mx = 0, my = 0;
window.addEventListener('mousedown', e => { if (e.target === canvas || e.target === lz) { mouseDown = true; mx = e.clientX; my = e.clientY; } });
window.addEventListener('mousemove', e => { if (mouseDown) { applyLook(e.clientX - mx, e.clientY - my); mx = e.clientX; my = e.clientY; } });
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (G.mode !== 'play') return;
  if (e.code === 'KeyH') doWhistle();
  if (e.code === 'KeyE') doTalk();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function bindBtn(id, fn) {
  const b = $(id);
  b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
  b.addEventListener('click', fn);
}
bindBtn('btnWhistle', () => doWhistle());
bindBtn('btnTalk', () => doTalk());

// ---------- actions ----------
// The whistle alone stops the car marked by the yellow arrow.
function doWhistle() {
  if (G.mode !== 'play') return;
  sfx.unlock(); sfx.whistle();
  G.pose = 'whistle'; G.poseT = 1.0;
  if (G.current) { toast('Avval to‘xtatilgan mashinani tekshiring', 'info'); return; }
  const car = G.target;
  if (!car) { toast('Yaqinda to‘xtatsa bo‘ladigan mashina yo‘q', 'info'); return; }
  if (!traffic.pullOver(car, Math.max(officer.position.x + 6, ROAD.bayFrom + 16))) { toast('Juda yaqin — haydovchi ulgurmadi', 'bad'); return; }
  G.current = car;
  car.counted = true;
  const s = G.shift;
  if (!car.prof.road.length) {
    s.rep -= 5; s.unjust++;
    setTimeout(() => toast('Sababsiz to‘xtatish! Obro‘ −5', 'bad'), 900);
  }
  updateHud();
}

function doTalk() {
  if (G.mode !== 'play' || !G.current || G.current.state !== 'stopped') return;
  if (officer.position.distanceTo(G.current.mesh.position) > 4.2) return;
  sfx.unlock();
  G.mode = 'inspect';
  showControls(false);
  marker.visible = false;
  // stand by the passenger door, facing the car
  officer.position.set(G.current.x + 0.4, 0.15, G.current.z + 1.7);
  officer.rotation.y = Math.PI;
  inspection.open(G.current);
}

// ---------- UI helpers ----------
function showControls(on) {
  $('controls').classList.toggle('hidden', !on);
  $('hud').classList.toggle('hidden', !(on || G.mode === 'inspect'));
}

function updateHud() {
  const s = G.shift;
  const r = RANKS[save.rank];
  $('hudRank').textContent = `${r.stars} ${r.name}`;
  if (s) {
    $('hudQuota').textContent = `Reja: ${s.correct}/${s.quota}`;
    const tt = Math.max(0, Math.ceil(s.time));
    $('hudTime').textContent = `⏱ ${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, '0')}`;
    $('hudMoney').textContent = `⭐ ${s.points} ball`;
    const rep = Math.max(0, Math.min(100, save.rep + s.rep));
    $('hudRep').textContent = `🛡 Obro‘: ${rep}`;
  }
}

function menuStats() {
  const r = RANKS[save.rank], next = RANKS[save.rank + 1];
  $('menuStats').innerHTML = `${r.stars} <b>${r.name}</b><br>💰 ${save.money} ming so‘m · 🛡 Obro‘ ${save.rep} · 📈 Tajriba ${save.xp}<br>` +
    (next ? `<span class="muted">Keyingi unvon — ${next.name}: tajriba ${next.xp}, obro‘ ${next.rep}</span>` : '<span class="muted">Eng yuqori unvon!</span>');
}

function showScreen(id) {
  for (const s of ['menu', 'help', 'shop', 'report']) $(s).classList.toggle('hidden', s !== id);
}

// ---------- menus ----------
$('btnStart').onclick = () => {
  sfx.unlock(); sfx.ambientStart();
  showScreen(null);
  traffic.clear();
  traffic.prefill();
  newShift();
  G.mode = 'play'; G.current = null; G.yaw = 0; G.pitch = 0.32;
  officer.position.set(0, 0.15, 9.6); officer.rotation.y = Math.PI;
  showControls(true);
  updateHud();
  toast('Smena boshlandi! Reja: ' + G.shift.quota + ' ta to‘g‘ri qaror', 'info');
};
$('btnHelp').onclick = () => showScreen('help');
$('btnHelpBack').onclick = () => showScreen('menu');
$('btnShop').onclick = () => { renderShop(); showScreen('shop'); };
$('btnShopBack').onclick = () => { menuStats(); showScreen('menu'); };
$('btnReportOk').onclick = () => { menuStats(); G.mode = 'menu'; showScreen('menu'); };

function renderShop() {
  $('shopMoney').textContent = `💰 ${save.money} ming so‘m`;
  const render = (kind, el) => {
    el.innerHTML = '';
    for (const it of SHOP[kind]) {
      const owned = save.owned[kind].includes(it.id);
      const selected = save[kind] === it.id;
      const locked = save.rank < it.rank;
      const color = kind === 'uniform' ? '#' + it.shirt.toString(16).padStart(6, '0') : '#f4f6fa';
      const div = document.createElement('div');
      div.className = 'shop-item';
      div.innerHTML = `<div class="sw" style="background:${color}">${kind === 'car' ? '🚓' : ''}</div><b>${it.name}</b><br>
        <span class="muted">${it.price ? it.price + ' ming so‘m' : 'Bepul'}${locked ? ' · 🔒 ' + RANKS[it.rank].name : ''}</span>`;
      const b = document.createElement('button');
      if (selected) { b.textContent = 'Tanlangan'; b.disabled = true; }
      else if (owned) { b.textContent = 'Tanlash'; b.onclick = () => { save[kind] = it.id; persist(); apply(); renderShop(); }; }
      else {
        b.textContent = 'Sotib olish'; b.disabled = locked || save.money < it.price;
        b.onclick = () => { save.money -= it.price; save.owned[kind].push(it.id); save[kind] = it.id; sfx.cash(); persist(); apply(); renderShop(); };
      }
      div.appendChild(b);
      el.appendChild(div);
    }
  };
  const apply = () => { buildOfficer(); buildPatrol(); };
  render('uniform', $('shopUniform'));
  render('car', $('shopCar'));
}

function endShift() {
  const s = G.shift;
  G.mode = 'report';
  showControls(false);
  $('hud').classList.add('hidden');
  marker.visible = false;
  for (const el of labelEls.values()) el.remove();
  labelEls.clear();

  let html = `<div class="stats" style="text-align:left">
    To‘xtatilgan mashinalar: <b>${s.done}</b><br>
    To‘g‘ri qarorlar: <b>${s.correct}</b> / reja ${s.quota}<br>
    O‘tkazib yuborilgan qoidabuzarlar: <b>${s.missed}</b><br>
    Sababsiz to‘xtatishlar: <b>${s.unjust}</b><br>
    Ball: <b>${s.points}</b></div>`;
  const salary = 300;
  let earned = salary + Math.max(0, s.points);
  let repDelta = s.rep;
  if (s.correct >= s.quota) { earned += 200; html += `<p>✅ Reja bajarildi! Mukofot: +200 ming so‘m</p>`; }
  else html += `<p>⚠️ Reja bajarilmadi.</p>`;
  if (s.bribes.length) {
    const caught = Math.random() < 0.5 + 0.1 * (s.bribes.length - 1);
    if (caught) {
      earned = 0; repDelta -= 30;
      html += `<p style="color:#ff8a8a">🚨 Ichki xavfsizlik xizmati pora olganingizni aniqladi! Smena maoshi musodara qilindi, obro‘ −30.</p>`;
    } else {
      html += `<p class="muted">Pora olgansiz. Bu safar sezilmadi... lekin halol xizmat — haqiqiy inspektor sharafi.</p>`;
    }
  }
  html += `<p>💰 Maosh va mukofot: <b>+${earned} ming so‘m</b><br>🛡 Obro‘: <b>${repDelta >= 0 ? '+' : ''}${repDelta}</b><br>📈 Tajriba: <b>+${Math.max(0, s.points)}</b></p>`;
  save.money += earned;
  save.rep = Math.max(0, Math.min(100, save.rep + repDelta));
  save.xp += Math.max(0, s.points);
  save.shifts++;
  save.best = Math.max(save.best, s.points);
  // promotion / demotion
  let newRank = 0;
  RANKS.forEach((r, i) => { if (save.xp >= r.xp && save.rep >= r.rep) newRank = i; });
  if (newRank > save.rank) html += `<p style="color:#7CFFB2;font-size:18px">🎖 Tabriklaymiz! Sizga <b>${RANKS[newRank].name}</b> unvoni berildi!</p>`;
  else if (newRank < save.rank) html += `<p style="color:#ff8a8a">Obro‘ pastligi sababli unvoningiz <b>${RANKS[newRank].name}</b>ga tushirildi.</p>`;
  save.rank = newRank;
  persist();
  $('reportBody').innerHTML = html;
  showScreen('report');
}

// ---------- radar labels ----------
const labelEls = new Map();
const tmpV = new THREE.Vector3();
function updateLabels() {
  const seen = new Set();
  if (G.mode === 'play') {
    const px = officer.position.x;
    const cands = traffic.cars.filter(c => c.lane <= 1 && c.state === 'drive' && c.x > px - 60 && c.x < px + 12)
      .sort((a, b) => (b === G.target) - (a === G.target) || Math.abs(a.x - px) - Math.abs(b.x - px));
    const placed = [];
    for (const c of cands) {
      tmpV.set(c.x, c.prof.type.h + 0.7, c.z).project(camera);
      if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.1 || Math.abs(tmpV.y) > 1.1) continue;
      const sx = (tmpV.x + 1) / 2 * window.innerWidth, sy = (1 - tmpV.y) / 2 * window.innerHeight;
      // skip labels that would overlap one already shown (nearer cars win)
      if (placed.some(p => Math.abs(p.x - sx) < 118 && Math.abs(p.y - sy) < 26)) continue;
      placed.push({ x: sx, y: sy });
      seen.add(c);
      let el = labelEls.get(c);
      if (!el) { el = document.createElement('div'); el.className = 'lbl'; $('labels').appendChild(el); labelEls.set(c, el); }
      const kmh = Math.round(c.v * 3.6);
      const icons = c.prof.road.filter(k => k !== 'tezlik').map(k => ({ kamar: '🔓', telefon: '📱', qizil: '🚦', tonirovka: '🕶️', raqamsiz: '🚫' }[k])).join('');
      const html = `${kmh} km/soat${icons ? `<span class="ic">${icons}</span>` : ''}`;
      if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
      el.classList.toggle('target', c === G.target);
      el.style.left = sx + 'px';
      el.style.top = sy + 'px';
    }
  }
  for (const [c, el] of labelEls) if (!seen.has(c)) { el.remove(); labelEls.delete(c); }
}

// ---------- per-frame logic ----------
const boxes = () => {
  const list = [{ x: -16, z: 11.6, hx: 1.5, hz: 1.5 }, { x: -7.5, z: ROAD.bayZ, hx: 2.6, hz: 1.2 }];
  if (G.current && G.current.state === 'stopped') list.push({ x: G.current.x, z: G.current.z, hx: G.current.len / 2 + 0.2, hz: 1.15 });
  return list;
};

function updatePlayer(dt) {
  let ix = joy.x, iy = joy.y;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  if (keys.KeyW || keys.ArrowUp) iy -= 1;
  if (keys.KeyS || keys.ArrowDown) iy += 1;
  const len = Math.hypot(ix, iy);
  if (len > 1) { ix /= len; iy /= len; }
  const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);
  const rx = Math.cos(G.yaw), rz = -Math.sin(G.yaw);
  const speed = 4.2;
  const mvx = (rx * ix + fx * -iy) * speed, mvz = (rz * ix + fz * -iy) * speed;
  const p = officer.position;
  p.x += mvx * dt; p.z += mvz * dt;
  p.x = Math.max(-45, Math.min(40, p.x));
  p.z = Math.max(7.3, Math.min(12.8, p.z));
  for (const b of boxes()) {
    const dx = p.x - b.x, dz = p.z - b.z;
    const ox = b.hx + 0.3 - Math.abs(dx), oz = b.hz + 0.3 - Math.abs(dz);
    if (ox > 0 && oz > 0) { if (ox < oz) p.x += Math.sign(dx || 1) * ox; else p.z += Math.sign(dz || 1) * oz; }
  }
  const sp = Math.hypot(mvx, mvz);
  if (sp > 0.1) {
    const want = Math.atan2(mvx, mvz);
    let d = want - officer.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    officer.rotation.y += d * Math.min(1, dt * 10);
  }
  G.pose = G.poseT > 0 ? G.pose : null;
  G.poseT -= dt;
  animateOfficer(officer, G.t, sp, G.pose);
}

function pickTarget() {
  const px = officer.position.x;
  let best = null;
  for (const c of traffic.cars) {
    if (c.lane > 1 || c.state !== 'drive') continue;
    if (c.x > px + 2 || c.x < px - 55) continue;
    if (!best || c.x > best.x) best = c;
  }
  return best;
}

function checkMissed() {
  const s = G.shift;
  if (G.current || s.time > SHIFT_SECONDS - 15) return; // grace period at shift start
  for (const c of traffic.cars) {
    if (c.lane > 1 || c.state !== 'drive' || c.counted) continue;
    if (c.x > officer.position.x + 14 && c.x < officer.position.x + 40) {
      c.counted = true;
      if (c.prof.road.length) { s.missed++; s.rep -= 2; toast('Qoidabuzar o‘tib ketdi! Obro‘ −2', 'bad'); updateHud(); }
    }
  }
}

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function updateCamera(dt) {
  if (G.freezeCam) return; // used by automated screenshot tests
  const k = Math.min(1, dt * 5);
  if (G.mode === 'menu' || G.mode === 'report') {
    const a = G.t * 0.05;
    camPos.set(-8 + Math.sin(a) * 20, 14, 12 + Math.cos(a) * 7);
    camLook.set(-8, 1, 4);
    camera.position.lerp(camPos, 0.05);
  } else if (G.camMode === 'talk' && G.camCar) {
    const c = G.camCar;
    camPos.set(c.x - 2.2, 2.3, c.z + 6.2);
    camLook.set(c.x + 1.8, 1.0, c.z + 0.6);
    camera.position.lerp(camPos, k);
  } else if (G.camMode === 'orbit' && G.camCar) {
    const c = G.camCar;
    G.orbitA += dt * 0.25;
    camPos.set(c.x + Math.cos(G.orbitA) * 6.5, 2.6, c.z + Math.sin(G.orbitA) * 6.5);
    camLook.set(c.x + Math.cos(G.orbitA - Math.PI / 2) * 2.2, 0.7, c.z + Math.sin(G.orbitA - Math.PI / 2) * 2.2);
    camera.position.lerp(camPos, k);
  } else {
    const p = officer.position;
    const dist = 6.2;
    camPos.set(p.x + Math.sin(G.yaw) * dist * Math.cos(G.pitch), p.y + 1.4 + Math.sin(G.pitch) * dist, p.z + Math.cos(G.yaw) * dist * Math.cos(G.pitch));
    camLook.set(p.x - Math.sin(G.yaw) * 3, p.y + 1.3, p.z - Math.cos(G.yaw) * 3);
    camera.position.lerp(camPos, Math.min(1, dt * 8));
  }
  camera.lookAt(camLook);
  // keep the shadow camera around the action
  const f = G.mode === 'menu' ? camLook : officer.position;
  world.sun.position.set(f.x - 30, 50, f.z + 25);
  world.sun.target.position.set(f.x, 0, f.z);
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.t += dt;
  traffic.update(dt, G.t);

  if (G.mode === 'play') {
    updatePlayer(dt);
    G.target = G.current ? null : pickTarget();
    if (G.target) {
      marker.visible = true;
      marker.position.set(G.target.x, G.target.prof.type.h + 1.6 + Math.sin(G.t * 6) * 0.15, G.target.z);
      marker.rotation.y += dt * 3;
      $('targetInfo').classList.remove('hidden');
      $('targetInfo').textContent = '🎯 ' + G.target.prof.type.name + ' · ' + Math.round(G.target.v * 3.6) + ' km/soat';
    } else {
      marker.visible = false;
      $('targetInfo').classList.add('hidden');
    }
    const canTalk = G.current && G.current.state === 'stopped' && officer.position.distanceTo(G.current.mesh.position) < 4.2;
    $('btnTalk').classList.toggle('hidden', !canTalk);
    if (G.current && G.current.state === 'stopped' && !canTalk && !G.hintShown) { G.hintShown = true; toast('Mashina to‘xtadi — yoniga borib «Gaplashish»ni bosing', 'info'); }
    if (!G.current) G.hintShown = false;
    checkMissed();
    G.shift.time -= dt;
    if (Math.floor(G.shift.time) !== Math.floor(G.shift.time + dt)) updateHud();
    if (G.shift.time <= 0 && !G.current) endShift();
    else if (G.shift.time <= 0 && G.current && G.current.state !== 'stopped' && G.current.state !== 'pullover') endShift();
  }
  if (patrol && patrol.userData.lights) {
    const on = Math.floor(G.t * 5) % 2 === 0;
    patrol.userData.lights.red.material.color.setHex(on ? 0xff2020 : 0x441010);
    patrol.userData.lights.blue.material.color.setHex(on ? 0x102044 : 0x2050ff);
    const L = patrol.userData.lights;
    if (L.glowRed) { L.glowRed.visible = on; L.glowBlue.visible = !on; }
  }
  updateCamera(dt);
  renderer.render(scene, camera);
  updateLabels();
  requestAnimationFrame(frame);
}

traffic.prefill();
menuStats();
showScreen('menu');
camera.position.set(-3, 9, 29);
requestAnimationFrame(frame);

// test hook (used by automated browser tests)
window.__ypx = { G, traffic, save, cam: camera, officer: () => officer, doWhistle, doTalk, inspection };
