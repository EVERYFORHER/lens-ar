// 기록을 보낼 공통 엔진(구글 앱스 스크립트 웹앱) 주소.
// 엔진이 AR을 열 때 ?engine=<자기 주소>를 붙이면 그 엔진으로 보냄(예: 심사용 사본).
// 붙이지 않으면 수업용 기본 엔진으로 보냄. 주소는 연결 키(?k=)와 함께 기억함.
const DEFAULT_ENGINE = 'https://script.google.com/macros/s/AKfycbyWps2b7FANPAVDKDrfjSxDqFGq0--gp5ilnxNes6llrLjHTVVsHp4rPXvYrVibs6s/exec';
const OK = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
const q = new URLSearchParams(location.search);
let saved = '';
try { saved = JSON.parse(localStorage.getItem('lensar:engine') || '""'); } catch (e) {}
if (q.get('k')) {
  const e = q.get('engine') || '';
  saved = OK.test(e) ? e : '';
  try { localStorage.setItem('lensar:engine', JSON.stringify(saved)); } catch (err) {}
}
export const ENGINE = OK.test(saved) ? saved : DEFAULT_ENGINE;
export const engineOk = u => OK.test(u || '');
