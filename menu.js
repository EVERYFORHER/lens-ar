// 화면 위 ⟲ 메뉴: AR 다시 체험 / 처음부터 다시 하기 / 다른 학번으로 시작
// 브라우저 확인 창 대신 메뉴 안에서 한 번 더 눌러 확인
export function bindMenu(btn, h) {
  const sheet = document.createElement('div');
  sheet.id = 'menu'; sheet.className = 'hidden';
  document.body.appendChild(sheet);
  let ask = '';
  const items = [
    ['replay', 'AR 다시 체험', '기록은 그대로 두고 장면만 처음부터 다시 봐요.'],
    ['restart', '처음부터 다시 하기', '새로 하고 새 기록을 보내요.'],
    ['logout', '다른 학번으로 시작', '지금 학생에서 나가 학번 입력 화면으로 가요.'],
  ];
  const draw = () => {
    sheet.innerHTML = '<div class="menu-box">' + items.filter(([k]) => !h.can || h.can(k)).map(([k, t, d]) =>
      `<button data-m="${k}" class="${ask === k ? 'warn' : 'sub'}"><b>${ask === k ? '한 번 더 누르면 ' + t : t}</b><small>${d}</small></button>`).join('')
      + '<button data-m="close" class="sub">닫기</button></div>';
    sheet.querySelectorAll('[data-m]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const k = b.dataset.m;
      if (k === 'close') return close();
      if (k !== 'replay' && ask !== k) { ask = k; return draw(); }   // 기록이 바뀌는 것은 두 번 눌러야
      close(); h[k]();
    });
  };
  const close = () => { ask = ''; sheet.classList.add('hidden'); };
  sheet.onclick = close;
  btn.textContent = '⟲'; btn.title = '다시 하기 메뉴'; btn.setAttribute('aria-label', '다시 하기 메뉴');
  btn.onclick = () => { ask = ''; draw(); sheet.classList.remove('hidden'); };
}

// ◀ LENS: 엔진이 새 창으로 열었으면 창을 닫고, 안 닫히면 엔진 학생 주소로 이동
const ENGINE = 'https://script.google.com/macros/s/AKfycbyWps2b7FANPAVDKDrfjSxDqFGq0--gp5ilnxNes6llrLjHTVVsHp4rPXvYrVibs6s/exec';
export function bindHome(btn) {
  btn.onclick = () => {
    try { window.close(); } catch (e) {}
    setTimeout(() => { location.href = ENGINE; }, 300);
  };
}

// 주소에서 학생 정보(sid 등)를 빼고 연결 키만 남김 (다른 학번으로 시작할 때)
export function dropStudentParams() {
  const q = new URLSearchParams(location.search);
  ['sid', 'name', 'subject', 'cls', 'lesson', 'reset'].forEach(k => q.delete(k));
  history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
}
