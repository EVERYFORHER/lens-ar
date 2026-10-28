// 위산 + 제산제 입자 장면 (AR과 3D 보기 공통)
// 좌표: 카드 평면이 XY(가로 1), Z는 카드에서 위로. 입자 1개 = 0.5 mmol (수업용 단순화).
import * as THREE from 'three';

export const KIND = {
  H:  { color: '#e23d3d', label: 'H⁺' },
  Cl: { color: '#2ea043', label: 'Cl⁻' },
  Mg: { color: '#7d7d8a', label: 'Mg²⁺' },
  OH: { color: '#2862d6', label: 'OH⁻' },
  W:  { color: '#3fa9de', label: 'H₂O' },
};
export const PER_TABLET = { Mg: 5, OH: 10 };
export const START = { H: 20, Cl: 20 };

const R = 0.04;                       // 입자 반지름
const BAG = { x: 0.40, y: 0.30, z: 0.16, cy: -0.12, cz: 0.2 };   // 위 주머니(타원체)
const ROW_ORDER = ['H', 'OH', 'W', 'Cl', 'Mg'];

const tex = {};
function texture(k) {
  if (tex[k]) return tex[k];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fillStyle = KIND[k].color; g.fill();
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const t = KIND[k].label;
  g.font = `bold ${t.length > 3 ? 34 : 42}px system-ui, sans-serif`;
  g.fillText(t, 64, 66);
  tex[k] = new THREE.CanvasTexture(c);
  tex[k].colorSpace = THREE.SRGBColorSpace;
  return tex[k];
}

function randInBag() {
  for (;;) {
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    if (v.lengthSq() <= 1) return new THREE.Vector3(v.x * BAG.x * 0.85, BAG.cy + v.y * BAG.y * 0.85, BAG.cz + v.z * BAG.z * 0.85);
  }
}

export class Sim {
  constructor() {
    this.group = new THREE.Group();
    this.parts = [];
    this.lined = false;
    this.busy = false;
    this.tablets = 0;
    const bag = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb8a0, transparent: true, opacity: 0.28, depthWrite: false })
    );
    bag.scale.set(BAG.x + 0.05, BAG.y + 0.05, BAG.z + 0.04);
    bag.position.set(0, BAG.cy, BAG.cz);
    this.group.add(bag);
    this.bag = bag;
    this.reset();
  }

  reset() {
    this.parts.forEach(p => this.group.remove(p.s));
    this.parts = [];
    this.tablets = 0; this.busy = false;
    Object.entries(START).forEach(([k, n]) => { for (let i = 0; i < n; i++) this.add(k, randInBag()); });
    this.setLined(false);
  }

  add(k, pos) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(k) }));
    s.scale.set(R * 2, R * 2, 1);
    s.position.copy(pos);
    this.group.add(s);
    const p = { k, s, tw: null, goal: randInBag(), spd: 0.05 + Math.random() * 0.05 };
    this.parts.push(p);
    return p;
  }

  remove(p) { this.group.remove(p.s); this.parts = this.parts.filter(q => q !== p); }

  count(k) { return this.parts.filter(p => p.k === k).length; }

  tween(p, to, dur, done) { p.tw = { from: p.s.position.clone(), to: to.clone(), t: 0, dur, done }; }

  // 제산제 1알: Mg²⁺·OH⁻가 떨어지고, OH⁻가 H⁺와 하나씩 만나 H₂O가 됨
  addTablet(onDone) {
    if (this.busy) return;
    this.busy = true; this.tablets++;
    this.setLined(false);
    const fresh = [];
    for (const [k, n] of Object.entries(PER_TABLET)) for (let i = 0; i < n; i++) {
      const start = new THREE.Vector3((Math.random() - .5) * 0.3, BAG.cy + BAG.y + 0.25 + Math.random() * 0.1, BAG.cz);
      const p = this.add(k, start);
      this.tween(p, randInBag(), 900 + Math.random() * 400);
      if (k === 'OH') fresh.push(p);
    }
    setTimeout(() => this.react(fresh, onDone), 1500);
  }

  react(ohs, onDone) {
    const hs = this.parts.filter(p => p.k === 'H');
    let pending = 0;
    ohs.forEach(oh => {
      if (!hs.length) return;
      // 가장 가까운 H⁺와 짝
      let bi = 0, bd = Infinity;
      hs.forEach((h, i) => { const d = h.s.position.distanceTo(oh.s.position); if (d < bd) { bd = d; bi = i; } });
      const h = hs.splice(bi, 1)[0];
      const mid = h.s.position.clone().add(oh.s.position).multiplyScalar(0.5);
      pending += 1;
      const delay = Math.random() * 600;
      setTimeout(() => {
        this.tween(h, mid, 900);
        this.tween(oh, mid, 900, () => {
          this.remove(h); this.remove(oh);
          const w = this.add('W', mid);
          w.s.scale.set(R * 2.4, R * 2.4, 1);
          if (--pending === 0) finish();
        });
      }, delay);
    });
    const finish = () => setTimeout(() => { this.busy = false; this.setLined(true); onDone && onDone(); }, 600);
    if (!pending) finish();
  }

  // 줄 세우기: 종류별로 10개씩 줄지어 세기 쉽게
  setLined(on) {
    this.lined = on;
    this.bag.visible = !on;
    if (!on) { this.parts.forEach(p => { p.goal = randInBag(); }); return; }
    let row = 0;
    const top = 0.40, gap = 0.088, x0 = -0.396;
    ROW_ORDER.forEach(k => {
      const list = this.parts.filter(p => p.k === k);
      if (!list.length) return;
      list.forEach((p, i) => {
        const r = row + Math.floor(i / 10);
        this.tween(p, new THREE.Vector3(x0 + (i % 10) * gap, top - r * gap, 0.12), 700);
      });
      row += Math.ceil(list.length / 10) + 0.25;   // 종류 사이 살짝 띄움
    });
  }

  tick(dt) {
    for (const p of this.parts) {
      if (p.tw) {
        const w = p.tw; w.t += dt * 1000;
        const a = Math.min(1, w.t / w.dur), e = a < .5 ? 2 * a * a : 1 - Math.pow(-2 * a + 2, 2) / 2;
        p.s.position.lerpVectors(w.from, w.to, e);
        if (a >= 1) { p.tw = null; w.done && w.done(); }
      } else if (!this.lined) {
        const d = p.goal.clone().sub(p.s.position);
        if (d.length() < 0.01) p.goal = randInBag();
        else p.s.position.add(d.normalize().multiplyScalar(Math.min(p.spd * dt, d.length())));
      }
    }
  }
}
