// ② 조리 용기: 도시락 아래 칸에서 산화 칼슘 + 물 → 열, 위 칸 달걀이 데워짐
// 온도 변화는 엔진 mod_i4의 가상 모형과 같은 식(숫자는 보여 주지 않음, 정확한 그래프는 앱이 맡음)
import * as THREE from 'three';
import { plate, label, sprite, glowTex, arrow, thermometer, lerp, clamp } from './kit.js?v=20261029b';

export const GS = [20, 30, 40, 50, 60, 70, 80], MLS = [100, 150, 200, 250, 300];
export const MINUTES = 20;   // 화면에서 보여 주는 시간 (1초 = 1분)

// mod_i4 simulate와 같은 식: 1 mol당 65 kJ, 시간 상수 2분, 보온 0.008/분, 맨 그릇 0.04/분, 주위 20 °C
export function model(g, ml, warm) {
  const Q = g / 56 * 65000, tau = 2, C = ml * 4.18 + 100, k = warm ? 0.008 : 0.04;
  return {
    step(st, dt) {   // st = { t, T }
      const P = Q / tau * Math.exp(-(st.t + dt / 2) / tau);
      const heat = P / C, loss = k * (st.T - 20);
      st.T = Math.min(100, st.T + (heat - loss) * dt); st.t += dt;
      return { heat, loss };
    },
  };
}

const BOX = { w: 0.6, d: 0.46, low: 0.12, top: 0.3, y: 0.02 };

export class CaoScene {
  constructor() {
    this.group = new THREE.Group();
    this.group.add(plate());
    this.fx = []; this.state = 'idle'; this.t = 0; this.speed = 1;
    const g = this.group;
    const at = (x, y, z) => new THREE.Vector3(x, BOX.y + y, z);

    // 보온 포장 (보온일 때만)
    this.wrap = new THREE.Mesh(new THREE.BoxGeometry(BOX.w + 0.08, BOX.d + 0.08, BOX.top + 0.05),
      new THREE.MeshBasicMaterial({ color: 0xf0a040, transparent: true, opacity: 0.14, depthWrite: false }));
    this.wrap.position.copy(at(0, 0, (BOX.top + 0.05) / 2)); g.add(this.wrap);
    this.wrapLab = label('보온 포장', 0.26, { bg: 'rgba(255,225,170,.95)' }); this.wrapLab.position.copy(at(-0.2, -BOX.d / 2 - 0.1, BOX.top + 0.06)); g.add(this.wrapLab);

    // 도시락 용기: 투명한 상자 + 테두리 + 가운데 칸막이
    const box = new THREE.BoxGeometry(BOX.w, BOX.d, BOX.top);
    const shell = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    shell.position.copy(at(0, 0, BOX.top / 2)); g.add(shell);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x55606e }));
    edges.position.copy(shell.position); g.add(edges);
    const mid = new THREE.Mesh(new THREE.PlaneGeometry(BOX.w, BOX.d), new THREE.MeshBasicMaterial({ color: 0x9aa4b0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    mid.position.copy(at(0, 0, BOX.low)); g.add(mid);

    // 아래 칸: 산화 칼슘 알갱이, 물
    this.pelGeo = new THREE.SphereGeometry(0.024, 14, 10);
    this.pelMat = new THREE.MeshBasicMaterial({ color: 0xc9c4b8 });
    this.pels = [];
    this.waterMat = new THREE.MeshBasicMaterial({ color: 0x59b4ff, transparent: true, opacity: 0.45, depthWrite: false });
    this.water = new THREE.Mesh(new THREE.BoxGeometry(BOX.w - 0.03, BOX.d - 0.03, 1), this.waterMat);
    this.water.position.copy(at(0, 0, 0)); this.water.visible = false; g.add(this.water);
    const lowLab = label('아래 칸: 산화 칼슘 + 물', 0.42); lowLab.position.copy(at(0, -BOX.d / 2 - 0.12, 0.0)); g.add(lowLab);

    // 위 칸: 달걀 + 온도계
    const egg = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshLambertMaterial({ color: 0xfff3dc, emissive: 0x6b6253 }));
    egg.scale.set(0.085, 0.062, 0.06); egg.position.copy(at(-0.05, 0.02, BOX.low + 0.065)); g.add(egg);
    this.th = thermometer(0.26); this.th.position.copy(at(0.06, 0.02, BOX.low + 0.02)); g.add(this.th);
    const eggLab = label('달걀 온도계', 0.24); eggLab.position.copy(at(0.16, 0.02, BOX.low + 0.32)); g.add(eggLab);
    g.add(new THREE.HemisphereLight(0xffffff, 0xbbbbcc, 2.4));

    // 열 화살표: 위로 4개(아래 칸 → 달걀), 옆으로 6개(용기 → 주위로 빠져나감)
    this.up = [];
    [[-0.18, -0.1], [0.18, -0.1], [-0.18, 0.12], [0.18, 0.12]].forEach(([x, y], i) => {
      const a = arrow(0.12, 0xff5a1f, 0.03); a.rotation.x = Math.PI / 2; a.position.copy(at(x, y, 0.04)); g.add(a);
      this.up.push({ a, phase: i * 0.25, x, y });
    });
    this.out = [];
    [[1, 0], [-1, 0], [1, 0.5], [-1, 0.5], [1, -0.5], [-1, -0.5]].forEach(([sx, fy], i) => {
      const a = arrow(0.09, 0xff9a5a, 0.025); const h = new THREE.Group();
      h.position.copy(at(sx * (BOX.w / 2), fy * BOX.d / 2 * 0.8, 0.2)); h.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      h.add(a); g.add(h); this.out.push({ a, phase: i * 0.17 });
    });
    this.eq = label('CaO + H₂O → Ca(OH)₂ + 열', 0.5, { bg: 'rgba(255,236,220,.96)' });
    this.eq.position.copy(at(0, BOX.d / 2 + 0.06, BOX.top + 0.14)); this.eq.visible = false; g.add(this.eq);
    this.clock = label('0분', 0.2); this.clock.position.copy(at(0.3, -BOX.d / 2 - 0.1, BOX.top + 0.06)); g.add(this.clock);

    // 물컵 (붓기 연출)
    this.cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.1, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    this.cup.rotation.x = Math.PI / 2; this.cup.visible = false; g.add(this.cup);
    this.setup(40, 200, false);
  }

  // 설계값을 장면에 반영 (붓기 전 상태로)
  setup(g, ml, warm) {
    this.g = g; this.ml = ml; this.warm = warm; this.state = 'idle';
    this.pels.forEach(p => this.group.remove(p.m)); this.pels = [];
    const n = Math.round(g / 5);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.pelGeo, this.pelMat.clone());
      const x = (i % 6 - 2.5) * 0.085 + (Math.random() - .5) * 0.02, y = (Math.floor(i / 6) - 1) * 0.11 + (Math.random() - .5) * 0.02;
      m.position.set(x, BOX.y + y, 0.026); this.group.add(m); this.pels.push({ m, base: m.position.clone() });
    }
    this.water.visible = false; this.wrap.visible = warm; this.wrapLab.visible = warm;
    this.eq.visible = false; this.th.set(0); this.clock.set('0분');
    [...this.up, ...this.out].forEach(o => { o.a.material.opacity = 0; });
    this.fx.forEach(f => this.group.remove(f.s)); this.fx = [];
    this.st = { t: 0, T: 20 }; this.m = model(g, ml, warm); this.heat = 0; this.loss = 0;
  }

  pour(onEnd) {
    if (this.state !== 'idle') return false;
    this.state = 'pour'; this.t = 0; this.onEnd = onEnd; this.speed = 1;
    this.cup.visible = true; this.cup.position.set(BOX.w / 2 - 0.08, BOX.y, BOX.top + 0.16);
    this.water.visible = true; this.wl = 0.02 + this.ml / 300 * 0.07;
    return true;
  }

  puff(pos, vel, color, size, life) {
    const s = sprite(glowTex(), size, { color }); s.position.copy(pos); this.group.add(s);
    this.fx.push({ s, v: vel, t: 0, life });
  }

  tick(dt) {
    this.t += dt;
    if (this.state === 'pour') {   // 1.6초 동안 물을 부음
      const a = clamp(this.t / 1.6, 0, 1);
      this.cup.rotation.y = -a * 1.2;
      const h = Math.max(0.002, this.wl * a); this.water.scale.z = h; this.water.position.z = h / 2 + 0.004;
      if (Math.random() < dt * 30) this.puff(new THREE.Vector3(BOX.w / 2 - 0.12, BOX.y + (Math.random() - .5) * 0.03, BOX.top + 0.08), new THREE.Vector3(0, 0, -0.5), 0x59b4ff, 0.03, 0.5);
      if (a >= 1) { this.state = 'run'; this.cup.visible = false; this.eq.visible = true; this.t = 0; }
    } else if (this.state === 'run') {
      // 1초에 가상 1분, 0.1분씩 나눠 계산
      let left = dt * this.speed;
      while (left > 1e-6 && this.st.t < MINUTES) { const d = Math.min(0.1, left); const r = this.m.step(this.st, d); this.heat = r.heat; this.loss = r.loss; left -= d; }
      this.th.set((this.st.T - 20) / 80);
      this.clock.set(Math.floor(this.st.t) + '분');
      const hi = clamp(this.heat / 15, 0, 1), lo = clamp(this.loss / 2, 0, 1);
      this.up.forEach(o => { const u = (this.t * 0.8 + o.phase) % 1; o.a.position.z = lerp(0.03, 0.2, u); o.a.material.opacity = Math.sin(u * Math.PI) * (0.15 + 0.85 * hi); });
      this.out.forEach(o => { const u = (this.t * 0.6 + o.phase) % 1; o.a.position.y = lerp(0.02, 0.12, u); o.a.material.opacity = Math.sin(u * Math.PI) * lo; });
      // 알갱이가 들썩이며 하얀 가루(수산화 칼슘)로
      const done = 1 - Math.exp(-this.st.t / 2);
      this.pels.forEach(p => {
        p.m.position.set(p.base.x + (Math.random() - .5) * 0.006 * hi, p.base.y + (Math.random() - .5) * 0.006 * hi, p.base.z);
        p.m.material.color.setRGB(lerp(0.79, 0.98, done), lerp(0.77, 0.98, done), lerp(0.72, 0.97, done)); p.m.scale.setScalar(1 + 0.35 * done);
      });
      // 김: 반응이 셀수록, 뜨거울수록 많이
      if (Math.random() < dt * (1 + 8 * hi + (this.st.T > 60 ? 3 : 0))) {
        this.puff(new THREE.Vector3((Math.random() - .5) * BOX.w * 0.8, BOX.y + (Math.random() - .5) * BOX.d * 0.7, BOX.top), new THREE.Vector3(0, 0, 0.12), 0xffffff, 0.06, 1.6);
      }
      if (this.st.t >= MINUTES) { this.state = 'end'; const f = this.onEnd; this.onEnd = null; f && f(); }
    }
    for (const f of [...this.fx]) {
      f.t += dt; f.s.position.addScaledVector(f.v, dt);
      f.s.material.opacity = Math.sin(Math.min(1, f.t / f.life) * Math.PI) * 0.8;
      if (f.t >= f.life) { this.group.remove(f.s); this.fx.splice(this.fx.indexOf(f), 1); }
    }
  }
}
