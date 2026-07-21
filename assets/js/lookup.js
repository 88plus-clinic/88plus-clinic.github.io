/* 내 예약 (조회·시간변경·취소) — reservation-lookup.html
 *
 * 로그인이 없다. 이름 + 생년월일 + 휴대전화 뒤 4자리로 남의 예약이 열리면 안 되므로
 *   · 서버는 "예약 없음"과 "정보 불일치"를 **같은 응답**으로 준다(존재 여부 자체를 숨김)
 *   · 서버가 10분 10회로 속도 제한을 건다(429)
 * 화면도 그 원칙을 그대로 따라야 한다 — 실패 사유를 나눠 말하지 않는다.
 */
(function () {
  'use strict';

  var API = 'https://api.88plus.co.kr/api';

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // 마지막 조회 정보 — 취소 후 목록을 다시 그리기 위해 메모리에만 둔다(저장 금지)
  var last = null;
  var byNo = {};        // 예약번호 → 예약(시간 변경 화면으로 넘길 때 쓴다)

  var STATUS = {
    pending:         { label: '확인 중',  cls: 'wait' },
    needs_call:      { label: '확인 중',  cls: 'wait' },
    manual_required: { label: '확인 중',  cls: 'wait' },
    confirmed:       { label: '예약 확정', cls: 'ok' },
    registered:      { label: '예약 확정', cls: 'ok' },
    cancelled:       { label: '취소됨',   cls: 'off' }
  };

  function fmtDate(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return iso || '';
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return p[0] + '년 ' + (+p[1]) + '월 ' + (+p[2]) + '일(' +
      '일월화수목금토'.charAt(d.getDay()) + ')';
  }

  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status === 429) throw new Error('too_many');
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  // ── 조회 ────────────────────────────────────────
  function lookup(e) {
    if (e) e.preventDefault();
    var name = $('#lName').value.trim();
    var birth = $('#lBirth').value.replace(/\D/g, '');
    var phone4 = $('#lPhone4').value.replace(/\D/g, '');

    if (name.length < 2) return alert('이름을 입력해 주세요.');
    if (birth.length !== 6) return alert('생년월일 6자리를 입력해 주세요. (예: 850312)');
    if (phone4.length !== 4) return alert('휴대전화 뒤 4자리를 입력해 주세요.');
    var btn = $('#lkSubmit');
    btn.disabled = true; btn.textContent = '조회 중…';

    post('/bookings/lookup', { name: name, birth: birth, phone4: phone4 })
      .then(function (res) {
        last = { name: name, birth: birth, phone4: phone4 };
        render(res.bookings || []);
      })
      .catch(function (err) {
        if (err.message === 'too_many') {
          alert('조회 시도가 너무 많습니다.\n잠시 후 다시 시도하시거나 ' +
                '전화(02-972-8800)로 문의해 주세요.');
        } else {
          alert('조회에 실패했습니다.\n잠시 후 다시 시도하시거나 ' +
                '전화(02-972-8800)로 문의해 주세요.');
        }
      })
      .then(function () {
        btn.disabled = false; btn.textContent = '예약 조회하기';
      });
  }

  // ── 결과 ────────────────────────────────────────
  function render(list) {
    var box = $('#lkResult');
    box.hidden = false;

    if (!list.length) {
      // 존재 여부를 흘리지 않기 위해 '없음'과 '비번 틀림'을 구분해 말하지 않는다
      box.innerHTML =
        '<div class="lk-empty">' +
        '<p class="lk-empty-h">예약을 찾지 못했습니다.</p>' +
        '<p>이름·생년월일·휴대전화 뒤 4자리를 다시 확인해 주세요.<br>' +
        '지난 예약은 일정 기간이 지나면 조회되지 않습니다.</p>' +
        '<p class="lk-empty-tel">확인이 어려우시면 <a href="tel:0229728800">02-972-8800</a></p>' +
        '</div>';
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    byNo = {};
    list.forEach(function (b) { byNo[b.reservation_no] = b; });
    box.innerHTML = '<h2 class="lk-h">예약 ' + list.length + '건</h2>' +
      list.map(card).join('');
    Array.prototype.forEach.call(box.querySelectorAll('[data-cancel]'), function (b) {
      b.addEventListener('click', function () { cancel(b.getAttribute('data-cancel'), b); });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-chg]'), function (b) {
      b.addEventListener('click', function () { goChange(b.getAttribute('data-chg')); });
    });
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function card(b) {
    var st = STATUS[b.status] || { label: b.status, cls: 'wait' };
    return '' +
      '<div class="lk-card ' + st.cls + '">' +
        '<div class="lk-card-top">' +
          '<span class="lk-badge ' + st.cls + '">' + st.label + '</span>' +
          '<span class="lk-no">예약번호 ' + esc(b.reservation_no) + '</span>' +
        '</div>' +
        '<p class="lk-type">' + esc(b.type_name) + '</p>' +
        '<p class="lk-when">' + fmtDate(b.date) + ' ' + esc(b.time) + '</p>' +
        (b.status_msg ? '<p class="lk-msg">' + esc(b.status_msg) + '</p>' : '') +
        (b.status === 'pending' || b.status === 'needs_call' || b.status === 'manual_required'
          ? '<p class="lk-hint">아직 예약이 확정된 것은 아닙니다. ' +
            '확정되면 알림톡으로 안내해 드립니다.</p>' : '') +
        (b.cancelable
          ? '<div class="lk-act">' +
            (b.changeable
              ? '<button type="button" class="lk-chg" data-chg="' +
                esc(b.reservation_no) + '">시간 변경</button>' : '') +
            '<button type="button" class="lk-cancel" data-cancel="' +
            esc(b.reservation_no) + '">예약 취소</button></div>'
          : (b.status === 'cancelled' ? ''
             : '<p class="lk-hint">이 예약은 홈페이지에서 취소하실 수 없습니다. ' +
               '<a href="tel:0229728800">02-972-8800</a> 으로 연락 주세요.</p>')) +
      '</div>';
  }

  /* ── 시간 변경 ────────────────────────────────────
     예약 화면(reservation.html)의 달력·시간 규칙을 그대로 쓰기 위해 그쪽으로 넘긴다.
     ⚠ 개인정보는 넘기지 않는다 — 조회에 성공해야 받는 **토큰**만 들고 간다. */
  function goChange(no) {
    var b = byNo[no];
    if (!b) return;
    try {
      sessionStorage.setItem('bk_change', JSON.stringify({
        no: b.reservation_no, token: b.token, btype: b.btype,
        type_name: b.type_name, date: b.date, time: b.time
      }));
    } catch (e) {
      return alert('이 브라우저에서는 시간 변경을 이용하실 수 없습니다.');
    }
    location.href = 'reservation.html?chg=1';
  }

  // ── 취소 ────────────────────────────────────────
  function cancel(no, btn) {
    if (!last) return;
    if (!confirm('예약을 취소하시겠습니까?\n\n예약번호 ' + no +
                 '\n취소하시면 되돌릴 수 없으며, 다시 예약하셔야 합니다.')) return;
    btn.disabled = true; btn.textContent = '취소 중…';

    post('/bookings/cancel', { reservation_no: no, token: (byNo[no] || {}).token })
      .then(function () {
        alert('예약이 취소되었습니다.');
        return post('/bookings/lookup', { name: last.name, birth: last.birth,
                                          phone4: last.phone4 })
          .then(function (res) { render(res.bookings || []); });
      })
      .catch(function (err) {
        btn.disabled = false; btn.textContent = '예약 취소';
        if (err.message === 'too_many') {
          alert('시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
        } else {
          alert('취소하지 못했습니다.\n이미 처리되었을 수 있습니다. ' +
                '다시 조회해 보시거나 전화(02-972-8800)로 문의해 주세요.');
        }
      });
  }

  // ── 시작 ────────────────────────────────────────
  $('#lkForm').addEventListener('submit', lookup);
  // 예약 완료 화면에서 넘어온 경우 예약번호를 미리 보여준다
  var q = new URLSearchParams(location.search).get('no');
  if (q) {
    var p = document.createElement('p');
    p.className = 'lk-prefill';
    p.innerHTML = '조회하실 예약번호 <b>' + esc(q) + '</b>';
    $('#lkFormWrap').insertBefore(p, $('#lkForm'));
  }
})();
