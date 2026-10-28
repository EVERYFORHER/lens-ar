// 효과음·배경음: 소리 파일 없이 Web Audio로 직접 만듦
// 모드: all(전부) → fx(효과음만) → off(끄기), 고른 모드는 폰에 기억
const MODES = ['all', 'fx', 'off'];
const ICON = { all: '🔊', fx: '🔉', off: '🔇' };
const TITLE = { all: '소리: 전부', fx: '소리: 효과음만', off: '소리: 끄기' };
const FX_VOL = 0.35, BGM_VOL = 0.07;   // 교실에서 30대가 함께 울리니 작게

let mode = 'all';
try { mode = localStorage.getItem('lensar:sound') || 'all'; } catch (e) {}
if (!MODES.includes(mode)) mode = 'all';

let ctx = null, fxBus = null, bgmBus = null, noiseBuf = null;
let bgmWanted = false, bgmTimer = null, nextT = 0, beat = 0, ducked = false;

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  fxBus = ctx.createGain(); fxBus.gain.value = mode === 'off' ? 0 : FX_VOL; fxBus.connect(ctx.destination);
  bgmBus = ctx.createGain(); bgmBus.gain.value = 0; bgmBus.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}
// 폰은 손가락으로 한 번 누른 뒤에야 소리가 나서, 첫 터치 때 깨움
function unlock() { if (!init()) return; if (ctx.state === 'suspended') ctx.resume(); syncBgm(); }
addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });

const live = () => ctx && ctx.state === 'running' && mode !== 'off';

function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
// 실로폰 느낌 음 하나 (기본음 + 높은 배음)
function bell(freq, t, vol, dec, bus) {
  [[1, 1], [3.99, 0.25]].forEach(([m, v]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq * m;
    env(g, t, 0.005, vol * v, m === 1 ? dec : dec * 0.35);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dec + 0.05);
  });
}
function noise(t, dur, filt, f0, f1, vol, q = 1) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true;
  f.type = filt; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  s.connect(f).connect(g).connect(fxBus);
  return { s, g, start: () => { s.start(t); s.stop(t + dur + 0.05); } };
}

export const sfx = {
  // 꿀꺽: 아래로 떨어지는 짧은 음 두 번
  gulp() {
    if (!live()) return; const t = ctx.currentTime;
    [0, 0.16].forEach(dt => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(320, t + dt); o.frequency.exponentialRampToValueAtTime(110, t + dt + 0.12);
      env(g, t + dt, 0.01, 0.9, 0.13); o.connect(g).connect(fxBus); o.start(t + dt); o.stop(t + dt + 0.2);
    });
  },
  // 슈웅: 식도로 내려가는 바람 소리
  whoosh(sec = 2) {
    if (!live()) return; const t = ctx.currentTime + 0.3;
    const n = noise(t, sec, 'bandpass', 1800, 300, 0, 2);
    n.g.gain.setValueAtTime(0.0001, t); n.g.gain.exponentialRampToValueAtTime(0.5, t + sec * 0.4); n.g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
    n.start();
  },
  // 치익: 알약이 부서지며 거품
  fizz() {
    if (!live()) return; const t = ctx.currentTime;
    const n = noise(t, 1.4, 'highpass', 2500, 5000, 0);
    n.g.gain.setValueAtTime(0.0001, t); n.g.gain.exponentialRampToValueAtTime(0.6, t + 0.03); n.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    n.start();
    for (let i = 0; i < 7; i++) bell(900 + Math.random() * 900, t + 0.05 + Math.random() * 0.9, 0.15, 0.08, fxBus);   // 톡톡 터지는 거품
  },
  // 띵: H⁺ + OH⁻ 한 쌍. i번째 쌍일수록 조금씩 높게
  ding(i = 0, big = false) {
    if (!live()) return; const t = ctx.currentTime;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    const f = 523.25 * Math.pow(2, scale[Math.min(i, scale.length - 1)] / 12);
    bell(f, t, big ? 0.9 : 0.6, big ? 1.4 : 0.6, fxBus);
    if (big) bell(f * 2, t + 0.12, 0.35, 0.9, fxBus);
  },
  // 반응 끝: 중성이면 맑은 화음, 아니면 짧은 낮은 음
  end(kind) {
    if (!live()) return; const t = ctx.currentTime;
    if (kind === '중성') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, t + i * 0.09, 0.5, 1.6, fxBus));
    else [196, 164.81].forEach((f, i) => bell(f, t + i * 0.18, 0.7, 0.5, fxBus));
  },
};

/* ---------- 배경음: 통통 튀는 짧은 멜로디 반복 ---------- */
const TEMPO = 0.26;   // 한 박(초)
const MEL = [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 69, 72, 0, 74, 76, 0,
             79, 0, 81, 79, 0, 76, 74, 0, 72, 0, 74, 76, 0, 74, 72, 0];
const BASS = [48, 55, 52, 55, 45, 52, 50, 55];
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
function schedule() {
  while (nextT < ctx.currentTime + 0.4) {
    const m = MEL[beat % MEL.length];
    if (m) bell(mf(m), nextT, 0.5, 0.35, bgmBus);
    if (beat % 4 === 0) bell(mf(BASS[(beat / 4) % BASS.length]), nextT, 0.45, 0.9, bgmBus);
    nextT += TEMPO; beat++;
  }
}
function syncBgm() {
  if (!ctx) return;
  const on = bgmWanted && mode === 'all' && ctx.state === 'running';
  const t = ctx.currentTime;
  bgmBus.gain.cancelScheduledValues(t);
  bgmBus.gain.setTargetAtTime(on ? (ducked ? BGM_VOL * 0.3 : BGM_VOL) : 0, t, 0.25);
  if (on && !bgmTimer) { nextT = t + 0.1; bgmTimer = setInterval(schedule, 100); }
  if (!on && bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
}
export function bgm(on) { if (on === bgmWanted) return; bgmWanted = on; syncBgm(); }
// 반응 중에는 "띵"이 잘 들리게 배경음을 줄임
export function duck(on) { if (on === ducked) return; ducked = on; syncBgm(); }

/* ---------- 🔊 버튼 ---------- */
export function bindButton(el) {
  const show = () => { el.textContent = ICON[mode]; el.title = TITLE[mode]; el.setAttribute('aria-label', TITLE[mode]); };
  show();
  el.onclick = () => {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    try { localStorage.setItem('lensar:sound', mode); } catch (e) {}
    show(); unlock();
    if (fxBus) fxBus.gain.setTargetAtTime(mode === 'off' ? 0 : FX_VOL, ctx.currentTime, 0.05);
    syncBgm();
    if (mode !== 'off') sfx.ding(2);
  };
}
