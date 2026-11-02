// LENS 확장 AR 장면 (?scene=heat | cao | entropy)
// 통합과학 3·4차시, 물질과 에너지 2·3차시에서 엔진 앱이 새 창으로 엶. 기록은 4차시 제산제와 같은 방식(doPost activity).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { sfx, bgm, bindButton } from './sound.js?v=20261102b';
import { HeatScene, RX } from './scenes/heat.js?v=20261102b';
import { CaoScene, GS, MLS } from './scenes/cao.js?v=20261102b';
import { EntropyScene, STEPS as ESTEPS } from './scenes/entropy.js?v=20261102b';
import { CARD_H } from './scenes/kit.js?v=20261102b';
import { bindMenu, bindHome, dropStudentParams } from './menu.js?v=20261102b';
import { ToolTray, feelPop } from './tools.js?v=20261102b';

const WEBAPP = 'https://script.google.com/macros/s/AKfycbyWps2b7FANPAVDKDrfjSxDqFGq0--gp5ilnxNes6llrLjHTVVsHp4rPXvYrVibs6s/exec';
const SUBJ = { isci: '통합과학', mne: '물질과 에너지', chem: '화학' };

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 2200); }

/* ---------- 주소·학생 ---------- */
const q = new URLSearchParams(location.search);
const SCENE = ['heat', 'cao', 'entropy'].includes(q.get('scene')) ? q.get('scene') : 'heat';
const DEF_LESSON = { heat: { isci: '3', mne: '3' }, cao: { isci: '4', mne: '4' }, entropy: { isci: '2', mne: '2' } };
if (q.get('k')) store.set('lensar:key', q.get('k'));
const KEY = store.get('lensar:key', '');
let me = q.get('sid') ? { sid: q.get('sid'), name: q.get('name') || '', subject: q.get('subject') || '', cls: q.get('cls') || '', lesson: q.get('lesson') || '' }
  : store.get('lensar:me2', null);
function fixMe() {
  if (!me) return;
  if (!['isci', 'mne'].includes(me.subject)) me.subject = SCENE === 'entropy' ? 'mne' : 'isci';
  if (!q.get('lesson')) me.lesson = DEF_LESSON[SCENE][me.subject];
  store.set('lensar:me2', me);
}
fixMe();
const isMne = () => me && me.subject === 'mne';

/* ---------- 상태 ---------- */
let S;
const skey = () => `lensar:scene:${SCENE}:${me.sid}:${me.lesson}`;
function keep() { store.set(skey(), S); }
function load() {
  if (q.get('reset')) { store.set(skey(), {}); q.delete('reset'); history.replaceState(null, '', location.pathname + location.search.replace(/[?&]reset=1/, '').replace(/^&/, '?')); }
  S = Object.assign({ step: 0, view: '', ans: {}, first: {}, tries: {}, runs: [], sent: false }, store.get(skey(), {}));
}

/* ---------- 기록 보내기 (app.js와 같은 큐) ---------- */
function queue() { return store.get('lensar:queue', []); }
function send(step, obj) {
  const items = Object.entries(obj).map(([item, value]) => ({ item, value }));
  const body = { action: 'activity', key: KEY, sid: me.sid, name: me.name, subject: me.subject, cls: me.cls, lesson: me.lesson, module: 'ar', step, items };
  store.set('lensar:queue', queue().concat([body]));
  flush();
}
let flushing = false;
async function flush() {
  if (flushing) return;
  if (!KEY) { $('#sendstate').textContent = '연결 정보 없음(기록 안 됨)'; return; }
  flushing = true;
  let qq = queue();
  while (qq.length) {
    try {
      await fetch(WEBAPP, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(qq[0]) });
      qq = queue().slice(1); store.set('lensar:queue', qq);
    } catch (e) { break; }
  }
  flushing = false;
  $('#sendstate').textContent = qq.length ? `못 보낸 기록 ${qq.length}건 (자동 재전송)` : (S && S.sent ? '보냈어요 ✓' : '');
}
addEventListener('online', flush);

/* ---------- 장면별 내용 ---------- */
const opts = (name, list, cur) => `<div class="opts">${list.map(v => `<button data-${name}="${esc(v)}" class="${v === cur ? 'on' : ''}">${esc(v)}</button>`).join('')}</div>`;
const back = '<div class="box"><b>다 했어요 ✓</b><p>기록을 선생님께 보냈어요. <b>이 창을 닫고 LENS 앱으로 돌아가요.</b></p></div>';
let scene = null, busy = false, msg = '';

// 정답 확인 공통: 처음 고른 답의 정오를 남기고, 맞을 때까지
function judge(k, pick, right, hint) {
  S.tries[k] = (S.tries[k] || 0) + 1;
  if (!(k in S.first)) S.first[k] = pick === right ? 'O' : 'X';
  if (pick === right) { S.ans[k] = pick; msg = ''; sfx.end('중성'); toast('맞아요!'); }
  else { msg = hint; sfx.end('산성'); }
  keep();
  return pick === right;
}

// 조작 도구: 같은 단계면 다시 만들지 않음 (진행도 유지)
let viewCam = null, viewEl = null;
const tray = new ToolTray(v => {
  if (!viewCam || !viewEl || !scene) return null;
  const w = scene.group.localToWorld(v.clone()).project(viewCam);
  if (w.z > 1) return null;
  const r = viewEl.getBoundingClientRect();
  return { x: r.left + (w.x + 1) / 2 * r.width, y: r.top + (1 - w.y) / 2 * r.height };
});
tray.toast = toast;
function tools(key, make) { if (tray.key === key) return; tray.key = key; tray.set(key ? make() : []); }

let heatSub = '';   // 질산 암모늄: 가루를 넣은 뒤 젓기
const HOW = {
  중화: '오른쪽 🧪 NaOH 병을 비커까지 끌어다 넣어요.',
  질산암모늄: '🥄 가루를 비커에 넣고, 🥢 유리 막대로 비커 위를 빙글빙글 저어요.',
  응결: '☁️ 수증기를 비커까지 끌어다 넣어요.',
  기화: '🪭 부채를 비커 위에 대고 좌우로 흔들어요.',
};

const SCENES = {
  heat: {
    title: '열은 어느 쪽으로 갈까?',
    intro: () => '<p>비커 속 물질이 <b>계</b>, 둘레의 공기가 <b>주위</b>예요. 반응을 골라 직접 일으키고, 열 화살표와 주위 온도계를 보세요. 비커를 손가락으로 눌러 느껴 볼 수도 있어요.</p>',
    make: () => new HeatScene(),
    question: () => isMne() ? { q: '주위의 엔트로피 변화 ΔS주위의 부호는?', o: ['+ (커짐)', '− (작아짐)'] } : { q: '주위 온도는 어떻게 될까요?', o: ['오름', '내림'] },
    right: rx => isMne() ? (rx.exo ? '+ (커짐)' : '− (작아짐)') : (rx.exo ? '오름' : '내림'),
    hint: rx => isMne()
      ? (S.tries[rx.k] >= 2 ? `열이 ${rx.exo ? '주위로 들어가면 주위 입자가 더 활발해져 ΔS주위 > 0' : '주위에서 빠져나가면 주위 입자가 덜 활발해져 ΔS주위 < 0'}이에요.` : '주위 공기 입자의 움직임을 보세요. 더 활발해지면 무질서도는?')
      : (S.tries[rx.k] >= 2 ? `화살표가 ${rx.exo ? '계에서 주위로 나가요. 주위가 열을 받아 따뜻해져요.' : '주위에서 계로 들어가요. 주위가 열을 빼앗겨 차가워져요.'}` : '열 화살표가 어느 쪽을 향하나요? 비커를 눌러 느껴 보세요.'),
    run(rx) {
      tools('', null); busy = true; S.running = rx.k;
      sfx.whoosh(3);
      scene.run(rx, () => { busy = false; render(); });
      tray.touch = { target: () => scene.target(), feel: (x, y) => feelPop(x, y, rx.exo ? '앗 뜨거!' : '앗 차가워!', rx.exo) };
      render();
    },
    toolsFor(rx) {
      const T = (o) => Object.assign({ target: () => scene.target(), where: '비커' }, o);
      if (rx.k === '중화') return [T({ icon: '🧪', label: 'NaOH', kind: 'drop', onDone: () => { scene.effect('pour'); sfx.pour(); setTimeout(() => this.run(rx), 600); } })];
      if (rx.k === '응결') return [T({ icon: '☁️', label: '수증기', kind: 'drop', onDone: () => { scene.effect('cloud'); sfx.whoosh(1); setTimeout(() => this.run(rx), 600); } })];
      if (rx.k === '기화') return [T({ icon: '🪭', label: '부채', kind: 'rub', need: 1100, doing: '부채질하는 중', onStep: () => { scene.effect('fan'); sfx.stir(); }, onDone: () => this.run(rx) })];
      if (heatSub !== 'stir') return [T({ icon: '🥄', label: '가루', kind: 'drop', onDone: () => { scene.effect('powder'); sfx.clink(); heatSub = 'stir'; render(); } })];
      return [T({ icon: '🥢', label: '젓기', kind: 'rub', need: 1200, doing: '빙글빙글 젓는 중', onStep: () => { scene.effect('stir'); sfx.stir(); }, onDone: () => this.run(rx) })];
    },
    panel() {
      const cur = RX.find(r => r.k === S.cur);
      let h = `<h2>열 흐름 · ${Object.keys(S.ans).length}/4</h2>`;
      if (cur && !(cur.k in S.ans)) {
        h += `<p><b>${cur.name}</b> <span class="muted">${esc(cur.eq)}</span></p>`;
        if (S.running !== cur.k) h += `<p class="q">${HOW[cur.k]}</p>`;
        else if (busy) h += '<p class="muted">열이 어느 쪽으로 가는지 보세요. 비커를 손가락으로 꾹 눌러 느껴 봐요.</p>';
        else { const Q = this.question(); h += `<p class="q">${Q.q}</p>${opts('pick', Q.o, '')}<div class="msg no">${esc(msg)}</div><p class="muted">비커를 눌러 느껴 봐도 돼요.</p>`; }
        return h;
      }
      h += '<p class="muted">반응을 골라요.</p><div class="opts two">' + RX.map(r => `<button data-rx="${r.k}" class="${r.k in S.ans ? 'on' : ''}">${r.k in S.ans ? '✓ ' : ''}${r.name}</button>`).join('') + '</div>';
      if (Object.keys(S.ans).length === 4) h += back + '<button class="sub wide" id="again">처음부터 다시 보기</button>';
      return h;
    },
    bind(p) {
      const cur = RX.find(r => r.k === S.cur);
      if (cur && !(cur.k in S.ans) && S.running !== cur.k) tools(`heat-${cur.k}-${heatSub}`, () => this.toolsFor(cur));
      else tools('', null);
      p.querySelectorAll('[data-rx]').forEach(b => b.onclick = () => {
        const rx = RX.find(r => r.k === b.dataset.rx);
        S.cur = rx.k; S.running = null; heatSub = ''; delete S.ans[rx.k]; msg = ''; keep(); tray.touch = null;
        scene.prepare(rx); sfx.clink();
        render();
      });
      p.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
        const rx = RX.find(r => r.k === S.cur);
        if (judge(rx.k, b.dataset.pick, this.right(rx), this.hint(rx))) {
          scene.stop(); S.cur = null; S.running = null; tray.touch = null; keep();
          if (Object.keys(S.ans).length === 4 && !S.sent) {
            const o = { 질문: isMne() ? 'ΔS주위' : '주위온도' };
            RX.forEach(r => { o[r.k + '_첫답'] = S.first[r.k]; o[r.k + '_시도'] = S.tries[r.k]; });
            send('열흐름', o); S.sent = true; keep();
          }
        }
        render();
      });
      const a = $('#again'); if (a) a.onclick = () => { this.replay(); render(); };
    },
    replay() { S.ans = {}; S.cur = null; S.running = null; heatSub = ''; keep(); tools('', null); tray.touch = null; if (scene) scene.reset(); },
  },

  cao: {
    title: '산화 칼슘으로 달걀 데우기',
    intro: () => '<p>도시락에 달걀을 올리고, <b>아래 칸</b>에 산화 칼슘을 숟가락으로 넣은 뒤 물을 부어요. 열이 어떻게 퍼지는지 보고, 용기를 눌러 느껴 봐요.</p><p class="muted">정확한 온도는 앱의 가상 실험 그래프에서 확인해요.</p>',
    make: () => new CaoScene(),
    prog: { egg: false, spoons: 0, wrap: false },
    plan() {
      S.plan = S.plan || { g: GS.includes(+q.get('cao')) ? +q.get('cao') : null, ml: MLS.includes(+q.get('water')) ? +q.get('water') : null, warm: q.get('warm') == null ? null : q.get('warm') === '1' };
      return S.plan;
    },
    ready() { const P = this.plan(); return P.g && P.ml && P.warm != null; },
    fresh() { const P = this.plan(); this.prog = { egg: false, spoons: 0, wrap: false }; tools('', null); tray.touch = null; if (scene && this.ready()) scene.setup(P.g, P.ml, P.warm); },
    // 지금 넣을 것: 달걀 → 산화 칼슘(10 g씩) → 보온 포장 → 물
    next() {
      const P = this.plan(), g = this.prog, n = P.g / 10;
      const T = o => Object.assign({ target: () => scene.target(), where: '도시락' }, o);
      if (!g.egg) return ['egg', [T({ icon: '🥚', label: '달걀', kind: 'drop', onDone: () => { scene.placeEgg(); sfx.clink(); g.egg = true; render(); } })]];
      if (g.spoons < n) return ['cao' + g.spoons, [T({ icon: '🥄', label: `산화 칼슘 ${g.spoons + 1}/${n}`, kind: 'drop', target: () => scene.target(true), where: '아래 칸', onDone: () => { scene.addSpoon(); sfx.clink(); g.spoons++; render(); } })]];
      if (P.warm && !g.wrap) return ['wrap', [T({ icon: '🧣', label: '보온 포장', kind: 'drop', onDone: () => { scene.wrapOn(); sfx.stir(); g.wrap = true; render(); } })]];
      return ['water', [T({ icon: '💧', label: `물 ${P.ml} mL`, kind: 'hold', need: 1 + P.ml / 150, every: 0.35, doing: '물 붓는 중', onStep: () => sfx.pour(0.35), onProgress: p => scene.pourTo(p),
        onDone: () => {
          sfx.fizz(); scene.start(() => { S.runs.push(`${P.g} g·${P.ml} mL·${P.warm ? '보온' : '그냥'}`); keep(); sfx.end('중성'); render(); });
          tray.touch = { target: () => scene.target(), feel: (x, y) => { const [t, hot] = scene.feel(); feelPop(x, y, t, hot); } };
          render();
        } })]];
    },
    panel() {
      const P = this.plan(), st = scene ? scene.state : 'idle', g = this.prog;
      let h = '<h2>조리 용기</h2>';
      if (st === 'run') {
        return h + `<p>산화 칼슘 ${P.g} g · 물 ${P.ml} mL · ${P.warm ? '보온 포장' : '그냥 그릇'}</p><p class="muted">위로 가는 화살표는 달걀로, 옆으로 가는 화살표는 주위로 빠져나가는 열이에요. 용기를 눌러 느껴 봐요.</p><button class="sub wide" id="fast">빨리 보기</button>`;
      }
      if (st === 'end') {
        h += `<p>끝났어요. 용기를 눌러 아직 따뜻한지 느껴 봐요.</p><button class="wide" id="redo">다시 넣어 보기</button>`;
      } else {
        h += '<p class="muted">산화 칼슘 (g)</p>' + opts('g', GS.map(String), P.g ? String(P.g) : '').replace('class="opts"', 'class="opts sm"')
          + '<p class="muted">물 (mL)</p>' + opts('ml', MLS.map(String), P.ml ? String(P.ml) : '').replace('class="opts"', 'class="opts sm"')
          + opts('warm', ['보온 포장', '그냥 그릇'], P.warm == null ? '' : P.warm ? '보온 포장' : '그냥 그릇');
        if (this.ready()) {
          const n = P.g / 10, mark = ok => ok ? '✓' : '○';
          h += `<div class="box">${mark(g.egg)} 🥚 달걀 올리기 · ${mark(g.spoons >= n)} 🥄 산화 칼슘 ${g.spoons}/${n}숟가락${P.warm ? ` · ${mark(g.wrap)} 🧣 포장` : ''} · ○ 💧 물 붓기 (누르고 있기)</div><p class="muted">오른쪽 도구를 도시락까지 끌어다 넣어요.</p>`;
        } else h += `<p class="muted">산화 칼슘, 물, 그릇을 골라요.</p>`;
      }
      if (S.runs.length) h += `<p class="muted">본 설계 ${S.runs.length}번: ${S.runs.map(r => esc(r)).join(' / ')}</p>` + (S.sent ? back : '<button class="sub wide" id="finish">다 봤어요 (기록 보내기)</button>');
      return h;
    },
    bind(p) {
      const P = this.plan(), st = scene ? scene.state : 'idle';
      if (!this.synced && scene) { this.synced = true; this.fresh(); }   // 앱에서 받은 설계값을 처음 한 번 장면에
      if (st === 'idle' && this.ready()) { const [k, list] = this.next(); tools('cao-' + k, () => list); } else tools('', null);
      const pick = f => () => { f(); keep(); this.fresh(); render(); };
      p.querySelectorAll('[data-g]').forEach(b => b.onclick = pick(() => { P.g = parseInt(b.dataset.g, 10); }));
      p.querySelectorAll('[data-ml]').forEach(b => b.onclick = pick(() => { P.ml = parseInt(b.dataset.ml, 10); }));
      p.querySelectorAll('[data-warm]').forEach(b => b.onclick = pick(() => { P.warm = b.dataset.warm === '보온 포장'; }));
      const redo = $('#redo'); if (redo) redo.onclick = () => { this.fresh(); render(); };
      const fast = $('#fast'); if (fast) fast.onclick = () => { scene.speed = 4; fast.disabled = true; };
      const fin = $('#finish');
      if (fin) fin.onclick = () => {
        const last = S.runs[S.runs.length - 1];
        send('조리용기', { 본_횟수: S.runs.length, 본_설계: S.runs.join(' / '), 마지막: last }); S.sent = true; keep(); render();
      };
    },
    replay() { this.fresh(); },
  },

  entropy: {
    title: '무질서도는 커질까, 작아질까?',
    intro: () => '<p>불꽃과 얼음 팩으로 물 분자 상자의 상태를 직접 바꾸고, 두 플라스크 사이 꼭지도 돌려서 열어 보세요. 바꿀 때마다 <b>무질서도(엔트로피)</b>가 어떻게 되는지 골라요.</p>',
    make: () => new EntropyScene(),
    hint: k => S.tries[k] >= 2
      ? ({ 융해: '자리에 고정돼 있던 분자가 움직이기 시작했어요. 배치할 수 있는 경우의 수가 늘어요.', 기화: '분자가 상자 전체로 빠르게 퍼졌어요. 무질서도가 크게 늘어요.', 응결: '퍼져 있던 분자가 바닥에 모였어요. 무질서도가 줄어요.', 혼합: '두 기체가 섞이면 놓일 수 있는 경우의 수가 늘어요.' })[k]
      : '분자가 놓일 수 있는 자리와 움직임이 늘었나요, 줄었나요?',
    HOW: { 융해: '🔥 불꽃을 상자에 대고 누르고 있어요.', 기화: '🔥 불꽃을 더 오래 대고 있어요. 끓을 때까지!', 응결: '❄️ 얼음 팩을 상자에 대고 누르고 있어요.', 혼합: '🔧 꼭지 위에서 손가락을 빙글빙글 돌려 열어요.' },
    act(cur) {
      S.cur = cur.k; msg = ''; keep(); busy = true; tools('', null);
      setTimeout(() => { busy = false; render(); }, cur.to ? 3000 : 5000);
      render();
    },
    toolsFor(cur) {
      const box = () => scene.boxTarget();
      if (cur.k === '혼합') return [{ icon: '🔧', label: '꼭지', kind: 'rub', need: 900, target: () => scene.valveTarget(), where: '꼭지', doing: '꼭지 돌리는 중',
        onStep: () => sfx.squeak(), onProgress: p => scene.setTurn(p), onDone: () => { scene.openValve(); sfx.whoosh(2); this.act(cur); } }];
      const ice = cur.k === '응결';
      return [{ icon: ice ? '❄️' : '🔥', label: ice ? '얼음 팩' : '불꽃', kind: 'hold', need: cur.k === '기화' ? 3.5 : 2.5, every: 0.3, target: box, where: '상자',
        doing: ice ? '식히는 중' : '데우는 중', onStep: () => (ice ? sfx.stir() : sfx.flame()), onProgress: p => scene.warm(ice ? -0.6 * p : p, ice ? 'ice' : 'fire'),
        onDone: () => { scene.change(cur.to); cur.k === '기화' ? sfx.whoosh(1.5) : sfx.crack(); this.act(cur); } }];
    },
    panel() {
      const i = ESTEPS.findIndex(s => !(s.k in S.ans)), cur = ESTEPS[i];
      let h = `<h2>무질서도 · ${Object.keys(S.ans).length}/4</h2>`;
      if (!cur) return h + back + '<button class="sub wide" id="again">처음부터 다시 보기</button>';
      if (S.cur === cur.k && !busy) return h + `<p class="q">${cur.btn.replace(/ \(.*/, '')}: 무질서도는?</p>${opts('pick', ['커짐', '작아짐'], '')}<div class="msg no">${esc(msg)}</div>`;
      if (busy) return h + '<p class="muted">분자들이 어떻게 움직이는지 보세요…</p>';
      return h + `<p><b>${cur.btn}</b></p><p class="q">${this.HOW[cur.k]}</p><p class="muted">${i < 3 ? '위 상자의 물 분자' : '아래 두 플라스크(왼쪽 A, 오른쪽 B)'}를 보세요.</p>`;
    },
    bind(p) {
      const cur = ESTEPS.find(s => !(s.k in S.ans));
      if (cur && S.cur !== cur.k && !busy) tools('ent-' + cur.k, () => this.toolsFor(cur)); else tools('', null);
      p.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
        const c = ESTEPS.find(s => s.k === S.cur);
        if (judge(c.k, b.dataset.pick, c.a, this.hint(c.k))) {
          S.cur = null; keep();
          if (Object.keys(S.ans).length === 4 && !S.sent) {
            const o = {}; ESTEPS.forEach(s => { o[s.k + '_첫답'] = S.first[s.k]; o[s.k + '_시도'] = S.tries[s.k]; });
            send('무질서도', o); S.sent = true; keep();
          }
        }
        render();
      });
      const a = $('#again'); if (a) a.onclick = () => { this.replay(); render(); };
    },
    replay() { S.ans = {}; S.cur = null; keep(); tools('', null); if (scene) scene.reset(); },
  },
};
const D = SCENES[SCENE];
// 장면마다 맞는 인식 카드 (F 열 흐름, G 조리 용기, H 무질서도)
const CARD = { heat: { k: 'F', name: '열 흐름 카드(F)' }, cao: { k: 'G', name: '조리 용기 카드(G)' }, entropy: { k: 'H', name: '무질서도 카드(H)' } }[SCENE];

/* ---------- 화면 ---------- */
function render() {
  $('#who').textContent = me ? `${me.name} · ${SUBJ[me.subject] || ''}` : '';
  const live = me && S && S.step === 1;
  document.body.classList.toggle('live', !!live);
  if (live) startView(); else stopView();
  bgm(!!live);
  const p = $('#panel');
  p.innerHTML = !me ? vLogin() : live ? (busy ? '' : '<button class="sub back" id="toStart">◀ 처음 화면</button>') + D.panel() : vStart();
  const ts = $('#toStart'); if (ts) ts.onclick = () => { S.step = 0; keep(); render(); };
  if (!me) return bindLogin(p);
  if (live) D.bind(p); else bindStart(p);
}
function vLogin() {
  return `<h2>${D.title}</h2><p class="muted">앱에서 [AR 열기]로 들어오면 이 칸은 나오지 않아요.</p>
  <div class="box"><p>학번 5자리</p><input type="text" inputmode="numeric" id="lsid" maxlength="5">
  <p>이름</p><input type="text" id="lname">
  ${opts('subj', ['통합과학', '물질과 에너지'], '')}<div class="msg no" id="lmsg"></div>
  <button class="wide" id="lgo">시작</button></div>`;
}
function bindLogin(p) {
  let subj = '';
  p.querySelectorAll('[data-subj]').forEach(b => b.onclick = () => { subj = b.dataset.subj; p.querySelectorAll('[data-subj]').forEach(x => x.classList.toggle('on', x === b)); });
  $('#lgo').onclick = () => {
    const sid = $('#lsid').value.trim(), name = $('#lname').value.trim();
    if (!/^\d{5}$/.test(sid)) return $('#lmsg').textContent = '학번은 숫자 5자리예요.';
    if (!name || !subj) return $('#lmsg').textContent = '이름과 과목을 넣어 주세요.';
    me = { sid, name, subject: subj === '통합과학' ? 'isci' : 'mne', cls: '', lesson: '' };
    fixMe(); load(); render();
  };
}
function vStart() {
  return `<h2>${D.title}</h2>${D.intro()}
  <p class="muted">준비물: ${CARD.name}를 책상에 두세요. 카드 그림 위에 장면이 나타나요.</p>
  <div class="row"><button data-view="AR">카드로 보기 (AR)</button><button class="sub" data-view="3D">화면에서 보기</button></div>`;
}
function bindStart(p) {
  p.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { S.view = b.dataset.view; S.step = 1; keep(); render(); });
}

/* ---------- AR / 3D 보기 ---------- */
let viewOn = false, mindar = null, r3d = null, foundOnce = false, scanTimer = null;
const clock = new THREE.Clock();
function startView() {
  if (viewOn) return; viewOn = true;
  if (!scene) scene = D.make();
  if (S.view === 'AR') startAR(); else start3D();
}
function stopView() {
  if (!viewOn) return; viewOn = false;
  clearTimeout(scanTimer); $('#scan').classList.add('hidden');
  tools('', null); tray.touch = null; viewCam = viewEl = null;
  if (mindar) { try { mindar.renderer.setAnimationLoop(null); mindar.stop(); } catch (e) {} mindar = null; $('#ar').innerHTML = ''; }
  if (r3d) { r3d.setAnimationLoop(null); r3d.dispose(); r3d = null; $('#v3d').innerHTML = ''; $('#v3d').style.display = 'none'; }
}
async function startAR() {
  $('#scan').classList.remove('hidden');
  $('#to3d').onclick = () => { S.view = '3D'; keep(); stopView(); startView(); toast('화면에서 보기로 바꿨어요'); };
  scanTimer = setTimeout(() => { if (!foundOnce) $('#to3d').classList.remove('hidden'); }, 10000);
  try {
    const { MindARThree } = await import('./lib/mindar/mindar-image-three.prod.js');
    mindar = new MindARThree({ container: $('#ar'), imageTargetSrc: `assets/cards/card${CARD.k}.mind`, maxTrack: 1, uiLoading: 'no', uiScanning: 'no', uiError: 'no' });
    const { renderer, scene: s3, camera } = mindar;
    const C = mindar.addAnchor(0);
    scene.group.position.set(0, 0, 0); C.group.add(scene.group);
    C.onTargetFound = () => { foundOnce = true; $('#scan').classList.add('hidden'); };
    await mindar.start();
    viewCam = camera; viewEl = renderer.domElement;
    renderer.setAnimationLoop(() => {
      scene.tick(Math.min(clock.getDelta(), 0.05));
      if (foundOnce) C.group.visible = true;   // 카드를 놓쳐도 마지막 자리에
      renderer.render(s3, camera);
    });
  } catch (e) {
    toast('카메라를 켤 수 없어 화면에서 보기로 바꿀게요');
    S.view = '3D'; keep(); stopView(); startView();
  }
}
function start3D() {
  $('#scan').classList.add('hidden');
  const box = $('#v3d'); box.style.display = 'block';
  r3d = new THREE.WebGLRenderer({ antialias: true });
  r3d.setPixelRatio(Math.min(devicePixelRatio, 2));
  box.appendChild(r3d.domElement);
  const s3 = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, 1, 0.01, 50);
  const ctl = new OrbitControls(cam, r3d.domElement);
  ctl.enableDamping = true; ctl.minDistance = 0.6; ctl.maxDistance = 4;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1, CARD_H), new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(`assets/cards/card${CARD.k}.jpg`, t => { t.colorSpace = THREE.SRGBColorSpace; }) }));
  s3.add(card);   // 화면에서 보기: 책상 위 카드 대신
  s3.add(scene.group);
  ctl.target.set(0, 0, 0.1);
  const size = () => {
    const w = innerWidth, h = innerHeight;
    r3d.setSize(w, h); cam.aspect = w / h;
    cam.setViewOffset(w, h, 0, h * 0.17, w, h);   // 아래 패널을 피해 장면을 위로
    const f = (w < h ? 0.72 * h / w : 1.05) * CARD_H / 1.41;
    cam.position.set(0, -1.25 * f, 1.45 * f);      // 비스듬히 내려다봐서 높이가 보이게
    cam.updateProjectionMatrix();
  };
  size(); addEventListener('resize', size);
  viewCam = cam; viewEl = r3d.domElement;
  r3d.setAnimationLoop(() => { scene.tick(Math.min(clock.getDelta(), 0.05)); ctl.update(); r3d.render(s3, cam); });
}

/* ---------- 시작 ---------- */
document.title = 'LENS ' + D.title;
$('#scan img').src = `assets/cards/card${CARD.k}.jpg`;
$('#scan p').textContent = `책상 위 ${CARD.name}를 30~50 cm 위에서 비춰 주세요`;
bindButton($('#snd'));
bindHome($('#home'));
bindMenu($('#menu-btn'), {
  can: k => !!me && (k !== 'replay' || S.step > 0),
  replay() { msg = ''; busy = false; D.replay(); render(); },
  restart() { store.set(skey(), {}); load(); msg = ''; busy = false; D.synced = false; D.replay(); render(); toast('처음부터 다시 해요'); },
  logout() { stopView(); scene = null; me = null; S = null; store.set('lensar:me2', null); dropStudentParams(); render(); },
});
if (me) load();
render();
flush();
window.LENS_SCENE = { get scene() { return scene; }, get S() { return S; } };   // 시험용
window.__proj = v => tray.project(v);
