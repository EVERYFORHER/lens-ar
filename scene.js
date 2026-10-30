// LENS 확장 AR 장면 (?scene=heat | cao | entropy)
// 통합과학 3·4차시, 물질과 에너지 2·3차시에서 엔진 앱이 새 창으로 엶. 기록은 4차시 제산제와 같은 방식(doPost activity).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { sfx, bgm, bindButton } from './sound.js?v=20261030a';
import { HeatScene, RX } from './scenes/heat.js?v=20261030a';
import { CaoScene, GS, MLS } from './scenes/cao.js?v=20261030a';
import { EntropyScene, STEPS as ESTEPS } from './scenes/entropy.js?v=20261030a';
import { CARD_H } from './scenes/kit.js?v=20261030a';
import { bindMenu, bindHome, dropStudentParams } from './menu.js?v=20261030a';

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

const SCENES = {
  heat: {
    title: '열은 어느 쪽으로 갈까?',
    intro: () => '<p>비커 속 물질이 <b>계</b>, 둘레의 공기가 <b>주위</b>예요. 반응을 하나씩 켜고 열 화살표와 주위 온도계를 보세요.</p>',
    make: () => new HeatScene(),
    question: () => isMne() ? { q: '주위의 엔트로피 변화 ΔS주위의 부호는?', o: ['+ (커짐)', '− (작아짐)'] } : { q: '주위 온도는 어떻게 될까요?', o: ['오름', '내림'] },
    right: rx => isMne() ? (rx.exo ? '+ (커짐)' : '− (작아짐)') : (rx.exo ? '오름' : '내림'),
    hint: rx => isMne()
      ? (S.tries[rx.k] >= 2 ? `열이 ${rx.exo ? '주위로 들어가면 주위 입자가 더 활발해져 ΔS주위 > 0' : '주위에서 빠져나가면 주위 입자가 덜 활발해져 ΔS주위 < 0'}이에요.` : '주위 공기 입자의 움직임을 보세요. 더 활발해지면 무질서도는?')
      : (S.tries[rx.k] >= 2 ? `화살표가 ${rx.exo ? '계에서 주위로 나가요. 주위가 열을 받아 따뜻해져요.' : '주위에서 계로 들어가요. 주위가 열을 빼앗겨 차가워져요.'}` : '열 화살표가 어느 쪽을 향하나요? 온도계도 보세요.'),
    panel() {
      const cur = RX.find(r => r.k === S.cur);
      let h = `<h2>열 흐름 · ${Object.keys(S.ans).length}/4</h2>`;
      if (cur && !(cur.k in S.ans)) {
        h += `<p><b>${cur.name}</b> <span class="muted">${esc(cur.eq)}</span></p>`;
        if (busy) h += '<p class="muted">열이 어느 쪽으로 가는지 보세요…</p>';
        else { const Q = this.question(); h += `<p class="q">${Q.q}</p>${opts('pick', Q.o, '')}<div class="msg no">${esc(msg)}</div>`; }
        return h;
      }
      h += '<p class="muted">반응을 골라 켜 보세요.</p><div class="opts two">' + RX.map(r => `<button data-rx="${r.k}" class="${r.k in S.ans ? 'on' : ''}">${r.k in S.ans ? '✓ ' : ''}${r.name}</button>`).join('') + '</div>';
      if (Object.keys(S.ans).length === 4) h += back + '<button class="sub wide" id="again">처음부터 다시 보기</button>';
      return h;
    },
    bind(p) {
      p.querySelectorAll('[data-rx]').forEach(b => b.onclick = () => {
        const rx = RX.find(r => r.k === b.dataset.rx);
        S.cur = rx.k; delete S.ans[rx.k]; msg = ''; keep(); busy = true;
        sfx.whoosh(3);
        scene.run(rx, () => { busy = false; render(); });
        render();
      });
      p.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
        const rx = RX.find(r => r.k === S.cur);
        if (judge(rx.k, b.dataset.pick, this.right(rx), this.hint(rx))) {
          scene.stop(); S.cur = null; keep();
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
    replay() { S.ans = {}; S.cur = null; keep(); if (scene) scene.reset(); },
  },

  cao: {
    title: '산화 칼슘으로 달걀 데우기',
    intro: () => '<p>도시락 <b>아래 칸</b>에 산화 칼슘을 넣고 물을 부으면 열이 나와요. 내가 고른 양으로 열이 어떻게 퍼지는지 보세요.</p><p class="muted">정확한 온도는 앱의 가상 실험 그래프에서 확인해요.</p>',
    make: () => new CaoScene(),
    plan() {
      S.plan = S.plan || { g: GS.includes(+q.get('cao')) ? +q.get('cao') : null, ml: MLS.includes(+q.get('water')) ? +q.get('water') : null, warm: q.get('warm') == null ? null : q.get('warm') === '1' };
      return S.plan;
    },
    panel() {
      const P = this.plan(), st = scene ? scene.state : 'idle';
      let h = '<h2>조리 용기</h2>';
      if (st === 'pour' || st === 'run') {
        return h + `<p>산화 칼슘 ${P.g} g · 물 ${P.ml} mL · ${P.warm ? '보온 포장' : '그냥 그릇'}</p><p class="muted">위로 가는 화살표는 달걀로, 옆으로 가는 화살표는 주위로 빠져나가는 열이에요.</p><button class="sub wide" id="fast">빨리 보기</button>`;
      }
      h += '<p class="muted">산화 칼슘 (g)</p>' + opts('g', GS.map(String), P.g ? String(P.g) : '').replace('class="opts"', 'class="opts sm"')
        + '<p class="muted">물 (mL)</p>' + opts('ml', MLS.map(String), P.ml ? String(P.ml) : '').replace('class="opts"', 'class="opts sm"')
        + opts('warm', ['보온 포장', '그냥 그릇'], P.warm == null ? '' : P.warm ? '보온 포장' : '그냥 그릇')
        + `<div class="msg no">${esc(msg)}</div><button class="wide" id="pour">💧 물 붓기</button>`;
      if (S.runs.length) h += `<p class="muted">본 설계 ${S.runs.length}번: ${S.runs.map(r => esc(r)).join(' / ')}</p>` + (S.sent ? back : '<button class="sub wide" id="finish">다 봤어요 (기록 보내기)</button>');
      return h;
    },
    bind(p) {
      const P = this.plan(), sync = () => { if (P.g && P.ml && P.warm != null && scene && !['pour', 'run'].includes(scene.state)) scene.setup(P.g, P.ml, P.warm); };
      p.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { P.g = parseInt(b.dataset.g, 10); keep(); sync(); render(); });
      p.querySelectorAll('[data-ml]').forEach(b => b.onclick = () => { P.ml = parseInt(b.dataset.ml, 10); keep(); sync(); render(); });
      p.querySelectorAll('[data-warm]').forEach(b => b.onclick = () => { P.warm = b.dataset.warm === '보온 포장'; keep(); sync(); render(); });
      const pour = $('#pour');
      if (pour) pour.onclick = () => {
        if (!P.g || !P.ml || P.warm == null) { msg = '산화 칼슘, 물, 그릇을 모두 골라요.'; return render(); }
        msg = ''; scene.setup(P.g, P.ml, P.warm);
        sfx.gulp(); setTimeout(() => sfx.fizz(), 1600);
        scene.pour(() => { S.runs.push(`${P.g} g·${P.ml} mL·${P.warm ? '보온' : '그냥'}`); keep(); sfx.end('중성'); render(); });
        render();
      };
      const fast = $('#fast'); if (fast) fast.onclick = () => { scene.speed = 4; fast.disabled = true; };
      const fin = $('#finish');
      if (fin) fin.onclick = () => {
        const last = S.runs[S.runs.length - 1];
        send('조리용기', { 본_횟수: S.runs.length, 본_설계: S.runs.join(' / '), 마지막: last }); S.sent = true; keep(); render();
      };
      if (!this.synced && scene) { this.synced = true; sync(); }   // 앱에서 받은 설계값을 처음 한 번 장면에
    },
    replay() { const P = this.plan(); if (scene) scene.setup(P.g || 40, P.ml || 200, !!P.warm); },
  },

  entropy: {
    title: '무질서도는 커질까, 작아질까?',
    intro: () => '<p>물 분자 상자에서 상태를 바꿔 보고, 두 플라스크 사이 꼭지도 열어 보세요. 바꿀 때마다 <b>무질서도(엔트로피)</b>가 어떻게 되는지 골라요.</p>',
    make: () => new EntropyScene(),
    hint: k => S.tries[k] >= 2
      ? ({ 융해: '자리에 고정돼 있던 분자가 움직이기 시작했어요. 배치할 수 있는 경우의 수가 늘어요.', 기화: '분자가 상자 전체로 빠르게 퍼졌어요. 무질서도가 크게 늘어요.', 응결: '퍼져 있던 분자가 바닥에 모였어요. 무질서도가 줄어요.', 혼합: '두 기체가 섞이면 놓일 수 있는 경우의 수가 늘어요.' })[k]
      : '분자가 놓일 수 있는 자리와 움직임이 늘었나요, 줄었나요?',
    panel() {
      const i = ESTEPS.findIndex(s => !(s.k in S.ans)), cur = ESTEPS[i];
      let h = `<h2>무질서도 · ${Object.keys(S.ans).length}/4</h2>`;
      if (!cur) return h + back + '<button class="sub wide" id="again">처음부터 다시 보기</button>';
      if (S.cur === cur.k && !busy) return h + `<p class="q">${cur.btn.replace(/ \(.*/, '')}: 무질서도는?</p>${opts('pick', ['커짐', '작아짐'], '')}<div class="msg no">${esc(msg)}</div>`;
      if (busy) return h + '<p class="muted">분자들이 어떻게 움직이는지 보세요…</p>';
      return h + `<p>${i < 3 ? '위 상자의 물 분자' : '아래 두 플라스크(왼쪽 A, 오른쪽 B)'}를 보고 눌러 보세요.</p><button class="wide" id="go">${cur.btn}</button>`;
    },
    bind(p) {
      const go = $('#go');
      if (go) go.onclick = () => {
        const cur = ESTEPS.find(s => !(s.k in S.ans));
        S.cur = cur.k; msg = ''; keep(); busy = true;
        if (cur.to) scene.change(cur.to); else scene.openValve();
        sfx.whoosh(1.5);
        setTimeout(() => { busy = false; render(); }, cur.to ? 3000 : 5000);
        render();
      };
      p.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
        const cur = ESTEPS.find(s => s.k === S.cur);
        if (judge(cur.k, b.dataset.pick, cur.a, this.hint(cur.k))) {
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
    replay() { S.ans = {}; S.cur = null; keep(); if (scene) scene.reset(); },
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
