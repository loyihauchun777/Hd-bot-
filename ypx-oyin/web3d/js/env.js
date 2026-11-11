// Sky, time of day and weather: clouds, night with stars / moon / street lamps / lit windows, rain and wet asphalt.
import * as THREE from './three.module.min.js';
import { buildingMats } from './models.js';

const C = hex => new THREE.Color(hex);
const SKY = { clear: C(0x9fd0f0), cloudy: C(0xaab8c4), rain: C(0x7d8893), dusk: C(0xf0a868), night: C(0x0b1022), nightRain: C(0x090b12) };

function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

// 0 = full day, 1 = full night
export function nightOf(h) {
  h = ((h % 24) + 24) % 24;
  if (h >= 19.5 || h < 4.5) return 1;
  if (h >= 6 && h < 17.5) return 0;
  if (h >= 17.5) return (h - 17.5) / 2;
  return 1 - (h - 4.5) / 1.5;
}

export function createEnv(scene, world) {
  const env = { hour: 9, weather: 'clear', night: 0, wet: 0, raining: false };
  const glow = glowTexture();

  // ---- clouds: low-poly puffs drifting along the street ----
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const clouds = [];
  const puff = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 22; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(puff, cloudMat);
      const s = 7 + Math.random() * 9;
      m.scale.set(s * 1.5, s * 0.55, s);
      m.position.set((k - n / 2) * 9 + Math.random() * 4, Math.random() * 3, Math.random() * 8 - 4);
      g.add(m);
    }
    g.position.set(Math.random() * 520 - 260, 40 + Math.random() * 30, i % 3 === 0 ? 60 + Math.random() * 120 : -70 - Math.random() * 130);
    g.userData.v = 1.2 + Math.random() * 1.6;
    g.userData.extra = i >= 13; // only shown when cloudy / raining
    scene.add(g); clouds.push(g);
  }

  // ---- stars + moon ----
  const sp = [];
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.3, r = 330;
    sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
  const moonMat = new THREE.SpriteMaterial({ map: glow, color: 0xe9eefc, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const moon = new THREE.Sprite(moonMat); moon.scale.set(46, 46, 1);
  scene.add(moon);

  // ---- street lamps: glow at the head and a pool of light on the road ----
  const lampGlowMat = new THREE.SpriteMaterial({ map: glow, color: 0xffd98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolMat = new THREE.MeshBasicMaterial({ map: glow, color: 0xffc977, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolGeo = new THREE.PlaneGeometry(17, 17);
  for (const p of world.lampHeads) {
    const s = new THREE.Sprite(lampGlowMat); s.scale.set(3.2, 3.2, 1); s.position.copy(p); scene.add(s);
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(p.x, 0.03, p.z * 0.75); scene.add(pool);
  }

  // ---- rain: streaks in a box that follows the camera ----
  const N = 1100, BX = 46, BY = 26;
  const rp = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const x = Math.random() * BX - BX / 2, y = Math.random() * BY, z = Math.random() * BX - BX / 2;
    rp.set([x, y, z, x + 0.12, y - 0.9, z], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xc9d8e6, transparent: true, opacity: 0.5, fog: false, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false; rain.visible = false;
  scene.add(rain);

  const sky = new THREE.Color(), tmp = new THREE.Color();
  const hemiDay = C(0xdff1ff), hemiNight = C(0x7f93c8), sunDay = C(0xfff2d8), sunDusk = C(0xffb070);
  const cloudDay = C(0xffffff), cloudRain = C(0x8d939c), cloudNight = C(0x1a2030);
  const roadDry = C(0xffffff), roadWet = C(0x6c727c);

  env.set = (hour, weather) => { env.hour = hour; if (weather) env.weather = weather; };

  env.update = (dt, camera) => {
    const n = env.night = nightOf(env.hour);
    const rainy = env.weather === 'rain', cloudy = env.weather === 'cloudy';
    env.raining = rainy;
    const dusk = 1 - Math.abs(n - 0.5) * 2; // peaks mid-transition

    // sky + fog
    sky.copy(rainy ? SKY.rain : cloudy ? SKY.cloudy : SKY.clear).lerp(rainy ? SKY.nightRain : SKY.night, n);
    if (!rainy) sky.lerp(SKY.dusk, Math.max(0, dusk) * (cloudy ? 0.25 : 0.5));
    scene.background.copy(sky);
    scene.fog.color.copy(sky);
    scene.fog.near = rainy ? 35 : 70; scene.fog.far = rainy ? 115 : 160;

    // light
    const dim = rainy ? 0.7 : cloudy ? 0.85 : 1;
    world.hemi.intensity = (1.6 + (0.8 - 1.6) * n) * (1 - (1 - dim) * (1 - n * 0.7)); // nights stay readable, also in rain
    world.hemi.color.copy(hemiDay).lerp(hemiNight, n);
    world.sun.intensity = 2.2 * (1 - n) * (rainy ? 0.25 : cloudy ? 0.55 : 1);
    world.sun.color.copy(sunDay).lerp(sunDusk, Math.max(0, dusk));

    // clouds
    cloudMat.color.copy(rainy ? cloudRain : cloudDay);
    if (cloudy) cloudMat.color.lerp(cloudRain, 0.35);
    cloudMat.color.lerp(cloudNight, n * 0.92);
    if (!rainy && !cloudy) cloudMat.color.lerp(tmp.copy(SKY.dusk), Math.max(0, dusk) * 0.35);
    for (const c of clouds) {
      c.visible = !c.userData.extra || rainy || cloudy;
      c.position.x += c.userData.v * dt * (rainy ? 2.2 : 1);
      if (c.position.x > 270) c.position.x = -270;
    }

    // night things
    const clearNight = n * (rainy ? 0 : cloudy ? 0.35 : 1);
    starMat.opacity = clearNight * 0.9; stars.visible = clearNight > 0.02;
    stars.position.set(camera.position.x, 0, camera.position.z);
    moonMat.opacity = clearNight; moon.visible = clearNight > 0.02;
    moon.position.set(camera.position.x + 120, 170, camera.position.z - 230);
    const lampOn = Math.min(1, Math.max(0, (n - 0.25) * 2.5)) || (rainy ? 0.5 : 0);
    lampGlowMat.opacity = lampOn; poolMat.opacity = lampOn * 0.5;
    for (const m of buildingMats) m.emissiveIntensity = Math.max(0, n - 0.2) * 1.2;

    // rain + wet road
    env.wet += ((rainy ? 1 : 0) - env.wet) * Math.min(1, dt * 0.25);
    for (const m of world.roadMats) { m.color.copy(roadDry).lerp(roadWet, env.wet * (1 - n * 0.5)); m.shininess = 6 + 110 * env.wet; }
    rain.visible = rainy;
    if (rainy) {
      const a = rainGeo.attributes.position.array, fall = 30 * dt;
      for (let i = 0; i < N; i++) {
        let y = a[i * 6 + 1] - fall;
        if (y < 0) y += BY;
        a[i * 6 + 1] = y; a[i * 6 + 4] = y - 0.9;
      }
      rainGeo.attributes.position.needsUpdate = true;
      rain.position.set(camera.position.x, 0, camera.position.z);
      rainMat.opacity = 0.5 - n * 0.2;
    }
  };

  return env;
}

export const WEATHER_NAME = { clear: 'ochiq havo', cloudy: 'bulutli', rain: 'yomg‘ir' };
export const WEATHER_ICON = { clear: '☀️', cloudy: '☁️', rain: '🌧️', night: '🌙' };
