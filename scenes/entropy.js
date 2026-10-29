// ③ 무질서도: 물 분자 얼음 → 물 → 수증기(→ 다시 물), 두 플라스크 꼭지 열기(기체 혼합)
import * as THREE from 'three';
import { plate, label, sprite, dotTex, waterTex, lerp, clamp } from './kit.js?v=20261029a';

export const STEPS = [
  { k: '융해', btn: '얼음 녹이기 (융해)', from: 'ice', to: 'liquid', a: '커짐' },
  { k: '기화', btn: '물 끓이기 (기화)', from: 'liquid', to: 'gas', a: '커짐' },
  { k: '응결', btn: '수증기 식히기 (응결)', from: 'gas', to: 'liquid', a: '작아짐' },
  { k: '혼합', btn: '꼭지 열기 (기체 혼합)', a: '커짐' },
];
const STATE_NAME = { ice: '얼음 (고체)', liquid: '물 (액체)', gas: '수증기 (기체)' };

const BX = { c: new THREE.Vector3(0, 0.3, 0), w: 0.56, d: 0.2, h: 0.42 };       // 물 분자 상자
const FL = { y: -0.36, z: 0.15, r: 0.15, x: 0.24, tube: 0.04 };                // 두 플라스크
const N = 24, NG = 9, Rm = 0.03;

export class EntropyScene {
  constructor() {
    this.group = new THREE.Group();
    this.group.add(plate());
    const g = this.group;
    this.t = 0; this.phase = 'ice'; this.blend = 1; this.open = false;

    // 물 분자 상자
    const box = new THREE.BoxGeometry(BX.w, BX.d, BX.h);
    const shell = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.14, depthWrite: false }));
    shell.position.set(BX.c.x, BX.c.y, BX.h / 2); g.add(shell);
    const ed = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x55606e }));
    ed.position.copy(shell.position); g.add(ed);
    this.stLab = label(STATE_NAME.ice, 0.32); this.stLab.position.set(BX.c.x, BX.c.y + 0.02, BX.h + 0.08); g.add(this.stLab);
    // 액체일 때 바닥의 물빛
    this.pool = new THREE.Mesh(new THREE.BoxGeometry(BX.w - 0.01, BX.d - 0.01, 0.13), new THREE.MeshBasicMaterial({ color: 0x59b4ff, transparent: true, opacity: 0, depthWrite: false }));
    this.pool.position.set(BX.c.x, BX.c.y, 0.068); g.add(this.pool);

    // 얼음 자리: 4 × 3 × 2 격자
    this.mol = [];
    for (let i = 0; i < N; i++) {
      const lat = new THREE.Vector3((i % 6 - 2.5) * 0.07, (Math.floor(i / 12) - 0.5) * 0.07, 0.04 + Math.floor(i / 6) % 2 * 0.07).add(new THREE.Vector3(BX.c.x, BX.c.y, 0));
      const s = sprite(waterTex(), Rm * 2.6); s.position.copy(lat); g.add(s);
      this.mol.push({ s, lat, v: new THREE.Vector3().randomDirection(), from: lat.clone() });
    }

    // 두 플라스크 + 관 + 꼭지
    const glass = new THREE.MeshBasicMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    [-1, 1].forEach(sx => { const m = new THREE.Mesh(new THREE.SphereGeometry(FL.r, 32, 20), glass); m.position.set(sx * FL.x, FL.y, FL.z); g.add(m); });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(FL.tube, FL.tube, FL.x * 2 - FL.r * 1.6, 16, 1, true), glass);
    tube.rotation.z = Math.PI / 2; tube.position.set(0, FL.y, FL.z); g.add(tube);
    this.valve = new THREE.Group(); this.valve.position.set(0, FL.y, FL.z);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(FL.tube * 1.3, FL.tube * 1.3, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0x777777 }));
    ring.rotation.z = Math.PI / 2; this.valve.add(ring);
    this.handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.12), new THREE.MeshStandardMaterial({ color: 0xd62828 }));
    this.handle.position.z = 0.07; this.valve.add(this.handle);
    g.add(this.valve);
    this.vLab = label('꼭지 닫힘', 0.2); this.vLab.position.set(0, FL.y - 0.2, FL.z + 0.1); g.add(this.vLab);
    g.add(new THREE.HemisphereLight(0xffffff, 0x777788, 1.7));

    // 기체 A(빨강)는 왼쪽, B(파랑)는 오른쪽
    this.gas = [];
    for (let i = 0; i < NG * 2; i++) {
      const left = i < NG, c = new THREE.Vector3(left ? -FL.x : FL.x, FL.y, FL.z);
      const s = sprite(dotTex(left ? '#e23d3d' : '#2862d6', left ? 'A' : 'B'), 0.06);
      s.position.copy(c).add(new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * FL.r * 0.7)); g.add(s);
      this.gas.push({ s, v: new THREE.Vector3().randomDirection() });
    }
  }

  // 상태 바꾸기 (1.5초 동안 옮겨 감)
  change(to) {
    this.mol.forEach(m => { m.from = m.s.position.clone(); m.v.randomDirection(); });
    this.phase = to; this.blend = 0; this.stLab.set(STATE_NAME[to]);
  }
  openValve() { this.open = true; this.vLab.set('꼭지 열림'); }
  reset() {
    this.change('ice'); this.blend = 1; this.mol.forEach(m => m.s.position.copy(m.lat));
    this.open = false; this.vLab.set('꼭지 닫힘'); this.handle.rotation.y = 0;
    this.gas.forEach((p, i) => p.s.position.set(i < NG ? -FL.x : FL.x, FL.y, FL.z));
  }

  inside(q) {
    const inL = q.distanceTo(new THREE.Vector3(-FL.x, FL.y, FL.z)) < FL.r - 0.022;
    const inR = q.distanceTo(new THREE.Vector3(FL.x, FL.y, FL.z)) < FL.r - 0.022;
    const inT = this.open && Math.abs(q.x) < FL.x && Math.hypot(q.y - FL.y, q.z - FL.z) < FL.tube;
    return inL || inR || inT;
  }

  tick(dt) {
    this.t += dt;
    this.blend = Math.min(1, this.blend + dt / 1.5);
    this.pool.material.opacity = lerp(this.pool.material.opacity, this.phase === 'liquid' ? 0.3 : 0, clamp(dt * 2, 0, 1));
    const lo = new THREE.Vector3(BX.c.x - BX.w / 2 + Rm, BX.c.y - BX.d / 2 + Rm, Rm);
    const hiGas = BX.h - Rm;
    for (const m of this.mol) {
      const q = m.s.position;
      if (this.phase === 'ice') {   // 제자리에서 살짝 떨기만
        const target = m.lat.clone().add(new THREE.Vector3(Math.sin(this.t * 17 + m.lat.x * 40), Math.cos(this.t * 15 + m.lat.y * 40), 0).multiplyScalar(0.004));
        q.lerpVectors(m.from, target, this.blend < 1 ? this.blend : 1);
        continue;
      }
      const gas = this.phase === 'gas', sp = gas ? 0.32 : 0.06, top = gas ? hiGas : 0.12;
      m.v.x += (Math.random() - .5) * dt * 4; m.v.y += (Math.random() - .5) * dt * 4; m.v.z += (Math.random() - .5) * dt * 4; m.v.normalize();
      if (!gas) m.v.z -= 0.6 * dt;   // 액체는 바닥에 모임
      q.addScaledVector(m.v, sp * dt);
      if (this.blend < 1 && gas) q.z += dt * 0.12;   // 끓을 때 위로 퍼짐
      const hx = BX.c.x + BX.w / 2 - Rm, hy = BX.c.y + BX.d / 2 - Rm;
      if (q.x < lo.x || q.x > hx) { q.x = clamp(q.x, lo.x, hx); m.v.x *= -1; }
      if (q.y < lo.y || q.y > hy) { q.y = clamp(q.y, lo.y, hy); m.v.y *= -1; }
      if (q.z < lo.z || q.z > top) { q.z = clamp(q.z, lo.z, Math.max(top, lo.z)); m.v.z *= -1; }
    }
    // 액체: 분자끼리 너무 겹치지 않게
    if (this.phase !== 'ice') for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const A = this.mol[i].s.position, B = this.mol[j].s.position, d = A.distanceTo(B), min = Rm * 1.9;
      if (d > 0 && d < min) { const push = B.clone().sub(A).multiplyScalar((min - d) / d * 0.5); A.sub(push); B.add(push); }
    }
    // 기체 혼합
    this.handle.rotation.y = lerp(this.handle.rotation.y, this.open ? Math.PI / 2 : 0, clamp(dt * 4, 0, 1));
    for (const p of this.gas) {
      const q = p.s.position, prev = q.clone();
      p.v.x += (Math.random() - .5) * dt * 6; p.v.y += (Math.random() - .5) * dt * 6; p.v.z += (Math.random() - .5) * dt * 6; p.v.normalize();
      q.addScaledVector(p.v, 0.22 * dt);
      if (!this.inside(q)) { q.copy(prev); p.v.randomDirection(); }
      // 꼭지가 열려 있으면 관 입구 쪽으로 가끔 끌려감 (섞이는 데 너무 오래 걸리지 않게)
      if (this.open && Math.random() < dt * 0.6) { p.v.set(-Math.sign(q.x) || 1, (FL.y - q.y) * 4, (FL.z - q.z) * 4).normalize(); }
    }
  }
}
