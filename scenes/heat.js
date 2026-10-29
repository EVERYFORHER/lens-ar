// ① 열 흐름: 비커(계)와 주위 공기 사이로 열이 오가는 모습
// 통합과학 3차시는 "주위 온도 오름/내림", 물질과 에너지 3차시는 "ΔS주위 부호"를 고름
import * as THREE from 'three';
import { plate, label, sprite, dotTex, glowTex, arrow, thermometer, lerp, clamp } from './kit.js?v=20261029c';

export const RX = [
  { k: '중화', name: '중화 반응', eq: 'HCl + NaOH → NaCl + H₂O', exo: true, liquid: 0xbfe3ff },
  { k: '질산암모늄', name: '질산 암모늄 + 수산화 바륨', eq: 'Ba(OH)₂ + 2NH₄NO₃ → …', exo: false, liquid: 0xf2f2f2 },
  { k: '응결', name: '수증기의 응결', eq: 'H₂O(g) → H₂O(l)', exo: true, liquid: 0xa8d8ff },
  { k: '기화', name: '물의 기화', eq: 'H₂O(l) → H₂O(g)', exo: false, liquid: 0xa8d8ff },
];

const B = { x: 0, y: 0.08, r: 0.15, h: 0.26 };   // 비커
const WALL = { x: 0.47, y0: -0.64, y1: 0.66, z0: 0.03, z1: 0.42 };
const COLD = new THREE.Color(0x4f8fe8), MID = new THREE.Color(0x98a4b2), HOT = new THREE.Color(0xff7a2e);

export class HeatScene {
  constructor() {
    this.group = new THREE.Group();
    this.group.add(plate());
    this.T = 25; this.Tgoal = 25; this.flow = 0; this.cur = null; this.t = 0; this.fx = [];

    // 비커와 용액
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(B.r, B.r * 0.95, B.h, 40, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    glass.rotation.x = Math.PI / 2; glass.position.set(B.x, B.y, B.h / 2); this.group.add(glass);
    this.liqMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.7, depthWrite: false });
    this.liquid = new THREE.Mesh(new THREE.CylinderGeometry(B.r * 0.93, B.r * 0.9, 1, 40), this.liqMat);
    this.liquid.rotation.x = Math.PI / 2; this.group.add(this.liquid); this.setLevel(0.15);

    // 계 경계선: 빛나는 고리 두 개 + 투명한 벽
    this.edgeMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false });
    [0.01, B.h + 0.05].forEach(z => { const t = new THREE.Mesh(new THREE.TorusGeometry(B.r + 0.05, 0.008, 8, 64), this.edgeMat); t.position.set(B.x, B.y, z); this.group.add(t); });
    this.wallMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(B.r + 0.05, B.r + 0.05, B.h + 0.04, 48, 1, true), this.wallMat);
    wall.rotation.x = Math.PI / 2; wall.position.set(B.x, B.y, (B.h + 0.06) / 2); this.group.add(wall);
    const ls = label('계 (비커 속 물질)', 0.34, { bg: 'rgba(255,240,180,.95)' }); ls.position.set(B.x, B.y + 0.27, B.h + 0.1); this.group.add(ls);
    const lw = label('주위 (공기)', 0.3); lw.position.set(-0.32, -0.55, 0.12); this.group.add(lw);
    this.eq = label(' ', 0.5); this.eq.position.set(B.x, B.y - 0.3, B.h + 0.12); this.eq.visible = false; this.group.add(this.eq);

    // 주위 공기 입자: 한 재질을 같이 써서 온도에 따라 색이 함께 바뀜
    this.airMat = new THREE.SpriteMaterial({ map: dotTex('#ffffff'), transparent: true, depthWrite: false });
    this.air = [];
    while (this.air.length < 34) {
      const p = new THREE.Vector3(lerp(-WALL.x, WALL.x, Math.random()), lerp(WALL.y0, WALL.y1, Math.random()), lerp(WALL.z0, WALL.z1, Math.random()));
      if (Math.hypot(p.x - B.x, p.y - B.y) < B.r + 0.1) continue;
      const s = new THREE.Sprite(this.airMat); s.scale.set(0.034, 0.034, 1); s.position.copy(p); this.group.add(s);
      const v = new THREE.Vector3().randomDirection(); v.z *= 0.5;
      this.air.push({ s, v: v.normalize() });
    }

    // 온도계
    this.th = thermometer(0.34); this.th.position.set(0.36, -0.38, 0); this.group.add(this.th);
    this.tl = label('주위 25.0 °C', 0.34); this.tl.position.set(0.32, -0.56, 0.06); this.group.add(this.tl);

    // 열 화살표 8개 (비커 둘레)
    this.arrows = [];
    for (let i = 0; i < 8; i++) {
      const a = arrow(0.11, 0xff5a1f, 0.03), holder = new THREE.Group();
      const ang = i / 8 * Math.PI * 2;
      holder.position.set(B.x, B.y, 0.14); holder.rotation.z = ang - Math.PI / 2; holder.add(a); a.visible = false;
      this.group.add(holder); this.arrows.push({ a, phase: i % 2 * 0.5 });
    }
    this.heatTag = label('열', 0.1, { bg: 'rgba(255,90,31,.95)', ink: '#fff', line: '#b23b0c' });
    this.heatTag.position.set(B.x + 0.3, B.y + 0.16, 0.2); this.heatTag.visible = false; this.group.add(this.heatTag);
  }

  setLevel(h) { this.level = h; this.liquid.scale.y = h; this.liquid.position.set(B.x, B.y, 0.012 + h / 2); }

  // 반응 켜기: 6초 동안 열이 흐르고 주위 온도가 바뀜
  run(rx, onShown) {
    this.cur = rx; this.t = 0; this.T = 25; this.Tgoal = rx.exo ? 33 : 17; this.flow = 1; this.onShown = onShown;
    this.liqMat.color.set(rx.liquid); this.setLevel(rx.k === '응결' ? 0.08 : 0.15);
    this.eq.set(rx.eq); this.eq.visible = true;
    this.heatTag.visible = true;
    this.arrows.forEach(o => { o.a.visible = true; });
  }
  stop() { this.flow = 0; this.arrows.forEach(o => { o.a.visible = false; }); this.heatTag.visible = false; }
  reset() { this.stop(); this.cur = null; this.Tgoal = 25; this.eq.visible = false; }

  puff(pos, vel, color, size, life) {
    const s = sprite(glowTex(), size, { color }); s.position.copy(pos); this.group.add(s);
    this.fx.push({ s, v: vel, t: 0, life });
  }

  tick(dt) {
    this.t += dt;
    // 온도: 반응 중에는 목표로, 아니면 천천히 25 °C로
    this.T = lerp(this.T, this.Tgoal, clamp(dt * 0.5, 0, 1));
    if (this.cur && this.onShown && this.t > 6) { const f = this.onShown; this.onShown = null; f(); }
    const n = clamp((this.T - 17) / 16, 0, 1);
    this.th.set(0.15 + n * 0.75);
    if (Math.abs(this.T - (this._shownT || 0)) > 0.05) { this.tl.set(`주위 ${this.T.toFixed(1)} °C`); this._shownT = this.T; }
    this.airMat.color.copy(n < 0.5 ? COLD.clone().lerp(MID, n * 2) : MID.clone().lerp(HOT, n * 2 - 1));
    // 공기 입자: 온도가 높을수록 빠름
    const sp = 0.05 * Math.pow((this.T + 273) / 298, 8) * (this.T > 25 ? 1.6 : 1);
    for (const p of this.air) {
      p.v.x += (Math.random() - .5) * dt; p.v.y += (Math.random() - .5) * dt; p.v.normalize();
      const q = p.s.position; q.addScaledVector(p.v, sp * dt);
      if (Math.abs(q.x) > WALL.x) { q.x = Math.sign(q.x) * WALL.x; p.v.x *= -1; }
      if (q.y < WALL.y0 || q.y > WALL.y1) { q.y = clamp(q.y, WALL.y0, WALL.y1); p.v.y *= -1; }
      if (q.z < WALL.z0 || q.z > WALL.z1) { q.z = clamp(q.z, WALL.z0, WALL.z1); p.v.z *= -1; }
      const dx = q.x - B.x, dy = q.y - B.y, d = Math.hypot(dx, dy), m = B.r + 0.08;
      if (d < m) { q.x = B.x + dx / d * m; q.y = B.y + dy / d * m; p.v.x = dx / d; p.v.y = dy / d; }
    }
    // 경계선 반짝임
    this.edgeMat.opacity = 0.6 + 0.35 * Math.sin(this.t * 3);
    // 화살표: 발열이면 계 → 주위(밖으로), 흡열이면 주위 → 계(안으로)
    if (this.flow && this.cur) {
      const out = this.cur.exo;
      this.arrows.forEach(o => {
        const u = (this.t * 0.45 + o.phase) % 1;
        const r = out ? lerp(B.r + 0.06, B.r + 0.26, u) : lerp(B.r + 0.36, B.r + 0.16, u);
        o.a.position.y = r; o.a.rotation.z = out ? 0 : Math.PI;   // 뒤집으면 끝이 안쪽을 향함
        o.a.material.opacity = Math.sin(u * Math.PI) * 0.95;
      });
      // 반응마다 비커 속 모습
      if (Math.random() < dt * 6) {
        const at = new THREE.Vector3(B.x + (Math.random() - .5) * B.r * 1.4, B.y + (Math.random() - .5) * B.r * 1.4, 0.03);
        if (this.cur.k === '기화') { at.z = this.level; this.puff(at, new THREE.Vector3(0, 0, 0.1), 0xffffff, 0.06, 2.2); }
        else if (this.cur.k === '응결') { at.z = B.h + 0.12; this.puff(at, new THREE.Vector3(0, 0, -0.08), 0xe8f4ff, 0.07, 1.6); this.setLevel(Math.min(0.16, this.level + dt * 0.006)); }
        else if (this.cur.k === '질산암모늄') { at.z = 0.02 + Math.random() * this.level; this.puff(at, new THREE.Vector3(0, 0, 0.01), 0xbfe6ff, 0.035, 1.2); }
        else { at.z = 0.02 + Math.random() * this.level; this.puff(at, new THREE.Vector3(0, 0, 0.02), 0xffe9a8, 0.04, 0.9); }
      }
    }
    for (const f of [...this.fx]) {
      f.t += dt; f.s.position.addScaledVector(f.v, dt);
      f.s.material.opacity = Math.sin(Math.min(1, f.t / f.life) * Math.PI);
      if (f.t >= f.life) { this.group.remove(f.s); this.fx.splice(this.fx.indexOf(f), 1); }
    }
  }
}
