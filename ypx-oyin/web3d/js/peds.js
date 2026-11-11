// A handful of pedestrians: most stroll along the sidewalks, a couple use the crosswalk on the red light.
import { makePed, animatePed } from './models.js';
import { ROAD } from './world.js';

const pick = a => a[Math.floor(Math.random() * a.length)];
const NEAR_Z = 12.3, FAR_Z = -9.3;
const LOOKS = () => {
  const woman = Math.random() < 0.45;
  return {
    skin: pick([0xe0b08a, 0xd29a6e, 0xc58c5e, 0xe8c09c]),
    top: pick([0x3a6ea5, 0x8a2b2b, 0x3a5f3a, 0xd9d2c3, 0x444a55, 0xb8862b, 0x6a3f7a, 0xe8e8e8]),
    bottom: pick([0x2b2f3a, 0x1e283b, 0x4a3b2a, 0x333333]),
    hair: pick([0x1a1410, 0x2b1d14, 0x555555]),
    dress: woman && Math.random() < 0.7,
    scarf: woman && Math.random() < 0.6 ? pick([0xd9c9a8, 0x7a2b3a, 0x2b4a7a, 0xe8e8e8]) : 0,
    doppi: !woman && Math.random() < 0.25,
    bag: Math.random() < 0.35 ? pick([0x3a2a1a, 0x1a1a1a, 0x7a1a1a]) : 0,
  };
};

export class Pedestrians {
  constructor(scene, traffic) {
    this.traffic = traffic;
    this.list = [];
    for (let i = 0; i < 8; i++) {
      const mesh = makePed(LOOKS());
      mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const near = i % 2 === 0;
      const p = {
        mesh, x: Math.random() * 200 - 100, z: near ? NEAR_Z : FAR_Z, side: near ? 1 : -1,
        dir: Math.random() < 0.5 ? 1 : -1, speed: 1.0 + Math.random() * 0.6, phase: Math.random() * 6,
        crosser: i >= 6, state: 'walk', wait: 0,
      };
      scene.add(mesh);
      this.list.push(p);
    }
  }

  update(dt, t) {
    const X = ROAD.crossX;
    for (const p of this.list) {
      let moving = p.speed;
      if (p.state === 'walk') {
        p.x += p.dir * p.speed * dt;
        if (p.x > 125) p.dir = -1; else if (p.x < -125) p.dir = 1;
        // crossers stop at the zebra and wait for the cars' red light
        if (p.crosser && Math.abs(p.x - X) < 0.4 && p.wait <= 0) { p.state = 'wait'; p.x = X + (p.side > 0 ? 0.6 : -0.6); }
        p.wait -= dt;
        // near-side walkers step around the YPX booth
        const base = p.side > 0 ? NEAR_Z : FAR_Z;
        const d = Math.abs(p.x + 16), dodge = p.side > 0 && d < 5 ? -2.8 * Math.min(1, (5 - d) / 2) : 0;
        p.z += (base + dodge - p.z) * Math.min(1, dt * 3);
        p.mesh.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else if (p.state === 'wait') {
        moving = 0;
        const edge = p.side > 0 ? 7.6 : -7.6;
        p.z += (edge - p.z) * Math.min(1, dt * 2);
        p.mesh.rotation.y = p.side > 0 ? Math.PI : 0; // face the road
        if (this.traffic.light === 'red' && this.traffic.lightT < 0.8 && Math.abs(p.z - edge) < 0.3) p.state = 'cross';
      } else { // cross briskly to the other side
        moving = 2.3;
        p.z -= p.side * 2.3 * dt;
        if (p.side * p.z < -8.2) { p.side = -p.side; p.state = 'walk'; p.wait = 25 + Math.random() * 30; p.dir = Math.random() < 0.5 ? 1 : -1; }
      }
      p.mesh.position.set(p.x, 0.15, p.z);
      animatePed(p.mesh, t + p.phase, moving);
    }
  }
}
