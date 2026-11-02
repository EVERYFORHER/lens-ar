// 장면 조작 도구: 화면 오른쪽 아이콘을 끌어다 카드 위 물체에 씀 (AR·3D 공통)
// kind: drop(놓으면 끝) / hold(대고 누르고 있기, need초) / rub(대고 문지르기·젓기·돌리기, need px)
// 도구가 없을 때 touch를 정해 두면 물체를 손가락으로 눌러 느껴 볼 수 있음
const R = 120;   // 물체 둘레 몇 px 안이면 "닿음"

export class ToolTray {
  constructor(project) {
    this.project = project;   // (Vector3 장면 좌표) → {x, y} 화면 좌표, 아직 못 구하면 null
    this.box = document.createElement('div'); this.box.id = 'tools'; document.body.appendChild(this.box);
    this.gauge = document.createElement('div'); this.gauge.id = 'gauge'; this.gauge.className = 'hidden';
    this.gauge.innerHTML = '<span></span><i><b></b></i>'; document.body.appendChild(this.gauge);
    this.list = []; this.touch = null; this.drag = null;
    this.loop = this.loop.bind(this); this.last = performance.now(); requestAnimationFrame(this.loop);
    // 물체 눌러 느끼기 (캔버스를 살짝 눌렀다 뗄 때)
    let down = null;
    addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; }, true);
    addEventListener('pointerup', e => {
      if (!down || !this.touch || this.drag || e.target.closest('#panel, #top, #tools, #menu')) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (moved > 12) return;
      const p = this.where(this.touch.target());
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) < R) this.touch.feel(e.clientX, e.clientY);
    }, true);
  }

  where(v) { return v ? this.project(v) : null; }
  // 물체를 아직 못 찾았으면 화면 가운데 위쪽을 대신 씀
  aim(t) { return this.where(t.target()) || { x: innerWidth / 2, y: innerHeight * 0.3 }; }

  set(list) {
    this.list = list || []; this.box.innerHTML = ''; this.hideGauge();
    this.list.forEach(t => {
      t.p = t.p || 0;
      const el = document.createElement('div'); el.className = 'tool'; el.innerHTML = `<span>${t.icon}</span><small>${t.label}</small>`;
      this.box.appendChild(el); t.el = el; this.bind(t);
    });
  }
  clear() { this.set([]); }

  bind(t) {
    const el = t.el;
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      this.drag = { t, x: e.clientX, y: e.clientY, near: false };
      el.classList.add('drag'); this.move(e.clientX, e.clientY);
    });
    el.addEventListener('pointermove', e => {
      const d = this.drag; if (!d || d.t !== t) return;
      if (t.kind === 'rub' && d.near) {
        const len = Math.hypot(e.clientX - d.x, e.clientY - d.y);
        t.p = Math.min(1, t.p + len / t.need); d.rubAcc = (d.rubAcc || 0) + len;
        if (d.rubAcc > 90) { d.rubAcc = 0; t.onStep && t.onStep(); }
        t.onProgress && t.onProgress(t.p); this.showGauge(t);
        if (t.p >= 1) return this.finish(t);
      }
      d.x = e.clientX; d.y = e.clientY; this.move(e.clientX, e.clientY);
    });
    const up = () => {
      const d = this.drag; if (!d || d.t !== t) return;
      this.drag = null; this.home(t);
      if (t.kind === 'drop') { if (d.near) this.finish(t); else this.hint(t); }
      else if (t.p < 1 && !d.near) this.hint(t);
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  move(x, y) {
    const d = this.drag, el = d.t.el;
    el.style.left = (x - 32) + 'px'; el.style.top = (y - 32) + 'px';
    const p = this.aim(d.t);
    d.near = Math.hypot(x - p.x, y - p.y) < R;
    el.classList.toggle('near', d.near);
  }
  home(t) { t.el.style.left = ''; t.el.style.top = ''; t.el.classList.remove('drag', 'near'); }
  hint(t) { this.toast && this.toast(t.miss || `${t.icon}를 ${t.where || '물체'}까지 끌어다 대요`); }

  finish(t) {
    if (t.done) return;
    t.p = 1; t.uses = (t.uses || 0) + 1;
    this.drag = null; this.home(t); this.hideGauge();
    if (t.repeat && t.uses < t.repeat) { t.p = 0; t.onDone && t.onDone(t.uses); this.label(t); return; }
    t.done = true; t.el.remove(); this.list = this.list.filter(x => x !== t);
    t.onDone && t.onDone(t.uses);
  }
  label(t) { if (t.repeat) t.el.querySelector('small').textContent = `${t.label} ${t.uses}/${t.repeat}`; }

  // 누르고 있기: 대고 있는 동안 시간이 쌓임
  loop(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const d = this.drag;
    if (d && d.t.kind === 'hold' && d.near) {
      const t = d.t; t.p = Math.min(1, t.p + dt / t.need);
      t.acc = (t.acc || 0) + dt; if (t.acc > (t.every || 0.3)) { t.acc = 0; t.onStep && t.onStep(); }
      t.onProgress && t.onProgress(t.p); this.showGauge(t);
      if (t.p >= 1) this.finish(t);
    }
    requestAnimationFrame(this.loop);
  }
  showGauge(t) {
    this.gauge.classList.remove('hidden');
    this.gauge.querySelector('span').textContent = t.doing || t.label;
    this.gauge.querySelector('b').style.width = Math.round(t.p * 100) + '%';
  }
  hideGauge() { this.gauge.classList.add('hidden'); }
}

// 손에 닿는 느낌: 글자 풍선 + 진동
export function feelPop(x, y, text, hot) {
  const el = document.createElement('div'); el.className = 'feel ' + (hot ? 'hot' : 'cold'); el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px'; document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
  try { navigator.vibrate && navigator.vibrate(hot ? [40, 40, 40, 40, 40] : [220]); } catch (e) {}
}
