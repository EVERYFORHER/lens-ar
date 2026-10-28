// 확장 장면 공통 부품: 텍스처, 글자 표, 실험대 판, 화살표
// 좌표는 sim.js와 같음: 카드 평면 XY(가로 1, 세로 1.41), Z는 카드에서 위로.
import * as THREE from 'three';

export const CARD_H = 1269 / 900;

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// 글자 표 (늘 카메라를 봄). 내용을 바꿀 수 있게 set(text)
export function label(text, w = 0.42, opt = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(w, w * 96 / 512, 1); s.renderOrder = 10;
  s.set = txt => {
    const g = c.getContext('2d'); g.clearRect(0, 0, 512, 96);
    g.fillStyle = opt.bg || 'rgba(255,255,255,.95)'; g.strokeStyle = opt.line || '#1d2733'; g.lineWidth = 4;
    g.beginPath(); g.roundRect(4, 4, 504, 88, 30); g.fill(); g.stroke();
    g.fillStyle = opt.ink || '#1d2733'; g.font = `bold ${txt.length > 16 ? 30 : txt.length > 11 ? 38 : 44}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 256, 50);
    t.needsUpdate = true;
  };
  s.set(text);
  return s;
}

// 동그란 입자 (글자 선택)
const dots = {};
export function dotTex(color, text = '') {
  const k = color + text;
  return dots[k] || (dots[k] = canvasTex(128, 128, g => {
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fillStyle = color; g.fill();
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.45)'; g.stroke();
    if (text) { g.fillStyle = '#fff'; g.font = `bold ${text.length > 3 ? 32 : 42}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 66); }
  }));
}
// 물 분자 (O 하나에 H 둘)
let waterT = null;
export function waterTex() {
  return waterT || (waterT = canvasTex(128, 128, g => {
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 4;
    g.fillStyle = '#f2f6fa'; [[30, 36], [98, 36]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 22, 0, 7); g.fill(); g.stroke(); });
    g.fillStyle = '#e23d3d'; g.beginPath(); g.arc(64, 72, 42, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('O', 64, 74);
  }));
}
let glowT = null;
export function glowTex() {
  return glowT || (glowT = canvasTex(128, 128, g => {
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  }));
}
export function sprite(map, size, opt = {}) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, ...opt }));
  s.scale.set(size, size, 1); return s;
}

// 몸 카드를 덮는 실험대 판 (사람 그림을 가림)
export function plate() {
  const t = canvasTex(256, 360, g => {
    g.fillStyle = '#e9e5dc'; g.fillRect(0, 0, 256, 360);
    g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 2;
    for (let x = 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 360); g.stroke(); }
    for (let y = 0; y <= 360; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    g.strokeStyle = '#b9b2a3'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 352);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.02, CARD_H + 0.02), new THREE.MeshBasicMaterial({ map: t }));
  m.position.z = 0.002;
  return m;
}

// 굵은 화살표 (+Y 방향, 길이 len). 색·투명도는 mat으로
export function arrow(len, color, w = 0.035) {
  const s = new THREE.Shape();
  const hl = Math.min(len * 0.45, w * 2.6);
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, len - hl); s.lineTo(w * 1.3, len - hl);
  s.lineTo(0, len); s.lineTo(-w * 1.3, len - hl); s.lineTo(-w / 2, len - hl); s.closePath();
  return new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
}

// 온도계: 세로로 선 유리관 + 빨간 기둥. set(0~1)
export function thermometer(h = 0.32) {
  const g = new THREE.Group();
  const glass = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, h, 16, 1, true), glass);
  tube.rotation.x = Math.PI / 2; tube.position.z = h / 2 + 0.03; g.add(tube);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.032, 20, 12), new THREE.MeshBasicMaterial({ color: 0xd62828 }));
  bulb.position.z = 0.03; g.add(bulb);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 10), new THREE.MeshBasicMaterial({ color: 0xd62828 }));
  col.rotation.x = Math.PI / 2; g.add(col);
  for (let i = 1; i < 5; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.003, 0.003), new THREE.MeshBasicMaterial({ color: 0x333333 }));
    tick.position.set(0.02, 0, 0.03 + h * i / 5); g.add(tick);
  }
  g.set = v => { const l = Math.max(0.01, Math.min(1, v)) * h; col.scale.y = l; col.position.z = 0.03 + l / 2; };
  g.set(0.5);
  return g;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
