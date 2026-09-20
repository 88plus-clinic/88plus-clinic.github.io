/* 홈페이지 방문 통계 — 우리 서버(api.88plus.co.kr)로만 보낸다. 2026-09-20
 *
 * 🔴 이것이 지키는 약속 (개인정보처리방침에 적힌 그대로다)
 *   · 쿠키·로컬스토리지를 **쓰지 않는다.** 이용자 기기에 아무것도 남기지 않는다
 *   · 주소에 붙은 부가정보(?no=예약번호 등)를 **보내기 전에 잘라낸다**
 *   · 유입처는 **도메인만** 잘라 보낸다 — 검색어가 딸려 오는 것을 막기 위해
 *     (여기서 자르지 않으면 전체 주소가 네트워크를 타고 서버 접근로그에 남는다)
 *   · 구글·네이버 같은 외부 분석 서비스를 쓰지 않는다. 국외로 나가지 않는다
 *
 * ⚠ 이 스크립트는 **문진·초진·예약조회 페이지에는 붙이지 않는다.**
 *   환자가 개인정보를 적어 넣는 곳이다. 붙이더라도 아래 SKIP 이 한 번 더 막는다.
 *
 * ⚠ 실패해도 **페이지는 멀쩡해야 한다.** 전부 try/catch 안에 있고, 서버가 죽어도
 *   예약 폼·문진 폼은 그대로 뜬다.
 */
(function () {
  'use strict';
  var URL_ = 'https://api.88plus.co.kr/b';

  // 🔴 여기 걸리면 아무것도 보내지 않는다 (스크립트를 실수로 붙여도 안전)
  var SKIP = ['/obgychart/', '/munjin/', '/reservation-lookup.html'];

  var ua = navigator.userAgent || '';
  var path = '/';
  var dev = 'p';

  function send(obj) {
    try {
      var b = new Blob([JSON.stringify(obj)], { type: 'text/plain;charset=UTF-8' });
      // ⚠ sendBeacon 은 큐가 차면 **false** 를 돌려준다 — 그때는 폴백으로 간다
      if (navigator.sendBeacon && navigator.sendBeacon(URL_, b)) return;
      // 폴백 — 일부 브라우저·설정에서 sendBeacon 이 막힌다. 없으면 «없던 일»이 되므로
      // 계통적으로 빠지는 것을 줄인다. 실패해도 조용히 지나간다.
      fetch(URL_, { method: 'POST', body: b, keepalive: true, mode: 'no-cors' })
        .catch(function () { });
    } catch (e) { /* 통계는 페이지보다 중요하지 않다 */ }
  }

  try {
    // ⚠ 검색엔진 로봇은 세지 않는다. Googlebot 은 JS 를 실행하므로 비콘도 쏜다 —
    //   거르지 않으면 심야에 «방문» 이 규칙적으로 찍혀 숫자가 조용히 틀어진다.
    if (/bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pingdom/i.test(ua)) return;

    path = location.pathname || '/';
    // 🔴 **SKIP 을 «먼저» 본다.** 404 치환을 앞에 두면 `/obgychart/오타.html` 처럼
    //   그 3쪽 아래에서 404 가 났을 때 경로가 '/404' 로 바뀌어 **SKIP 을 빠져나간다**
    //   (2026-09-20 검토에서 발견). 「그 3쪽은 아무것도 보내지 않는다」는 약속은
    //   처리방침에도 적혀 있다 — 코드가 먼저 지켜야 한다.
    for (var i = 0; i < SKIP.length; i++) {
      if (path.indexOf(SKIP[i]) === 0) return;
    }
    // 🔴 **없는 쪽(404)** 은 고정 문자열로 쏜다. 경로를 그대로 보내면 서버가 「기타」로
    //   뭉개 구분이 안 된다. 위키에 **옛 페이지를 지워 알림톡 링크가 404 났던** 사고가
    //   있다 — 이 줄이 있으면 환자가 전화로 알려 주기 전에 이 화면에서 보인다.
    if (window.__is404) path = '/404';
    dev = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'm' : 'p';

    // 유입처 — **도메인만.** 전체 주소는 절대 보내지 않는다
    var src = '';
    try {
      src = document.referrer ? new URL(document.referrer).hostname : '';
    } catch (e) { src = ''; }

    var inapp = /KAKAOTALK/i.test(ua) ? 'kakao'
              : /NAVER\(inapp/i.test(ua) ? 'naver' : '-';

    send({
      p: path,                                   // 경로만 (쿼리·해시는 붙이지 않는다)
      d: dev,
      a: inapp,                                  // 카톡 인앱인가 (UA 원문은 안 보낸다)
      h: location.hostname,                      // 88plus.co.kr 인가 github.io 인가
      s: src                                     // 유입 도메인 (서버가 갈래로 접는다)
    });

    // ── 전환 ① 전화 걸기 — 모바일 의원에서 진짜 전환은 여기다 ──────────
    // 🔴 **어느 쪽에서 눌렀는지**를 함께 보낸다. 「비급여 안내를 보다 걸었나,
    //   오시는길을 보다 걸었나」는 뜻이 정반대다(가격 문의 vs 길 확인).
    document.addEventListener('click', function (ev) {
      try {
        var a = ev.target && ev.target.closest && ev.target.closest('a[href^="tel:"]');
        if (a) send({ e: 'tel_click', p: path, d: dev });
      } catch (e) { }
    }, true);
  } catch (e) { }

  // ── 전환 ②③ 예약 ────────────────────────────────────────────────────
  // 예약은 **주소가 바뀌지 않는다**(화면을 그 자리에서 갈아끼운다). 그래서 booking.js 가
  // 두 지점에서 불러 준다 — «신청 버튼을 눌렀다»(start) 와 «접수됐다»(done).
  // 🔴 둘을 나눠야 「예약 페이지는 보는데 신청이 없다」와 「신청은 하는데 실패한다」를
  //    가를 수 있다. «무슨 일이 있었다» 만 세고 누가 했는지는 담지 않는다.
  window.__hitBookStart = function () { send({ e: 'book_start', p: path, d: dev }); };
  window.__hitBookDone = function () { send({ e: 'book_done', p: path, d: dev }); };
})();
