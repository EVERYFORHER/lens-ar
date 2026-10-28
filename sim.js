// 위산 + 제산제 입자 장면 (AR과 3D 보기 공통)
// 좌표: 카드 평면이 XY(가로 1, 세로 1.41), Z는 카드에서 위로. 입자 1개 = 0.5 mmol (수업용 단순화).
// 카드 위에 반투명 상반신(입·식도·위)이 누워 있고, 반응은 위 속에서 일어남.
import * as THREE from 'three';

export const KIND = {
  H:  { color: '#e23d3d', label: 'H⁺' },
  Cl: { color: '#2ea043', label: 'Cl⁻', spect: true },
  Mg: { color: '#7d7d8a', label: 'Mg²⁺', spect: true },
  OH: { color: '#2862d6', label: 'OH⁻' },
  W:  { color: '#3fa9de', label: 'H₂O' },
};
export const PER_TABLET = { Mg: 5, OH: 10 };
export const START = { H: 20, Cl: 20 };

const R = 0.027;                                   // 입자 반지름
const MOUTH = new THREE.Vector3(0, 0.455, 0.05);
const ST = { c: new THREE.Vector3(0.04, -0.24, 0.12), a: 0.27, b: 0.19, d: 0.10, rot: -0.35 };   // 위(타원체)
const ROW_ORDER = ['H', 'OH', 'W', 'Cl', 'Mg'];
const stRot = new THREE.Matrix4().makeRotationZ(ST.rot), stInv = new THREE.Matrix4().makeRotationZ(-ST.rot);

/* ---------- 텍스처 ---------- */
const tex = {};
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texture(k) {
  if (tex[k]) return tex[k];
  tex[k] = canvasTex(128, 128, g => {
    if (k === 'W') {   // 물 분자: O 하나에 H 둘
      g.fillStyle = '#e8f6ff'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 4;
      [[36, 40], [92, 40]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 22, 0, 7); g.fill(); g.stroke(); });
      g.fillStyle = KIND.W.color; g.beginPath(); g.arc(64, 74, 44, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('H₂O', 64, 78);
      return;
    }
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2);
    g.fillStyle = KIND[k].color; g.fill();
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const t = KIND[k].label;
    g.font = `bold ${t.length > 3 ? 34 : 42}px system-ui, sans-serif`;
    g.fillText(t, 64, 66);
  });
  return tex[k];
}
const glowTex = () => tex.glow || (tex.glow = canvasTex(128, 128, g => {
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  r.addColorStop(0, 'rgba(255,255,200,1)'); r.addColorStop(.4, 'rgba(255,230,120,.7)'); r.addColorStop(1, 'rgba(255,200,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
}));
function labelSprite(text, w = 0.42) {
  const t = canvasTex(512, 96, g => {
    g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = '#1d2733'; g.lineWidth = 4;
    g.beginPath(); g.roundRect(4, 4, 504, 88, 30); g.fill(); g.stroke();
    g.fillStyle = '#1d2733'; g.font = `bold ${text.length > 14 ? 34 : 44}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 50);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(w, w * 96 / 512, 1); s.renderOrder = 10;
  return s;
}

/* ---------- 위 속 좌표 ---------- */
function toStomach(v) { return v.clone().sub(ST.c).applyMatrix4(stInv); }
function fromStomach(v) { return v.clone().applyMatrix4(stRot).add(ST.c); }
function randInStomach() {
  for (;;) {
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    if (v.lengthSq() <= 1) return fromStomach(new THREE.Vector3(v.x * (ST.a - R * 1.5), v.y * (ST.b - R * 1.5), v.z * (ST.d - R)));
  }
}
function clampStomach(p) {
  const l = toStomach(p);
  const n = Math.hypot(l.x / (ST.a - R * 1.2), l.y / (ST.b - R * 1.2), l.z / (ST.d - R * 0.8));
  if (n > 1) p.copy(fromStomach(l.multiplyScalar(1 / n)));
}

/* ---------- 몸 (입·식도·위) ---------- */
function makeBody() {
  const g = new THREE.Group();
  const skin = new THREE.MeshBasicMaterial({ color: 0xffe0c8, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const s = new THREE.Shape();
  s.moveTo(-0.07, 0.40); s.lineTo(-0.07, 0.34);
  s.quadraticCurveTo(-0.40, 0.33, -0.42, 0.18); s.lineTo(-0.42, -0.62); s.quadraticCurveTo(-0.42, -0.68, -0.36, -0.68);
  s.lineTo(0.38, -0.68); s.quadraticCurveTo(0.44, -0.68, 0.44, -0.62); s.lineTo(0.44, 0.18);
  s.quadraticCurveTo(0.42, 0.33, 0.07, 0.34); s.lineTo(0.07, 0.40);
  const torso = new THREE.Mesh(new THREE.ShapeGeometry(s, 24), skin); torso.position.z = 0.004; g.add(torso);
  const head = new THREE.Mesh(new THREE.CircleGeometry(0.13, 40), skin); head.position.set(0, 0.52, 0.006); g.add(head);
  const dark = new THREE.MeshBasicMaterial({ color: 0x3a2a2a });
  [-0.045, 0.045].forEach(x => { const e = new THREE.Mesh(new THREE.CircleGeometry(0.014, 16), dark); e.position.set(x, 0.55, 0.01); g.add(e); });
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), new THREE.MeshBasicMaterial({ color: 0xa83a3a }));
  mouth.scale.set(1.4, 0.7, 1); mouth.position.set(MOUTH.x, MOUTH.y, 0.012); g.add(mouth);
  // 식도
  const path = new THREE.CatmullRomCurve3([MOUTH.clone(), new THREE.Vector3(0, 0.30, 0.07), new THREE.Vector3(-0.01, 0.10, 0.09),
    new THREE.Vector3(0.0, -0.02, 0.11), fromStomach(new THREE.Vector3(-0.15, 0.13, 0))]);
  const pink = new THREE.MeshBasicMaterial({ color: 0xff9a9a, transparent: true, opacity: 0.5, depthWrite: false });
  g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 40, 0.022, 12, false), pink));
  // 위
  const stomach = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24),
    new THREE.MeshBasicMaterial({ color: 0xff8f8f, transparent: true, opacity: 0.28, depthWrite: false }));
  stomach.scale.set(ST.a, ST.b, ST.d); stomach.position.copy(ST.c); stomach.rotation.z = ST.rot; g.add(stomach);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012 / ST.b, 8, 64), new THREE.MeshBasicMaterial({ color: 0xc04848, transparent: true }));
  rim.scale.set(ST.a, ST.b, 1); rim.position.copy(ST.c); rim.rotation.z = ST.rot; g.add(rim);
  const lab = labelSprite('위산 모형: 0.1 M 염산 100 mL', 0.5);
  lab.position.set(0.04, -0.52, 0.06); g.add(lab);
  // 알약 들어갈 곳 표시 (입 주변 고리)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 40), new THREE.MeshBasicMaterial({ color: 0xffc400, transparent: true, opacity: 0.9 }));
  ring.position.set(MOUTH.x, MOUTH.y, 0.02); g.add(ring);
  return { g, path, ring, mats: [skin, pink, stomach.material, rim.material, lab.material] };
}

/* ---------- 시뮬레이션 ---------- */
export class Sim {
  constructor() {
    this.group = new THREE.Group();
    this.body = makeBody();
    this.group.add(this.body.g);
    this.parts = [];
    this.fx = [];               // 반짝임·말풍선 등 잠깐 보이는 것
    this.lined = false;
    this.busy = false;
    this.speed = 1;
    this.tablets = 0;
    this.slowShown = false;
    this.pillGeo = new THREE.CapsuleGeometry(0.03, 0.05, 6, 12);
    this.pillMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666 });
    this.group.add(new THREE.HemisphereLight(0xffffff, 0x666677, 1.6));
    this.reset();
  }

  get mouth() { return MOUTH; }
  waiting(on) { this.body.ring.visible = on; }

  reset() {
    this.parts.forEach(p => this.group.remove(p.s));
    this.fx.forEach(f => this.group.remove(f.o));
    this.parts = []; this.fx = [];
    this.tablets = 0; this.busy = false; this.speed = 1; this.slowShown = false;
    Object.entries(START).forEach(([k, n]) => { for (let i = 0; i < n; i++) this.add(k, randInStomach()); });
    this.setLined(false);
  }

  add(k, pos) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(k), transparent: true }));
    const r = k === 'W' ? R * 1.25 : R;
    s.scale.set(r * 2, r * 2, 1);
    s.position.copy(pos);
    s.material.opacity = KIND[k].spect && !this.lined ? 0.45 : 1;
    this.group.add(s);
    const p = { k, s, tw: null, v: new THREE.Vector3(), lock: false };
    this.parts.push(p);
    return p;
  }

  remove(p) { this.group.remove(p.s); this.parts = this.parts.filter(q => q !== p); }
  count(k) { return this.parts.filter(p => p.k === k).length; }
  tween(p, to, dur, done) { p.tw = { from: p.s.position.clone(), to: to.clone(), t: 0, dur, done }; }
  later(ms, fn) { const f = { t: 0, dur: ms, fn }; this.fx.push(f); }   // 속도 배율을 따르는 타이머

  flash(pos, big) {
    const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    o.position.copy(pos); o.renderOrder = 5; this.group.add(o);
    this.fx.push({ o, t: 0, dur: big ? 900 : 500, grow: big ? 0.22 : 0.12 });
  }
  bubble(text, pos, ms) {
    const o = labelSprite(text, 0.46); o.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0.12)); this.group.add(o);
    this.fx.push({ o, t: 0, dur: ms, still: true });
  }

  // 제산제 1알: 입 → 식도 → 위, 위에서 부서져 Mg²⁺·OH⁻가 퍼짐
  feed(onDone) {
    if (this.busy) return false;
    this.busy = true; this.tablets++;
    this.setLined(false); this.waiting(false);
    const pill = new THREE.Mesh(this.pillGeo, this.pillMat);
    pill.position.copy(MOUTH).add(new THREE.Vector3(0, 0.08, 0.1));
    this.group.add(pill);
    const f = { o: pill, t: 0, dur: 2200, path: this.body.path, done: () => {
      const at = pill.position.clone();
      this.group.remove(pill);
      this.flash(at, true);
      const fresh = [];
      for (const [k, n] of Object.entries(PER_TABLET)) for (let i = 0; i < n; i++) {
        const p = this.add(k, at.clone().add(new THREE.Vector3((Math.random() - .5) * .04, (Math.random() - .5) * .04, 0)));
        p.lock = true;
        this.tween(p, randInStomach(), 900 + Math.random() * 500, () => { p.lock = false; });
        if (k === 'OH') fresh.push(p);
      }
      this.later(1700, () => this.react(fresh, onDone));
    } };
    this.fx.push(f);
    return true;
  }

  // OH⁻가 H⁺를 하나씩 찾아가 H₂O가 됨. 첫 쌍은 느린 화면.
  react(ohs, onDone) {
    const next = () => {
      const hs = this.parts.filter(p => p.k === 'H' && !p.lock);
      const oh = ohs.shift();
      if (!oh || !hs.length) { this.later(700, () => { this.busy = false; this.speed = 1; this.setLined(true); onDone && onDone(); }); return; }
      let h = hs[0], bd = Infinity;
      hs.forEach(c => { const d = c.s.position.distanceTo(oh.s.position); if (d < bd) { bd = d; h = c; } });
      const slow = !this.slowShown; this.slowShown = true;
      h.lock = oh.lock = true;
      [h, oh].forEach(p => p.s.scale.multiplyScalar(slow ? 1.5 : 1.2));
      if (slow) this.bubble('OH⁻가 H⁺를 찾아가요', h.s.position, 2400);
      const meet = h.s.position.clone();
      this.tween(oh, meet, slow ? 2400 : 650, () => {
        this.remove(h); this.remove(oh);
        this.flash(meet, slow);
        const w = this.add('W', meet);
        w.s.scale.multiplyScalar(slow ? 1.6 : 1.2);
        this.tween(w, meet.clone().add(new THREE.Vector3(0, 0, 0.04)), 300, () => { w.s.scale.set(R * 2.5, R * 2.5, 1); });
        if (slow) { this.bubble('H⁺ + OH⁻ → H₂O', meet, 2600); this.later(2400, next); }
        else this.later(180, next);
      });
    };
    next();
  }

  // 줄 세우기: 종류별로 10개씩, 몸은 흐리게
  setLined(on) {
    this.lined = on;
    this.body.mats.forEach(m => { m.opacity = on ? 0.12 : (m.userData.o || (m.userData.o = m.opacity)); });
    this.parts.forEach(p => { p.s.material.opacity = KIND[p.k].spect && !on ? 0.45 : 1; });
    if (!on) { this.parts.forEach(p => { if (!p.tw && !p.lock) { p.lock = true; this.tween(p, randInStomach(), 700, () => { p.lock = false; }); } }); return; }
    let row = 0;
    const top = 0.26, gap = 0.064, x0 = -0.29;
    ROW_ORDER.forEach(k => {
      const list = this.parts.filter(p => p.k === k);
      if (!list.length) return;
      list.forEach((p, i) => {
        const r = row + Math.floor(i / 10);
        this.tween(p, new THREE.Vector3(x0 + (i % 10) * gap, top - r * gap, 0.26), 800);
      });
      row += Math.ceil(list.length / 10) + 0.3;
    });
  }

  tick(dt) {
    const ms = dt * 1000 * this.speed;
    // 잠깐 보이는 것들
    for (const f of [...this.fx]) {
      f.t += ms;
      const a = Math.min(1, f.t / f.dur);
      if (f.path) { f.o.position.copy(f.path.getPointAt(a * a)).add(new THREE.Vector3(0, 0, 0.02)); f.o.rotation.z += dt * 4; }
      else if (f.grow) { const s = f.grow * (0.3 + a); f.o.scale.set(s, s, 1); f.o.material.opacity = 1 - a; }
      if (a >= 1) {
        this.fx = this.fx.filter(x => x !== f);
        if (f.o && !f.path) this.group.remove(f.o);
        f.fn && f.fn(); f.done && f.done();
      }
    }
    // 입자
    const free = this.lined ? [] : this.parts.filter(p => !p.tw && !p.lock);
    for (const p of this.parts) {
      if (!p.tw) continue;
      const w = p.tw; w.t += ms;
      const a = Math.min(1, w.t / w.dur), e = a < .5 ? 2 * a * a : 1 - Math.pow(-2 * a + 2, 2) / 2;
      p.s.position.lerpVectors(w.from, w.to, e);
      if (a >= 1) { p.tw = null; w.done && w.done(); }
    }
    if (!free.length) return;
    // 떠다니기 + 서로 밀어내기 (겹치지 않게)
    const min = R * 2.3;
    for (const p of free) {
      p.v.x += (Math.random() - .5) * 0.06 * dt; p.v.y += (Math.random() - .5) * 0.06 * dt; p.v.z += (Math.random() - .5) * 0.03 * dt;
      p.v.multiplyScalar(0.97);
    }
    for (let i = 0; i < this.parts.length; i++) for (let j = i + 1; j < this.parts.length; j++) {
      const A = this.parts[i], B = this.parts[j];
      const d = A.s.position.distanceTo(B.s.position);
      if (d >= min || d === 0) continue;
      const push = B.s.position.clone().sub(A.s.position).multiplyScalar((min - d) / d * 0.5);
      if (!A.tw && !A.lock) A.s.position.sub(push);
      if (!B.tw && !B.lock) B.s.position.add(push);
    }
    for (const p of free) {
      const sp = p.v.length(); if (sp > 0.03) p.v.multiplyScalar(0.03 / sp);
      p.s.position.addScaledVector(p.v, dt);
      clampStomach(p.s.position);
    }
  }
}
