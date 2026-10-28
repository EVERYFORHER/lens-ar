// LENS 4차시 위산과 제산제 AR 모듈
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sim, KIND } from './sim.js';

// 공통 엔진 웹앱 (활동기록 탭으로 보냄). 키는 엔진 차시 탭 외부링크의 ?k= 로 받음.
const WEBAPP = 'https://script.google.com/macros/s/AKfycbyWps2b7FANPAVDKDrfjSxDqFGq0--gp5ilnxNes6llrLjHTVVsHp4rPXvYrVibs6s/exec';
const STOMACH_H = 10;   // 위 속 H⁺ 10 mmol = 0.1 M 염산 100 mL (수업용 가정 값)
const PRODUCTS = {
  Mg: { name: '수산화 마그네슘', f: 'Mg(OH)₂', mg: 145, M: 58, n: 2 },
  Al: { name: '수산화 알루미늄', f: 'Al(OH)₃', mg: 260, M: 78, n: 3 },
  Na: { name: '탄산수소 나트륨', f: 'NaHCO₃', mg: 210, M: 84, n: 1 },
};
const STEPS = ['시작', '예측', '관찰', '계산', '판단', '완료'];

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 2200); }

/* ---------- 학생 정보 ---------- */
const q = new URLSearchParams(location.search);
if (q.get('k')) store.set('lensar:key', q.get('k'));
const KEY = store.get('lensar:key', '');
let me = q.get('sid') ? {
  sid: q.get('sid'), name: q.get('name') || '', subject: q.get('subject') || 'chem',
  cls: q.get('cls') || '', lesson: q.get('lesson') || '',
} : store.get('lensar:me', null);
if (me) { if (!me.lesson) me.lesson = me.subject === 'isci' ? '1' : '4'; store.set('lensar:me', me); }
const isChem = () => me && me.subject !== 'isci';
const productKey = sid => ({ 1: 'Mg', 4: 'Mg', 7: 'Mg', 2: 'Al', 5: 'Al', 8: 'Al' }[String(sid).slice(-1)] || 'Na');

/* ---------- 상태 ---------- */
let S;
function fresh() {
  return { step: 0, view: '', pred: '', predWhy: '', obs: {}, calc: { a: '', b: '', c: '', d: '', tries: 0, nmiss: 'N', ok: false },
    judge: { n: '', basis: [], why: '' }, sent: {} };
}
const skey = () => 'lensar:state:' + me.sid + ':' + me.lesson;
function keep() { store.set(skey(), S); }

/* ---------- 기록 보내기 (응답을 읽을 수 없어 큐로 관리) ---------- */
function queue() { return store.get('lensar:queue', []); }
function send(step, obj) {
  const items = Object.entries(obj).map(([item, value]) => ({ item, value: Array.isArray(value) ? value.join(', ') : value }));
  const body = { action: 'activity', key: KEY, sid: me.sid, name: me.name, subject: me.subject, cls: me.cls, lesson: me.lesson, module: 'ar', step, items };
  store.set('lensar:queue', queue().concat([body]));
  S.sent[step] = true; keep();
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
      qq = queue().slice(1); store.set('lensar:queue', qq);   // 보내는 동안 쌓인 것도 이어서
    } catch (e) { break; }
  }
  flushing = false;
  $('#sendstate').textContent = qq.length ? `못 보낸 기록 ${qq.length}건 (자동 재전송)` : (Object.keys(S && S.sent || {}).length ? '보냈어요 ✓' : '');
}
addEventListener('online', flush);

/* ---------- 화면 ---------- */
function go(step) { S.step = step; keep(); render(); }
function render() {
  $('#who').textContent = me ? `${me.name} · ${isChem() ? '화학' : '통합과학'}` : '';
  const live = me && S && S.step === 2;
  document.body.classList.toggle('live', !!live);
  if (live) startView(); else stopView();
  const p = $('#panel');
  p.innerHTML = !me ? vLogin() : [vStart, vPredict, vObserve, vCalc, vJudge, vDone][S.step]();
  p.scrollTop = 0;
  bind[!me ? 'login' : STEPS[S.step]] && bind[!me ? 'login' : STEPS[S.step]](p);
}

const legend = () => '<div class="legend">' + Object.values(KIND).map(k => `<span><i style="background:${k.color}"></i>${k.label}</span>`).join('') + '</div>';
const opts = (name, list, cur) => `<div class="opts">${list.map(v => `<button data-${name}="${esc(v)}" class="${v === cur ? 'on' : ''}">${esc(v)}</button>`).join('')}</div>`;

function vLogin() {
  return `<h2>위산과 제산제</h2><p class="muted">앱 홈에서 [수업 활동]으로 들어오면 이 칸은 나오지 않아요.</p>
  <div class="box"><p>학번 5자리</p><input type="text" inputmode="numeric" id="lsid" maxlength="5">
  <p>이름</p><input type="text" id="lname">
  ${opts('subj', ['화학', '통합과학'], '')}<div class="msg no" id="lmsg"></div>
  <button class="wide" id="lgo">시작</button></div>`;
}

function vStart() {
  return `<h2>위산과 제산제</h2>
  <p class="q">제산제를 두 알 먹으면 더 좋을까?</p>
  ${isChem() ? '<p>1차시 가상 실험에서 염산에 제산제 1알을 넣었더니 pH가 1.00에서 3.02가 됐어요. 오늘은 그 비커 속을 입자로 들여다봐요.</p>' : '<p>위산(염산)에 제산제를 넣으면 입자들은 어떻게 될까요? 카드 위에서 직접 넣어 봐요.</p>'}
  <div class="box"><b>오늘의 가정 (수업용)</b><p>위 속에 남은 위산: 0.1 M 염산 100 mL<br>제산제 1알: 수산화 마그네슘 145 mg</p>
  <p class="muted">입자 1개 = 0.5 mmol로 단순하게 나타냈어요. 실제 제품과 숫자가 다를 수 있어요.</p></div>
  <p>책상 위 카드를 비춰서 볼까요, 화면에서 바로 볼까요?</p>
  <div class="row"><button data-view="AR">카드로 보기 (AR)</button><button class="sub" data-view="3D">화면에서 보기</button></div>`;
}

function vPredict() {
  return `<h2>① 예측</h2><p class="q">속이 쓰릴 때 이 제산제를 몇 알 먹는 게 좋을까요?</p>
  <p class="muted">아직 계산하지 말고 느낌대로 골라요.</p>
  ${opts('pred', ['1알', '2알', '3알'], S.pred)}
  <p>그렇게 생각한 이유 한 줄</p><textarea id="pwhy">${esc(S.predWhy)}</textarea>
  <div class="msg no" id="pmsg"></div><button class="wide" id="pgo">예측 제출하고 입자 보러 가기</button>`;
}

const expect = t => ({ H: Math.max(0, 20 - 10 * t), OH: Math.max(0, 10 * t - 20) });
const liqOf = e => e.H > 0 ? '산성' : e.OH > 0 ? '염기성' : '중성';
let draft = { H: 20, OH: 0, liq: '' };

function vObserve() {
  const t = sim ? sim.tablets : 0;
  const doneN = Object.keys(S.obs).length;
  const need = t > doneN && !(sim && sim.busy);
  let h = `<h2>② 입자로 보기 · 제산제 ${t}/3알</h2>${legend()}`;
  if (sim && sim.busy) h += '<p class="muted">반응 중… OH⁻가 어디로 가는지 보세요.</p>';
  else if (need) {
    h += `<div class="box"><b>${t}알 넣은 뒤</b> 줄 세운 입자를 세어 적어요.
    <div class="step" style="margin-top:6px">
      <span>남은 H⁺</span><span></span><div class="stepper"><button data-d="H:-1">−</button><span id="cH">${draft.H}</span><button data-d="H:1">+</button></div>
      <span>남은 OH⁻</span><span></span><div class="stepper"><button data-d="OH:-1">−</button><span id="cOH">${draft.OH}</span><button data-d="OH:1">+</button></div>
    </div>${opts('liq', ['산성', '중성', '염기성'], draft.liq)}
    <div class="msg" id="omsg"></div><button class="wide" id="ocheck">확인</button></div>`;
  } else if (t < 3) {
    h += `<p>${t === 0 ? '카드 위에 위산(H⁺, Cl⁻)이 보이나요? ' : ''}제산제를 넣어 보세요.</p>
    <button class="wide" id="tab">제산제 1알 넣기</button>`;
  } else {
    h += `<p class="ok">세 번 다 기록했어요.</p><div class="row"><button class="sub" id="replay">처음부터 다시 보기</button><button id="onext">다음</button></div>`;
  }
  if (sim && !sim.busy && t > 0) h += `<button class="sub wide" id="mix">${sim.lined ? '섞인 모습 보기' : '줄 세워 보기'}</button>`;
  if (doneN) h += `<table class="rec"><tr><th>알</th><th>남은 H⁺</th><th>남은 OH⁻</th><th>액성</th></tr>${
    Object.entries(S.obs).map(([k, o]) => `<tr><td>${k}</td><td>${o.H}</td><td>${o.OH}</td><td>${o.liq}</td></tr>`).join('')}</table>`;
  return h;
}

function vCalc() {
  const P = PRODUCTS[productKey(me.sid)], c = S.calc;
  const row = (id, label, unit) => `<span>${label}</span><input type="number" step="any" inputmode="decimal" id="${id}" value="${esc(c[id])}"><span class="u">${unit}</span>`;
  return `<h2>③ 계산</h2>
  <p>내 학번으로 받은 제산제예요. 친구와 제품이 다를 수 있어요.</p>
  <div class="prod"><div class="pill"><b>${P.name}</b> ${P.f}<br>1알에 ${P.mg} mg · 화학식량 ${P.M}</div></div>
  ${P.n === 1 ? '<p class="muted">탄산수소 이온은 H⁺와 이렇게 반응해요: HCO₃⁻ + H⁺ → H₂O + CO₂</p>' : ''}
  <p class="muted">위 속 위산은 0.1 M 염산 100 mL (수업용 가정). 1 mmol = 0.001 mol</p>
  <div class="calc">
    ${row('a', '① 1알 속 성분의 양', 'mmol')}
    ${row('b', '② 1알이 없앨 수 있는 H⁺', 'mmol')}
    ${row('c', '③ 위 속 H⁺의 양', 'mmol')}
    ${row('d', '④ H⁺를 모두 없애는 데 필요한 알 수', '알')}
  </div><div class="msg" id="cmsg"></div>
  <button class="wide" id="ccheck">${c.ok ? '다음' : '확인'}</button>`;
}

function vJudge() {
  const P = isChem() ? PRODUCTS[productKey(me.sid)] : PRODUCTS.Mg;
  const basis = ['계산 결과', 'AR에서 본 남은 이온', '위는 소화를 위해 산성이어야 함', '제품 설명서의 복용량', '기타'];
  return `<h2>④ 판단</h2><p class="q">${P.name} 제산제, 몇 알이 적절할까요?</p>
  ${isChem() ? `<p class="muted">내 계산: H⁺를 모두 없애려면 ${esc(S.calc.d)}알</p>` : ''}
  ${opts('jn', ['1알', '2알', '3알', '4알'], S.judge.n)}
  <p>근거 (여러 개 골라도 돼요)</p>
  ${basis.map(b => `<label class="chk"><input type="checkbox" value="${b}" ${S.judge.basis.includes(b) ? 'checked' : ''}>${b}</label>`).join('')}
  <div class="box"><span class="muted">처음 예측: ${esc(S.pred)} · "${esc(S.predWhy)}"</span></div>
  <p>처음 예측과 비교해 이유를 써요 (무엇이 바뀌었나, 왜?)</p>
  <textarea id="jwhy">${esc(S.judge.why)}</textarea>
  <div class="msg no" id="jmsg"></div><button class="wide" id="jgo">판단 제출</button>`;
}

function vDone() {
  return `<h2>끝났어요 ✓</h2><p>기록을 선생님께 보냈어요. 이어서 선생님 설명을 들어요.</p>
  <div class="box">예측: ${esc(S.pred)} → 판단: ${esc(S.judge.n)}</div>
  <p class="muted">수업 후에는 앱 홈에서 [수업 후 연습]을 풀어요.</p>
  <button class="sub wide" id="again">입자 다시 보기</button>`;
}

/* ---------- 이벤트 ---------- */
const bind = {
  login(p) {
    let subj = '';
    p.querySelectorAll('[data-subj]').forEach(b => b.onclick = () => { subj = b.dataset.subj; p.querySelectorAll('[data-subj]').forEach(x => x.classList.toggle('on', x === b)); });
    $('#lgo').onclick = () => {
      const sid = $('#lsid').value.trim(), name = $('#lname').value.trim();
      if (!/^\d{5}$/.test(sid)) return $('#lmsg').textContent = '학번은 숫자 5자리예요.';
      if (!name || !subj) return $('#lmsg').textContent = '이름과 과목을 넣어 주세요.';
      me = { sid, name, subject: subj === '화학' ? 'chem' : 'isci', cls: '', lesson: subj === '화학' ? '4' : '1' };
      store.set('lensar:me', me); load(); render();
    };
  },
  시작(p) {
    p.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
      S.view = b.dataset.view; send('시작', { 보기방식: S.view }); go(S.pred ? 2 : 1);
    });
  },
  예측(p) {
    p.querySelectorAll('[data-pred]').forEach(b => b.onclick = () => { S.pred = b.dataset.pred; keep(); render(); $('#pwhy').value = S.predWhy; });
    $('#pwhy').oninput = e => { S.predWhy = e.target.value; keep(); };
    $('#pgo').onclick = () => {
      if (!S.pred) return $('#pmsg').textContent = '몇 알인지 골라요.';
      if (S.predWhy.trim().length < 2) return $('#pmsg').textContent = '이유를 한 줄 써요.';
      send('예측', { 예측_알: S.pred, 예측_이유: S.predWhy.trim() }); go(2);
    };
  },
  관찰(p) {
    const tab = $('#tab');
    if (tab) tab.onclick = () => { draft = { H: 20, OH: 0, liq: '' }; sim.addTablet(() => render()); render(); };
    const mix = $('#mix'); if (mix) mix.onclick = () => { sim.setLined(!sim.lined); render(); };
    p.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const [k, d] = b.dataset.d.split(':'); draft[k] = Math.max(0, Math.min(40, draft[k] + Number(d)));
      $('#c' + k).textContent = draft[k];
    });
    p.querySelectorAll('[data-liq]').forEach(b => b.onclick = () => { draft.liq = b.dataset.liq; p.querySelectorAll('[data-liq]').forEach(x => x.classList.toggle('on', x === b)); });
    const ck = $('#ocheck');
    if (ck) ck.onclick = () => {
      const t = sim.tablets, e = expect(t), m = $('#omsg');
      draft.tries = (draft.tries || 0) + 1;
      if (!draft.liq) { m.className = 'msg no'; m.textContent = '액성도 골라요.'; draft.tries--; return; }
      const okN = draft.H === e.H && draft.OH === e.OH, okL = draft.liq === liqOf(e);
      if (okN && okL) {
        S.obs[t] = { H: draft.H, OH: draft.OH, liq: draft.liq, tries: draft.tries }; keep();
        if (Object.keys(S.obs).length === 3) {
          const o = {}; [1, 2, 3].forEach(i => { const r = S.obs[i]; o[i + '알_H'] = r.H; o[i + '알_OH'] = r.OH; o[i + '알_액성'] = r.liq; o[i + '알_시도'] = r.tries; });
          send('관찰', o);
        }
        toast('맞아요!'); render();
      } else {
        m.className = 'msg no';
        m.textContent = !okN ? (draft.H !== e.H ? '빨간 H⁺ 줄을 다시 세어 보세요. 한 줄은 10개예요.' : '파란 OH⁻ 줄을 다시 세어 보세요.')
          : '남은 이온을 보고 액성을 다시 골라 보세요. H⁺가 남으면? OH⁻가 남으면?';
      }
    };
    const rp = $('#replay'); if (rp) rp.onclick = () => { sim.reset(); render(); };
    const nx = $('#onext'); if (nx) nx.onclick = () => go(isChem() ? 3 : 4);
  },
  계산(p) {
    const P = PRODUCTS[productKey(me.sid)], c = S.calc;
    ['a', 'b', 'c', 'd'].forEach(id => $('#' + id).oninput = e => { c[id] = e.target.value; keep(); });
    $('#ccheck').onclick = () => {
      if (c.ok) return go(4);
      const ans = { a: P.mg / P.M, b: P.n * P.mg / P.M, c: STOMACH_H, d: STOMACH_H / (P.n * P.mg / P.M) };
      const near = (v, t) => Math.abs(Number(v) - t) <= Math.max(0.05, Math.abs(t) * 0.03);
      const m = $('#cmsg'); m.className = 'msg no';
      if (['a', 'b', 'c', 'd'].some(id => c[id] === '' || isNaN(Number(c[id])))) return m.textContent = '네 칸을 모두 숫자로 채워요.';
      c.tries++;
      if (P.n > 1 && near(c.b, ans.a)) c.nmiss = 'Y';
      const wrong = ['a', 'b', 'c', 'd'].find(id => !near(c[id], ans[id]));
      keep();
      if (!wrong) {
        c.ok = true; keep();
        send('계산', { 제품: P.f, 성분_mmol: c.a, 중화H_mmol: c.b, 위산H_mmol: c.c, 완전중화_알: c.d, n누락: c.nmiss, 계산_시도: c.tries });
        m.className = 'msg ok'; m.textContent = '모두 맞아요. 다음으로 가요.'; $('#ccheck').textContent = '다음'; return;
      }
      m.textContent = {
        a: '① 질량(mg) ÷ 화학식량 = 양(mmol)이에요.',
        b: P.n > 1 ? `② ${P.f} 1개가 내놓는 OH⁻는 몇 개일까요?` : '② HCO₃⁻ 1개는 H⁺ 몇 개와 반응할까요?',
        c: '③ 몰 농도(M) × 부피(mL) = 양(mmol)이에요.',
        d: '④ 위 속 H⁺의 양 ÷ 1알이 없애는 H⁺의 양',
      }[wrong];
    };
  },
  판단(p) {
    p.querySelectorAll('[data-jn]').forEach(b => b.onclick = () => { S.judge.n = b.dataset.jn; keep(); p.querySelectorAll('[data-jn]').forEach(x => x.classList.toggle('on', x === b)); });
    p.querySelectorAll('.chk input').forEach(x => x.onchange = () => { S.judge.basis = [...p.querySelectorAll('.chk input:checked')].map(i => i.value); keep(); });
    $('#jwhy').oninput = e => { S.judge.why = e.target.value; keep(); };
    $('#jgo').onclick = () => {
      const j = S.judge, m = $('#jmsg');
      if (!j.n) return m.textContent = '몇 알인지 골라요.';
      if (!j.basis.length) return m.textContent = '근거를 하나 이상 골라요.';
      if (j.why.trim().length < 10) return m.textContent = '이유를 조금 더 자세히 써요 (10자 이상).';
      send('판단', { 판단_알: j.n, 근거: j.basis, 판단_이유: j.why.trim(), 예측_알: S.pred });
      send('완료', { 완료: 'Y' });
      go(5);
    };
  },
  완료() { $('#again').onclick = () => { S.step = 2; render(); }; },
};

/* ---------- AR / 3D 보기 ---------- */
let sim = null, viewOn = false, mindar = null, r3d = null, foundOnce = false, scanTimer = null;
const clock = new THREE.Clock();

async function startView() {
  if (viewOn) return; viewOn = true;
  if (!sim) sim = new Sim();
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
    mindar = new MindARThree({ container: $('#ar'), imageTargetSrc: 'assets/cards/cardC.mind', maxTrack: 1, uiLoading: 'no', uiScanning: 'no', uiError: 'no' });
    const { renderer, scene, camera } = mindar;
    const anchor = mindar.addAnchor(0);
    sim.group.position.set(0, 0, 0); sim.group.rotation.set(0, 0, 0);
    anchor.group.add(sim.group);
    anchor.onTargetFound = () => { foundOnce = true; $('#scan').classList.add('hidden'); };
    await mindar.start();
    renderer.setAnimationLoop(() => {
      sim.tick(Math.min(clock.getDelta(), 0.05));
      // 한번 잡힌 뒤에는 카드를 놓쳐도 마지막 자리에 장면을 남겨 둠 (숫자 입력하는 동안)
      if (foundOnce) anchor.group.visible = true;
      renderer.render(scene, camera);
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
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, 1, 0.01, 50);
  const ctl = new OrbitControls(cam, r3d.domElement);
  ctl.enableDamping = true; ctl.minDistance = 0.6; ctl.maxDistance = 4;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1269 / 900), new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load('assets/cards/cardC.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; }) }));
  scene.add(card);
  sim.group.position.set(0, 0, 0); scene.add(sim.group);
  ctl.target.set(0, 0.05, 0.1);
  const size = () => {
    const w = innerWidth, h = innerHeight;
    r3d.setSize(w, h); cam.aspect = w / h;
    cam.setViewOffset(w, h, 0, h * 0.22, w, h);   // 아래 패널을 피해 장면을 위로
    cam.position.set(0, -0.45, (w < h ? 0.95 * h / w : 1.5));
    cam.updateProjectionMatrix();
  };
  size(); addEventListener('resize', size);
  r3d.setAnimationLoop(() => { sim.tick(Math.min(clock.getDelta(), 0.05)); ctl.update(); r3d.render(scene, cam); });
}

/* ---------- 시작 ---------- */
function load() { S = Object.assign(fresh(), store.get(skey(), {})); }
if (me) load();
render();
flush();
