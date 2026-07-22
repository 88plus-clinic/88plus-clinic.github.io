/* 88플러스 홈페이지 — 공통 스크립트 (의존성 없음) */
(function () {
  'use strict';

  /* 헤더: 스크롤 시 하단선 표시 */
  var hd = document.getElementById('hd');
  function onScroll() {
    if (!hd) return;
    hd.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* 모바일 메뉴 */
  var btn = document.getElementById('hdMenu');
  var drawer = document.getElementById('hdDrawer');
  if (btn && drawer) {
    btn.addEventListener('click', function () {
      var on = drawer.classList.toggle('on');
      btn.classList.toggle('on', on);
    });
    drawer.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        drawer.classList.remove('on');
        btn.classList.remove('on');
      }
    });
  }

  /* 스크롤 등장 애니메이션 */
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  items.forEach(function (el, i) {
    /* 같은 그룹 안에서 순차 등장 */
    el.style.transitionDelay = (i % 4) * 90 + 'ms';
    io.observe(el);
  });
})();

/* 진료항목 아코디언 — 클릭 시 설명 펼침 */
(function () {
  var heads = document.querySelectorAll('.item-hd');
  if (!heads.length) return;
  heads.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.item');
      var open = item.classList.toggle('on');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
})();

/* 검사 선택 가이드 — 클릭 시 펼침 */
(function () {
  var btn = document.querySelector('.guide-btn');
  if (!btn) return;
  var wrap = btn.closest('.guide');
  btn.addEventListener('click', function () {
    var open = wrap.classList.toggle('on');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      setTimeout(function () {
        wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  });
})();

/* 검사 안내 상세 — 좌측 목차 현재 위치 표시 */
(function () {
  var nav = document.getElementById('egNav');
  if (!nav) return;
  var links = [].slice.call(nav.querySelectorAll('a[href^="#"]'));
  var secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  function mark() {
    var y = window.scrollY + 140, cur = 0;
    secs.forEach(function (s, i) { if (s && s.offsetTop <= y) cur = i; });
    links.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
  }
  window.addEventListener('scroll', mark, { passive: true });
  mark();
})();

/* 의료진 — 약력 자세히 보기 토글 */
(function () {
  var btns = [].slice.call(document.querySelectorAll('.doc-more'));
  if (!btns.length) return;
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var box = document.getElementById(b.getAttribute('aria-controls'));
      if (!box) return;
      var open = box.classList.toggle('on');
      b.classList.toggle('on', open);
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.textContent = open ? '약력 접기' : '약력 자세히 보기';
    });
  });
})();


/* ── 온라인 예약 임시 잠금 ─────────────────────────────
   아직 환자에게 공개할 준비가 안 된 상태(원장 지시 2026-07-22).
   예약 관련 링크를 모두 가로채 '준비 중' 안내를 띄운다.

   ⚠ 열 때는 **이 파일의 BOOKING_OPEN 을 true 로 바꾸기만** 하면 된다.
      페이지 HTML 은 손대지 않았으므로 되돌릴 것이 없다. */
(function () {
  'use strict';

  var BOOKING_OPEN = true;           // 2026-07-22 오픈(산부인과만 — 종류 제한은 booking.js OPEN_GROUPS)
  // 로컬 미리보기(127.0.0.1·localhost)에서는 잠그지 않는다 — 예약 화면을 계속
  // 다듬어야 하기 때문. 배포된 88plus.co.kr 은 위 스위치만 따르므로 영향이 없다.
  var PREVIEW = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
                location.protocol === 'file:';
  if (BOOKING_OPEN || PREVIEW) return;

  var LINK_RE = /reservation(-lookup)?\.html/;
  var TEL = '02-972-8800';

  function overlay(closable) {
    var wrap = document.createElement('div');
    wrap.className = 'soon-back' + (closable ? '' : ' fixed');
    wrap.innerHTML =
      '<div class="soon-box" role="dialog" aria-modal="true" aria-labelledby="soonH">' +
        '<p class="soon-eyebrow">Coming Soon</p>' +
        '<h2 class="soon-h" id="soonH">온라인 예약 준비 중입니다</h2>' +
        '<p class="soon-p">더 편하고 정확하게 이용하실 수 있도록 마지막 점검을 하고 있습니다.' +
          '<br>준비가 끝나는 대로 홈페이지에서 안내해 드리겠습니다.</p>' +
        '<p class="soon-p">그때까지 예약은 전화로 도와드리겠습니다.</p>' +
        '<a class="soon-tel" href="tel:0229728800">' + TEL + '</a>' +
        (closable ? '<button type="button" class="soon-close">닫기</button>'
                  : '<a class="soon-close" href="home.html">홈으로 돌아가기</a>') +
      '</div>';
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    function close() {
      wrap.remove();
      document.body.style.overflow = '';
    }
    if (closable) {
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap || e.target.className === 'soon-close') close();
      });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
      });
    }
  }

  // 1) 예약 링크 클릭을 모두 막는다 (헤더 탭·히어로 CTA·푸터·퀵바·드로어)
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || !LINK_RE.test(a.getAttribute('href') || '')) return;
    e.preventDefault();
    e.stopPropagation();
    overlay(true);
  }, true);

  // 2) 주소를 직접 입력해 들어온 경우 — 폼을 가리고 닫을 수 없는 안내를 띄운다
  if (LINK_RE.test(location.pathname)) {
    var main = document.querySelector('main');
    if (main) main.style.display = 'none';
    overlay(false);
  }
})();


/* ── 맨 위로 버튼 (원장 지시 2026-07-22) ──────────────────────
   페이지마다 HTML 을 고치지 않고 퀵바(.quick) 에 끼워 넣는다 —
   퀵바는 전 페이지에 이미 있으므로 이 파일 하나로 모든 페이지에 적용된다.
   내려간 뒤에만 보인다(맨 위에서 '맨 위로'는 쓸모가 없다). */
(function () {
  'use strict';

  var bar = document.querySelector('.quick');
  if (!bar) return;

  var a = document.createElement('a');
  a.className = 'quick-top';
  a.href = '#';
  a.setAttribute('aria-label', '맨 위로');
  a.innerHTML = '<span class="qi" aria-hidden="true">↑</span>맨 위로';
  bar.appendChild(a);

  a.addEventListener('click', function (e) {
    e.preventDefault();
    // 사용자가 '동작 줄이기'를 켜 두었으면 애니메이션 없이 이동한다
    var reduce = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  function toggle() {
    a.classList.toggle('on', window.scrollY > 420);
  }
  window.addEventListener('scroll', toggle, { passive: true });
  toggle();
})();
