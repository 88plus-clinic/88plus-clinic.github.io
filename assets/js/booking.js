/* 88플러스 온라인 예약 — 한 화면 3단(항목·날짜·시간) + 정보 입력
   ⚠ 슬롯 규칙은 서버(reservation/booking/slots.py)와 반드시 일치시킬 것.
      규칙이 바뀌면 양쪽을 함께 고쳐야 한다.
   이 화면은 '신청'만 받는다(확정 아님). 정원 초과 여부는 병원에서 확인 후 안내. */
(function () {
  'use strict';

  // ── 설정 ────────────────────────────────────────
  // 예약 접수 API — 국내 서버(가비아 VPS). 구글 시트 버퍼는 쓰지 않는다.
  // ⚠ 도메인이 바뀌면 서버의 ALLOW_ORIGINS(/opt/booking/.env)도 같이 고쳐야 CORS 가 통과한다.
  var API_URL = 'https://api.88plus.co.kr/api/bookings';
  var API_CHANGE = 'https://api.88plus.co.kr/api/bookings/change';
  var API_AVAIL = 'https://api.88plus.co.kr/api/availability';   // 마감(정원 초과) 시간 조회

  /* 시간 변경 모드 — 조회 화면(lookup.js)에서 넘어온다.
     같은 달력·시간 규칙을 두 번 만들지 않으려고 이 화면을 재사용한다.
     ⚠ 개인정보는 넘어오지 않는다 — 조회에 성공해야 받는 **토큰**으로만 변경한다. */
  var CHG = null;
  try {
    if (new URLSearchParams(location.search).get('chg') === '1') {
      var _raw = sessionStorage.getItem('bk_change');
      var _v = _raw ? JSON.parse(_raw) : null;
      if (_v && _v.no && _v.token && _v.btype) CHG = _v;
    }
  } catch (e) { CHG = null; }
  var MIN_LEAD_DAYS = 2;     // 검진·내시경 — 당일·익일 예약 불가
  var HORIZON_DAYS = 90;
  /* 익일 컷오프(원장 확정 2026-07-22) — 검진·내시경은 오후 4시 전이면 익일까지 가능,
     4시 이후엔 익일도 막고 모레부터. 이유: 16시 이후 들어온 익일 예약은 직원 퇴근 후라
     확정을 못 해준다(환자는 됐다고 알고 오면 서로 난감). 산부인과는 자동확정이라 예외. */
  var CUTOFF_HOUR = 16;
  /* 진료(내과·산부인과)는 당일 예약 허용(lead:0).
     다만 지금 바로는 안 되고 **현재 시각 + 2시간** 뒤부터 (원장 확정 2026-07-20). */
  var SAME_DAY_CUTOFF_H = 2;

  /* 대장내시경 계열 — 장정결제는 처방이 필요해 검사 전 내원 진료가 선행되어야 한다.
     진료는 검사일 기준 1주일 전까지(원장 확정 2026-07-20).
     따라서 온라인 예약 가능일도 오늘로부터 8일 뒤부터로 늦춘다
     (진료를 아무리 빨리 받아도 내일 → 그로부터 7일 = D+8). */
  var COLON_LEAD_DAYS = 8;
  var PREP_COLON =
    '대장내시경은 <b>검사 전 내원 진료가 필요합니다.</b> ' +
    '장을 비우는 <b>장정결제</b>는 처방을 받아야 하는 약이라, ' +
    '<b>검사일 1주일 전까지</b> 한 번 내원하셔서 진료 후 처방과 복용 방법을 ' +
    '안내받으셔야 합니다. 진료가 늦어지면 검사일을 미루셔야 할 수 있습니다.';

  /* 금식 기준(원장 확정 2026-07-21 → 2026-07-22 일원화)
       내시경·초음파·요소호기검사(UBT) = **물 포함 완전 금식**
       혈액검사 = 의학적으로는 소량의 물이 가능하나, **안내는 완전 금식으로 통일**한다.
     ⚠ 이유: 당일 초음파 등이 추가되는 일이 잦다. 물을 마시고 오면 되돌릴 수 없어
        검사가 취소되지만, 안 마시고 오면 손해가 없다 — 엄격한 쪽으로 통일한다. */
  var FAST_FULL = '<b>물·음료·껌·흡연을 포함한 완전 금식</b>';
  // 혈압약은 예외 — 검사 당일 아침에도 복용해야 한다(원장 확정 2026-07-22)
  var FAST_BP = ' 다만 <b>혈압약은 검사 당일 아침에도 소량의 물과 함께 복용</b>해 주세요.';
  // 내시경 — 물도 불가. ⚠ TYPES 안에서 쓰이므로 **TYPES 보다 위에** 있어야 한다
  //    (var 는 선언만 끌어올려지고 값은 안 올라가 undefined 가 된다)
  var PREP_ENDO_FAST =
    '위내시경은 <b>물·음료·껌·흡연을 포함한 완전 금식</b>이 필요합니다. ' +
    '검사 전 8시간 동안 아무것도 드시지 마세요.' + FAST_BP;

  var PREP_US_UPPER =
    '상복부 초음파는 검사 전 8시간 동안 ' + FAST_FULL + '이 필요합니다. ' +
    '물도 드시지 마세요.' + FAST_BP;

  // 하복부 초음파 — 방광이 차 있어야 검사가 정확하다(원장 확정 2026-07-20).
  var PREP_US_LOWER =
    '하복부 초음파는 검사 전 8시간 동안 ' + FAST_FULL + '이 필요합니다. ' +
    '또한 <b>검사 전 3시간 동안 소변을 참고</b> 오셔야 합니다 — ' +
    '방광이 차 있어야 검사가 정확합니다.' + FAST_BP;

  // 예약 종류 — code: 서버 BOOKING_TYPES 와 동일
  var TYPES = [
    { code:'checkup_nhis',      name:'국가공단검진',        group:'검진', res:'CHECKUP', step:60, need:1,
      note:'만 20세 이상 대상자 · 검진비 무료', endoOpt:true },
    { code:'checkup_nhis_plus', name:'공단검진 + 추가검진', group:'검진', res:'CHECKUP', step:60, need:1,
      note:'공단검진에 원하시는 항목을 추가', endoOpt:true, addons:true },
    { code:'checkup_employ',    name:'채용검진',            group:'검진', res:'CHECKUP', step:60, need:1,
      note:'제출처 양식이 있으면 지참해 주세요' },
    { code:'endo_gastro',  name:'위내시경',      group:'내과', sub:'내시경', res:'ENDO', step:60, need:1,
      note:'검사 전 8시간 완전 금식(물 포함)', warn:PREP_ENDO_FAST },
    { code:'endo_colon',   name:'대장내시경',    group:'내과', sub:'내시경', res:'ENDO', step:60, need:1,
      note:'검사 1주일 전까지 내원 진료 필요', warn:PREP_COLON, lead:COLON_LEAD_DAYS },
    { code:'endo_both',    name:'위+대장내시경', group:'내과', sub:'내시경', res:'ENDO', step:60, need:1,
      note:'검사 1주일 전까지 내원 진료 필요', warn:PREP_COLON, lead:COLON_LEAD_DAYS },
    // 초음파 — 초음파실 1시간 1명(원장 확정 2026-07-20)
    { code:'us_upper',   name:'상복부 초음파', group:'내과', sub:'초음파', res:'US', step:60, need:1,
      note:'검사 전 8시간 완전 금식(물 포함)', warn:PREP_US_UPPER },
    { code:'us_lower',   name:'하복부 초음파', group:'내과', sub:'초음파', res:'US', step:60, need:1,
      note:'완전 금식(물 포함) · 3시간 소변 참기', warn:PREP_US_LOWER },
    { code:'us_thyroid', name:'갑상선 초음파', group:'내과', sub:'초음파', res:'US', step:60, need:1 },
    { code:'us_carotid', name:'경동맥 초음파', group:'내과', sub:'초음파', res:'US', step:60, need:1 },
    // 내과 일반 진료는 예약을 받지 않는다(원장 지시 2026-07-20) — 내원 순서대로 접수.
    { code:'consult_obgy', name:'산부인과 진료', group:'산부인과', res:'OBGY', step:30, need:1,
      note:'목요일 휴진 · 당일 예약 가능', lead:0, reasons:true }
  ];
  var GROUPS = ['산부인과', '검진', '내과'];
  // 현재 온라인 예약이 열린 그룹. 나머지는 '준비 중 — 전화 예약' 안내만 띄운다.
  // (2026-07-22 원장 지시: 산부인과만 오픈, 내과·검진은 준비중)
  var OPEN_GROUPS = ['산부인과'];
  // ?preview=1 이면 내과·검진도 열어 본다(원장 테스트용 — 일반 방문자에겐 계속 '준비 중').
  var PREVIEW = false;
  try { PREVIEW = new URLSearchParams(location.search).get('preview') === '1'; } catch (e) {}
  function openGroups() { return PREVIEW ? GROUPS : OPEN_GROUPS; }
  var SUBS = { '내과': ['내시경', '초음파'] };   // 그룹 안의 2차 탭
  var GROUP_NOTE = {
    '검진': '검진은 <b>검사 전 8시간 동안 물을 포함한 완전 금식</b>이 필요합니다. ' +
            '당일 초음파 등 검사가 추가될 수 있어, 물도 드시지 않는 것이 안전합니다.' + FAST_BP,
    '내과': '일반 진료(감기·소화기·만성질환 등)는 <b>별도의 예약이 없습니다.</b> ' +
            '진료시간 내에 내원하시면 접수 순서대로 진료를 받으실 수 있습니다.'
  };

  /* 추가검진 항목 — 비급여 고지표(pricing.html) 기준.
     f:'F' = 여성만, fast:true = 금식 필요.
     ⚠ 이건 '신청'일 뿐 확정이 아니다. 최종 항목·비용은 내원 상담에서 정한다. */
  var ADDONS = [
    { g:'초음파', items:[
      { c:'us_upper',  n:'상복부 초음파', fast:true },
      { c:'us_lower',  n:'하복부 초음파', fast:true },
      { c:'us_thy',    n:'갑상선 초음파' },
      { c:'us_car',    n:'경동맥 초음파' },
      { c:'us_obgy',   n:'부인과 초음파', f:'F' }
    ]},
    // 유방촬영·골밀도는 추가검진 목록에서 제외(원장 지시 2026-07-20)
    { g:'혈액', items:[
      { c:'blood_full',n:'혈액종합검사 (50여종)', fast:true },
      { c:'tumor5',    n:'암표지자 5종', fast:true },
      { c:'vit_d',     n:'비타민 D' }
    ]},
    { g:'여성 검사', items:[
      { c:'pap',       n:'자궁경부암 액상세포검사', f:'F' },
      { c:'hpv',       n:'인유두종바이러스(HPV)',   f:'F' },
      { c:'amh',       n:'난소나이(AMH)',           f:'F' }
    ]}
  ];
  var ADDON_MAP = {};
  ADDONS.forEach(function (g) { g.items.forEach(function (i) { ADDON_MAP[i.c] = i; }); });

  /* 산부인과 진료 — 내원 목적 (분류 개편 2026-07-21, 원장 지시).
     초진차트(hub obgychart/obgychart.html Step3 name="symptom")와 **같은 항목·같은 분류**를 쓴다.
     ⚠ 한쪽만 고치면 예약과 차트가 갈라진다 — 세 곳을 함께 고칠 것:
        이 파일 · hub reservation/booking/db.py(OBGY_REASON_NAMES) · obgychart.html */
  var OBGY_REASONS = [
    { g:'일반 진료', items:['질염', '방광염', '질출혈', '생리관련',
                            '하복부통증', '뾰루지', '성병검사'] },
    { g:'임신 관련', items:['임신확인', '임신난임상담', '피임상담', '응급피임약',
                            '산모초음파', '산모 일반진료'] },
    { g:'정기검진 및 종합검진', items:['정기초음파검진', '웨딩검진', '갱년기검진',
                                       '자궁경부암검사'] },
    // 자궁경부암 백신도 온라인 예약을 받는다(원장 지시 2026-07-21 — 종전 제외 방침 변경)
    { g:'예방접종', items:['가다실9가', '가다실4가(국가예방접종)'] },
    { g:'Y존케어', items:['브라질리언레이저제모', '비키니라인레이저제모', '회음부 토닝'] }
  ];
  /* 자궁경부암 검진은 국가공단검진(일반검진)에 포함돼 함께 받을 수 있다.
     둘 다 원하시는 분이 '산부인과 진료'로 예약하면 검진 라인이 안 잡혀
     당일 동시 진행이 어려우므로, 검진 탭으로 안내한다(원장 지시 2026-07-20). */
  var PAP_LABEL = '자궁경부암검사';
  var PAP_WARN =
    '국가공단검진(일반검진)을 <b>함께 받고자 하시면 「검진」 탭에서 예약</b>해 주세요. ' +
    '자궁경부암 검진은 공단검진과 함께 받으실 수 있습니다.<br>' +
    '<b>당일 방문하셔서 두 가지를 한 번에 진행하는 것은 진료 상황에 따라 ' +
    '어려울 수 있습니다.</b>';

  /* 검진에 내시경을 함께 받는 경우 — 내시경실도 같이 잡아야 해서 서버 코드가 달라진다.
     대장이 포함되면 장정결제 사전 진료 때문에 리드타임이 D+8로 늘어난다. */
  var ENDO_OPTS = [
    { v:'gastro', sfx:'_endo',     name:'위내시경',
      label:'위내시경 (위암검진 포함)' },
    { v:'colon',  sfx:'_colon',    name:'대장내시경',
      label:'대장내시경' },
    { v:'both',   sfx:'_endoboth', name:'위+대장내시경',
      label:'위+대장내시경' }
  ];
  var ENDO_MAP = {};
  ENDO_OPTS.forEach(function (o) { ENDO_MAP[o.v] = o; });

  // 자원별 운영 구간 [요일들, 시작, 끝]  (0=일 … 6=토)  ※ JS는 0=일
  var WD = [1,2,3,4,5], SAT = [6];
  var RULES = {
    OBGY:  [[WD, '08:00','13:00'], [WD, '14:00','18:00'], [SAT,'08:00','13:00']],
    // 내시경은 15시가 마지막 — 수면에서 깨는 시간(원장 지시 2026-07-20)
    ENDO:  [[WD, '08:00','13:00'], [WD, '14:00','16:00'], [SAT,'08:00','13:00']],
    CHECKUP:[[WD,'08:00','13:00'], [WD, '14:00','18:00'], [SAT,'08:00','13:00']],
    US:    [[WD, '08:00','13:00'], [WD, '14:00','18:00'], [SAT,'08:00','13:00']]
  };
  var OBGY_CLOSED_DOW = [4];   // 목요일 산부인과 휴진 (JS 0=일 → 4=목)

  var closedDays = [];         // 공휴일·일요일 (assets/closed-days.json)
  var state = { group:GROUPS[0], sub:null, type:null, endo:'', sedation:'sleep',
               anti:'', together:false, date:null, time:null };
  var viewMonth;

  // ── 유틸 ────────────────────────────────────────
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var iso = function (d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') +
           '-' + String(d.getDate()).padStart(2,'0');
  };
  var toMin = function (t) { var p = t.split(':'); return +p[0]*60 + +p[1]; };
  var toStr = function (m) {
    return String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');
  };
  var dateOf = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); };

  /* 주민등록번호 앞 6자리 + 뒷자리 첫 한 자리 → 생년월일 8자리 + 성별.
     **뒷자리는 이 한 자리 외에는 받지 않는다** — 주민등록번호를 수집하지 않기 위해서다.
     성별코드: 9·0=1800년대, 1·2·5·6=1900년대, 3·4·7·8=2000년대 / 홀수=남, 짝수=여 */
  var RRN_C = { '9':1800, '0':1800, '1':1900, '2':1900, '5':1900, '6':1900,
                '3':2000, '4':2000, '7':2000, '8':2000 };
  function parseRrn(six, code) {
    var base = RRN_C[code];
    if (!base) return null;
    var yy = +six.slice(0, 2), mm = +six.slice(2, 4), dd = +six.slice(4, 6);
    var y = base + yy;
    var d = new Date(y, mm - 1, dd);
    // 실제로 있는 날짜인지(2월 30일 같은 입력 차단) + 미래가 아닌지
    if (d.getFullYear() !== y || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
    if (d > new Date()) return null;
    return { birth: String(y) + six.slice(2),
             gender: (+code % 2) ? 'M' : 'F' };
  }
  var fmtDate = function (s) {
    var d = dateOf(s);
    return d.getFullYear() + '년 ' + String(d.getMonth()+1).padStart(2,'0') + '월 ' +
           String(d.getDate()).padStart(2,'0') + '일(' + '일월화수목금토'[d.getDay()] + ')';
  };

  /* 그 날짜·종류에 가능한 시작 시각 목록.
     need>1 이면 같은 운영구간 안에서 연속 칸이 확보되는 시작만 남긴다(점심 건너뜀 방지). */
  function timesFor(type, d) {
    if (!type) return [];
    if (closedDays.indexOf(iso(d)) >= 0) return [];
    var dow = d.getDay();
    if (dow === 0) return [];
    if (type.res === 'OBGY' && OBGY_CLOSED_DOW.indexOf(dow) >= 0) return [];
    var out = [];
    (RULES[type.res] || []).forEach(function (blk) {
      if (blk[0].indexOf(dow) < 0) return;
      var s = toMin(blk[1]), e = toMin(blk[2]);
      for (var m = s; m + type.step * type.need <= e; m += type.step) out.push(toStr(m));
    });
    // 당일 예약은 지금부터 2시간 뒤 이후만 (진료 탭 전용 — 다른 종류는 애초에 당일이 막힘)
    var now = new Date();
    if (iso(d) === iso(now)) {
      var cut = now.getHours() * 60 + now.getMinutes() + SAME_DAY_CUTOFF_H * 60;
      out = out.filter(function (t) { return toMin(t) >= cut; });
    }
    return out.sort();
  }

  /* lead 는 0 이 유효값이라 falsy 체크(||)를 쓰면 안 된다 — 당일 예약이 막힌다.
     검진에 대장내시경을 붙이면 사전 진료(1주일 전) 때문에 리드타임이 늘어난다. */
  function baseLead(type) {
    var l = type.lead == null ? MIN_LEAD_DAYS : type.lead;
    if (type.endoOpt && (state.endo === 'colon' || state.endo === 'both')) {
      l = Math.max(l, COLON_LEAD_DAYS);
    }
    return l;
  }

  function isOpenDay(type, d) { return timesFor(type, d).length > 0; }   // 휴진·휴일·일요일 = 닫힘
  function nextOpen(type, d) {
    var x = new Date(d);
    do { x.setDate(x.getDate() + 1); } while (!isOpenDay(type, x));
    return x;
  }
  function cutoffHour(d) { return d.getDay() === 6 ? 12 : CUTOFF_HOUR; }  // 토 12시, 평일 16시

  /* 그 종류의 **가장 빠른 온라인 예약일**.
     검진·내시경(lead 2)은 영업일 컷오프: 오늘 컷오프 전이면 다음 영업일, 지나면 다다음 영업일.
     주말·공휴일은 영업일이 아니라 자동으로 건너뛴다(원장 확정 2026-07-22 · 시뮬레이션 검증). */
  function onlineFrom(type) {
    var today = new Date(); today.setHours(0,0,0,0);
    var bl = baseLead(type);
    if (bl === 0) return today;                                    // 산부인과 — 당일(자동확정)
    if (bl !== MIN_LEAD_DAYS) {                                    // 대장 등 긴 리드 — 달력 기준
      var m = new Date(today); m.setDate(m.getDate() + bl); return m;
    }
    var now = new Date();
    if (isOpenDay(type, today) && now.getHours() < cutoffHour(today)) {
      return nextOpen(type, today);
    }
    return nextOpen(type, nextOpen(type, today));
  }

  /* 날짜 상태: 'ok'(예약가능) · 'phone'(컷오프에 걸린 가까운 날 → 전화) · 'off'(과거·휴진·범위밖·긴리드) */
  function dayState(type, d) {
    if (!type) return 'off';
    var today = new Date(); today.setHours(0,0,0,0);
    var max = new Date(); max.setHours(0,0,0,0); max.setDate(max.getDate() + HORIZON_DAYS);
    if (d < today || d > max) return 'off';
    if (!isOpenDay(type, d)) return 'off';                         // 휴무·휴일·일요일
    if (d < onlineFrom(type)) {
      // 검진·내시경의 가까운 날만 '전화'(눌러 안내). 대장 등 긴 리드 창은 그냥 비활성.
      return (baseLead(type) === MIN_LEAD_DAYS) ? 'phone' : 'off';
    }
    return 'ok';
  }

  function bookableDate(type, d) { return dayState(type, d) === 'ok'; }

  function phoneNotice() {
    alert('가까운 날짜는 전화로 예약을 도와드리고 있어요.\n\n' +
          '☎ 02-972-8800\n\n' +
          '번거로우시겠지만 전화 주시면 바로 잡아드리겠습니다. 감사합니다.');
  }

  /* 예약 종류 코드(예: checkup_nhis_endo) → 기본 항목 + 내시경 옵션.
     변경 모드에서 원래 예약과 **같은 자원·같은 리드타임**으로 달력을 그려야 한다. */
  function typeFromCode(code) {
    var best = null;
    TYPES.forEach(function (t) {
      if (code === t.code || code.indexOf(t.code) === 0) {
        if (!best || t.code.length > best.code.length) best = t;
      }
    });
    var endo = '';
    if (best) {
      var sfx = code.slice(best.code.length);
      ENDO_OPTS.forEach(function (o) { if (o.sfx === sfx) endo = o.v; });
    }
    return { type: best, endo: endo };
  }

  // ── 1) 항목 ─────────────────────────────────────
  function renderTabs() {
    $('#bkTabs').innerHTML = GROUPS.map(function (g) {
      return '<button type="button" class="bk-tab' + (g === state.group ? ' on' : '') +
             '" data-g="' + g + '">' + g + '</button>';
    }).join('');
  }

  // 날짜·시간 패널과 신청 폼 표시/숨김 — 준비중 그룹에서는 감춘다.
  function bookingAreaVisible(show) {
    ['#bkPanelDate', '#bkPanelTime', '#bkFormWrap'].forEach(function (s) {
      var el = $(s); if (el) el.hidden = !show;
    });
    if (!show) { var tw = $('#bkTypeWarn'); if (tw) tw.hidden = true; }
  }

  function renderChips() {
    // 아직 오픈 안 된 그룹(검진·내과)은 예약 대신 '준비 중 · 전화' 안내를 띄운다.
    if (openGroups().indexOf(state.group) < 0) {
      $('#bkSubs').innerHTML = '';
      $('#bkChips').innerHTML =
        '<div class="bk-soon">' +
          '<b>온라인 예약 준비 중입니다</b>' +
          '<p><b>' + state.group + '</b> 예약은 아직 온라인으로 받고 있지 않습니다.<br>' +
          '전화로 예약해 주시면 친절히 안내해 드리겠습니다.</p>' +
          '<a class="bk-soon-tel" href="tel:0229728800">☎ 02-972-8800</a>' +
        '</div>';
      state.type = null;
      ['#bkOpt', '#bkSed', '#bkAnti', '#bkTog', '#bkExtra'].forEach(function (s) {
        var el = $(s); if (el) { el.hidden = true; el.innerHTML = ''; }
      });
      bookingAreaVisible(false);
      return;
    }
    bookingAreaVisible(true);

    var subs = SUBS[state.group];
    if (subs && subs.indexOf(state.sub) < 0) state.sub = subs[0];

    var head = '';
    if (GROUP_NOTE[state.group]) {
      head += '<p class="bx-gnote">' + GROUP_NOTE[state.group] + '</p>';
    }
    if (subs) {
      head += '<div class="bk-subtabs">' + subs.map(function (s) {
        return '<button type="button" class="bk-subtab' + (s === state.sub ? ' on' : '') +
               '" data-s="' + s + '">' + s + '</button>';
      }).join('') + '</div>';
    }
    $('#bkSubs').innerHTML = head;

    $('#bkChips').innerHTML = TYPES.filter(function (t) {
        return t.group === state.group && (!subs || t.sub === state.sub);
      })
      .map(function (t) {
        return '<button type="button" class="bk-chip' +
               (state.type && state.type.code === t.code ? ' on' : '') +
               '" data-c="' + t.code + '"><b>' + t.name + '</b>' +
               (t.note ? '<i>' + t.note + '</i>' : '') + '</button>';
      }).join('');
  }

  /* 검진에 함께 받을 내시경 선택 — 항목 패널 안에 둔다.
     날짜(리드타임)와 점유 자원이 달라지므로 달력보다 앞에 있어야 한다. */
  function renderOpt() {
    var box = $('#bkOpt'), t = state.type;
    if (!t || !t.endoOpt) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML =
      '<p class="bo-h">검진과 함께 받으실 내시경 <span>(선택)</span></p>' +
      ENDO_OPTS.map(function (o) {
        return '<label class="bo-item"><input type="radio" name="xEndo" value="' + o.v + '"' +
               (state.endo === o.v ? ' checked' : '') + '><span>' + o.label + '</span></label>';
      }).join('') +
      '<label class="bo-item"><input type="radio" name="xEndo" value=""' +
      (state.endo ? '' : ' checked') + '><span>받지 않음</span></label>' +
      '<details class="bx-help"><summary>위암검진 대상자인지 확인하는 방법</summary>' +
      '<div><ol>' +
      '<li><b>공단 홈페이지</b> — ' +
      '<a href="https://www.nhis.or.kr/nhis/index.do" target="_blank" rel="noopener">' +
      'nhis.or.kr</a> 접속 → <i>자주 찾는 서비스</i> → <i>건강검진 대상조회</i>' +
      '<em>본인 인증(간편인증·공동인증서) 후 올해 받으실 수 있는 검진 항목이 나옵니다.</em></li>' +
      '<li><b>「건강보험25시」 앱</b> — 로그인 후 <i>건강검진 대상조회</i></li>' +
      '<li><b>공단 고객센터 1577-1000</b> — 평일 09:00~18:00</li>' +
      '<li><b>공단에서 보내드린 검진표</b> — 우편·모바일 안내문에 받으실 검진 항목이 적혀 있습니다.</li>' +
      '</ol>' +
      '<p>확인이 어려우시면 선택하지 마시고 신청해 주세요. ' +
      '병원에서 확인 전화를 드릴 때 함께 확인해 드립니다.</p>' +
      '</div></details>';
    box.hidden = false;
  }

  /* 수면 / 비수면 — EGHIS 표기가 '위수/위비'로 갈리고, 수면은 신분증·귀가 안내가 붙는다.
     내원해서 바꿀 수 있으므로 부담 없이 고르시라고 안내한다(원장 지시 2026-07-20). */
  function hasEndo() {
    if (!state.type) return false;
    if (state.type.res === 'ENDO') return true;
    return !!(state.type.endoOpt && state.endo);
  }

  function renderSed() {
    var box = $('#bkSed');
    if (!box) return;
    if (!hasEndo()) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML =
      '<p class="bo-h">수면 여부</p>' +
      '<label class="bo-item"><input type="radio" name="xSed" value="sleep"' +
      (state.sedation === 'sleep' ? ' checked' : '') + '><span>수면 내시경</span></label>' +
      '<label class="bo-item"><input type="radio" name="xSed" value="awake"' +
      (state.sedation === 'awake' ? ' checked' : '') + '><span>비수면 내시경</span></label>' +
      '<p class="bo-note">내원하셔서 <b>변경하실 수 있으니</b> 편하게 선택해 주세요.<br>' +
      '수면으로 받으시는 경우, 검사 당일에는 <b>운전을 하시면 안됩니다.</b></p>';
    box.hidden = false;
  }

  function pickSed(v) {
    state.sedation = v || 'sleep';
    syncSummary();
  }

  /* 항혈전제(피 묽게 하는 약) 복용 여부 — 내시경이 포함될 때만 묻는다.
     조직검사·용종절제 시 출혈 위험이 있어 접수 매뉴얼 6.2 상 사전 상담이 필요하다.
     여기서 끊지 않고(예약은 받고) 병원이 확인 전화를 하는 방식 — 환자가 스스로
     판단해 포기하게 만들면 안 된다. */
  var ANTI_OPTS = [
    { v:'none',    label:'복용하지 않습니다' },
    { v:'yes',     label:'복용하고 있습니다' },
    { v:'unknown', label:'잘 모르겠습니다' }
  ];

  function renderAnti() {
    var box = $('#bkAnti');
    if (!box) return;
    if (!hasEndo()) { box.hidden = true; box.innerHTML = ''; state.anti = ''; return; }
    box.innerHTML =
      '<p class="bo-h">피가 묽어지는 약(항혈전제)을 드시고 계신가요? <span>(필수)</span></p>' +
      ANTI_OPTS.map(function (o) {
        return '<label class="bo-item"><input type="radio" name="xAnti" value="' + o.v + '"' +
               (state.anti === o.v ? ' checked' : '') + '><span>' + o.label + '</span></label>';
      }).join('') +
      '<details class="bx-help"><summary>어떤 약인가요?</summary>' +
      '<div><p>혈전(피떡)을 막기 위해 드시는 약입니다. 아래와 같은 약이 여기에 해당합니다.</p>' +
      '<ul>' +
      '<li>아스피린(아스트릭스·아스피린프로텍트 등)</li>' +
      '<li>플라빅스·클로피도그렐, 브릴린타, 플레탈</li>' +
      '<li>와파린(쿠마딘)</li>' +
      '<li>엘리퀴스, 자렐토, 프라닥사, 릭시아나</li>' +
      '</ul>' +
      '<p>심장·뇌혈관 질환, 부정맥(심방세동), 스텐트 시술을 받으신 분이 주로 드십니다. ' +
      '약 이름이 기억나지 않으시면 <b>잘 모르겠습니다</b>를 선택해 주세요.</p>' +
      '<p class="bo-warn"><b>임의로 약을 끊지 마세요.</b> 중단 여부는 반드시 처방하신 ' +
      '의사와 상의해야 합니다.</p></div></details>' +
      '<p class="bo-note" id="bkAntiNote" hidden>검사 중 조직검사나 용종 절제가 필요할 수 있어 ' +
      '<b>약 조절이 필요합니다.</b> 예약은 그대로 접수되며, ' +
      '병원에서 <b>확인 전화</b>를 드려 함께 정해 드립니다.</p>';
    box.hidden = false;
    antiNote();
  }

  // 안내문만 켜고 끈다 — 전체를 다시 그리면 열어 둔 도움말이 닫힌다
  function antiNote() {
    var n = $('#bkAntiNote');
    if (n) n.hidden = !(state.anti === 'yes' || state.anti === 'unknown');
  }

  function pickAnti(v) {
    state.anti = v || '';
    antiNote(); syncSummary();
  }

  /* 진료받으실 분 프로필 — 주민 앞자리로 성별·나이 추정(대상 안내용). */
  function profile() {
    var f1 = $('#fRrn1'), f2 = $('#fRrn2');
    var six = (f1 && f1.value || '').replace(/\D/g, '');
    var code = (f2 && f2.value || '').replace(/\D/g, '').slice(0, 1);
    if (six.length < 6 || !code) return null;
    var r = parseRrn(six, code);
    if (!r) return null;
    var year = +r.birth.slice(0, 4);
    return { gender: r.gender, age: (new Date()).getFullYear() - year, year: year };
  }

  // 주민 앞자리 입력 시 — 성별·나이 표시 + 나이 맞춤 안내 갱신
  function onProfileInput() {
    var p = profile(), w = $('#bkWho');
    if (w) {
      if (p) { w.textContent = (p.gender === 'F' ? '여성' : '남성') + ' · 만 ' + p.age + '세 (' + p.year + '년생)'; w.hidden = false; }
      else { w.hidden = true; w.textContent = ''; }
    }
    renderTogether();
  }

  /* 국가건강검진 동반 희망 — **내시경 예약에만**. 생년월일에 맞춰 문구만 바뀌고(대상 가능성 안내),
     자동배정은 없다. 대상 확정은 데스크가 공단 조회로 처리(원장 확정 2026-07-23). */
  function renderTogether() {
    var box = $('#bkTog');
    if (!box) return;
    if (!state.type || state.type.res !== 'ENDO') {   // 내시경(위/대장) 예약에만 노출
      box.hidden = true; box.innerHTML = ''; state.together = false; return;
    }
    var p = profile();
    var title = '국가건강검진도 함께 받길 원해요';
    var hint = '유방촬영·자궁경부암 검사 등. ';
    if (p && p.gender === 'F' && p.age >= 40) {
      title = '유방암·자궁경부암 검진도 함께 받으시겠어요?';
      hint = '만 ' + p.age + '세시면 올해 대상일 수 있어요(유방촬영·자궁경부암). ';
    } else if (p && p.gender === 'F' && p.age >= 20) {
      title = '자궁경부암 검진도 함께 받으시겠어요?';
      hint = '만 ' + p.age + '세시면 올해 자궁경부암 대상일 수 있어요. ';
    }
    box.innerHTML =
      '<label class="bo-tog' + (state.together ? ' on' : '') + '">' +
      '<input type="checkbox" id="xTog"' + (state.together ? ' checked' : '') + '>' +
      '<span class="bo-tog-t"><b>' + title + '</b>' +
      '<i>' + hint + '대상 여부는 병원에서 <b>공단 조회 후 확인</b>해 안내드립니다. 원치 않으시면 비워두세요.</i></span></label>';
    box.hidden = false;
  }

  function pickEndo(v) {
    state.endo = v;
    state.date = null; state.time = null;      // 리드타임이 바뀌므로 날짜를 다시 고른다
    renderMonth(viewMonth || new Date());
    renderTimes(); syncSummary(); showWarn(); renderSed(); renderAnti();
  }

  // 선택 항목의 사전 준비 안내(대장 사전진료·금식 등)
  function showWarn() {
    var w = $('#bkTypeWarn'), msgs = [];
    if (state.type) {
      if (state.type.warn) msgs.push(state.type.warn);
      if (state.type.endoOpt) {
        if (state.endo === 'gastro' || state.endo === 'both') msgs.push(PREP_ENDO_FAST);
        if (state.endo === 'colon'  || state.endo === 'both') msgs.push(PREP_COLON);
      }
    }
    w.innerHTML = msgs.map(function (m) { return '<span>' + m + '</span>'; }).join('');
    w.hidden = !msgs.length;
  }

  function pickType(code) {
    state.type = TYPES.filter(function (t) { return t.code === code; })[0];
    state.endo = ''; state.date = null; state.time = null; state.anti = ''; state.together = false;
    renderChips(); renderOpt(); renderSed(); renderAnti(); renderTogether();
    renderMonth(viewMonth || new Date());
    renderTimes();
    syncSummary();
    showWarn();
    renderExtra();
  }

  /* 검진 상세 — 위암검진(위내시경) 동반 여부 + 추가검진 항목.
     시간 계산은 그대로 둔다: 검진(60분 격자) 시작시각은 내시경(20분 격자)에도
     전부 존재하므로, 위내시경을 함께 잡아도 선택 가능한 시각은 같다. */
  function renderExtra() {
    var box = $('#bkExtra'), t = state.type;
    if (!t || (!t.addons && !t.reasons)) {
      box.hidden = true; box.innerHTML = ''; return;
    }
    var h = '<h3 class="bx-h">' + (t.reasons ? '내원 목적 <b>*</b>' : '검진 상세') + '</h3>';

    if (t.reasons) {
      h += '<p class="bx-sub">오늘 방문하시는 이유를 선택해 주세요. ' +
           '<b class="bx-req">필수 · 복수 선택 가능</b></p>' +
           '<div class="bx-groups bx-g4">';
      OBGY_REASONS.forEach(function (g) {
        h += '<div class="bx-g"><p class="bx-gn">' + g.g + '</p>';
        g.items.forEach(function (n) {
          h += '<label class="bx-item"><input type="checkbox" class="xRsn" value="' + n + '"' +
               (n === PAP_LABEL ? ' id="xPap"' : '') + '>' +
               '<span>' + n + '</span></label>';
        });
        h += '</div>';
      });
      h += '</div>' +
           '<p class="bx-fast" id="xPapWarn" hidden>' + PAP_WARN + '</p>' +
           '<div class="bk-field bx-etc"><label for="xEtc">그 밖에 말씀하실 내용 (선택)</label>' +
           '<input type="text" id="xEtc" maxlength="100" placeholder="목록에 없는 증상·문의를 적어주세요"></div>' +
           '<p class="bx-note">선택하신 내용은 <b>진료 준비를 위한 참고용</b>이며, ' +
           '자세한 문진은 내원 후 진행합니다. ' +
           '해당하는 항목이 없으시면 <b>그 밖에 말씀하실 내용</b>에 적어주세요.</p>';
    }

    if (t.addons) {
      h += '<p class="bx-sub">추가로 원하시는 검사를 선택해 주세요. (복수 선택)</p>' +
           '<div class="bx-groups">';
      ADDONS.forEach(function (g) {
        h += '<div class="bx-g"><p class="bx-gn">' + g.g + '</p>';
        g.items.forEach(function (i) {
          h += '<label class="bx-item"><input type="checkbox" class="xAdd" value="' + i.c + '">' +
               '<span>' + i.n + (i.f === 'F' ? ' <em>여성</em>' : '') + '</span></label>';
        });
        h += '</div>';
      });
      h += '</div>' +
           '<div class="bk-field bx-etc"><label for="xEtc">기타 원하시는 검사 (선택)</label>' +
           '<input type="text" id="xEtc" maxlength="100" placeholder="목록에 없는 검사를 적어주세요"></div>' +
           '<p class="bx-fast" id="xFast" hidden></p>' +
           '<p class="bx-note">선택하신 항목은 <b>신청</b>이며, 최종 검사 항목과 비용은 ' +
           '<b>내원 상담 후 확정</b>됩니다.</p>';
    }
    box.innerHTML = h;
    box.hidden = false;
  }

  function checkedAddons() {
    return Array.prototype.map.call(
      document.querySelectorAll('.xAdd:checked'), function (el) { return el.value; });
  }

  function checkedReasons() {
    return Array.prototype.map.call(
      document.querySelectorAll('.xRsn:checked'), function (el) { return el.value; });
  }

  function onExtraChange() {
    var pap = $('#xPapWarn');
    if (pap) pap.hidden = !$('#xPap').checked;
    var f = $('#xFast');
    if (!f) return;
    var need = checkedAddons().filter(function (c) { return ADDON_MAP[c] && ADDON_MAP[c].fast; });
    if (need.length) {
      f.innerHTML = '선택하신 항목 중 <b>금식이 필요한 검사</b>가 있습니다 (' +
        need.map(function (c) { return ADDON_MAP[c].n; }).join(', ') +
        '). 검사 전 8시간 동안 <b>물을 포함해 완전히 금식</b>해 주세요.' + FAST_BP;
      f.hidden = false;
    } else { f.hidden = true; }
  }

  // ── 2) 달력 ─────────────────────────────────────
  function renderMonth(base) {
    viewMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    $('#mLabel').textContent = viewMonth.getFullYear() + '년 ' +
      String(viewMonth.getMonth()+1).padStart(2,'0') + '월';
    var first = viewMonth.getDay();
    var last = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 0).getDate();
    var html = '';
    for (var i = 0; i < first; i++) html += '<i class="pad"></i>';
    for (var day = 1; day <= last; day++) {
      var d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      var st = dayState(state.type, d);
      // 'phone' 날은 **비활성이 아니라 클릭 가능** — 누르면 전화 예약 안내가 뜬다
      var cls = 'bk-day' + (st === 'ok' ? '' : (st === 'phone' ? ' phone' : ' off')) +
                (state.date === iso(d) ? ' sel' : '');
      var dis = (st === 'ok' || st === 'phone') ? '' : ' disabled';
      html += '<button type="button" class="' + cls + '"' + dis +
              ' data-d="' + iso(d) + '">' + day + '</button>';
    }
    $('#bkDays').innerHTML = html;
  }

  // ── 3) 시간 ─────────────────────────────────────
  // 그 날짜의 마감(정원 초과) 시간 — 허브 실제 점유(EGHIS 포함)를 VPS에서 받아 온다.
  var fullTimes = [];
  var availSeq = 0;
  function loadAvail() {
    fullTimes = [];
    if (!state.type || !state.date) { renderTimes(); return; }
    var seq = ++availSeq;
    renderTimes();               // 우선 그려두고(로딩), 응답 오면 마감표시 갱신
    fetch(API_AVAIL + '?type=' + encodeURIComponent(state.type.code) +
          '&date=' + encodeURIComponent(state.date))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (seq !== availSeq) return;          // 그 사이 날짜/항목이 바뀌면 무시
        fullTimes = (j && j.full) || [];
        renderTimes();
      })
      .catch(function () { /* 조회 실패 시 그냥 전체 노출(서버 hold가 최종 방어) */ });
  }

  function renderTimes() {
    var lbl = $('#bkPickedDate'), box = $('#bkTimes');
    if (!state.type) {
      lbl.textContent = '항목을 먼저 선택해 주세요';
      box.innerHTML = ''; return;
    }
    if (!state.date) {
      lbl.textContent = '날짜를 선택해 주세요';
      box.innerHTML = ''; return;
    }
    lbl.textContent = fmtDate(state.date);
    var ts = timesFor(state.type, dateOf(state.date));
    box.innerHTML = ts.map(function (t) {
      var full = fullTimes.indexOf(t) >= 0;    // 정원 마감
      return '<button type="button" class="bk-time' +
             (state.time === t ? ' on' : '') + (full ? ' full' : '') + '"' +
             (full ? ' disabled aria-disabled="true"' : '') +
             ' data-t="' + t + '">' + t +
             (full ? '<span class="bk-full">마감</span>' : '') + '</button>';
    }).join('') || '<p class="bk-empty">선택 가능한 시간이 없습니다.</p>';
  }

  // ── 선택 요약 ───────────────────────────────────
  function syncSummary() {
    var el = $('#bkSummary');
    if (!state.type || !state.date || !state.time) {
      el.className = 'bk-picked wait';
      el.textContent = '위에서 항목 · 날짜 · 시간을 모두 선택해 주세요.';
      return;
    }
    var eo = state.type.endoOpt ? ENDO_MAP[state.endo] : null;
    el.className = 'bk-picked';
    el.innerHTML = '<b>' + state.type.name + (eo ? ' + ' + eo.name : '') + '</b>' +
                   '<i>' + fmtDate(state.date) + ' ' + state.time + '</i>';
  }

  // ── 이벤트 ──────────────────────────────────────
  function bind() {
    $('#bkTabs').addEventListener('click', function (e) {
      if (CHG) return;
      var b = e.target.closest('.bk-tab'); if (!b) return;
      state.group = b.dataset.g; state.sub = null;
      renderTabs(); renderChips();
    });
    $('#bkSubs').addEventListener('click', function (e) {
      if (CHG) return;
      var b = e.target.closest('.bk-subtab'); if (!b) return;
      state.sub = b.dataset.s;
      renderChips();
    });
    $('#bkSed').addEventListener('change', function (e) {
      if (e.target.name === 'xSed') pickSed(e.target.value);
    });
    $('#bkAnti').addEventListener('change', function (e) {
      if (e.target.name === 'xAnti') pickAnti(e.target.value);
    });
    $('#bkTog').addEventListener('change', function (e) {
      if (e.target.id !== 'xTog') return;
      state.together = e.target.checked;
      var l = $('#bkTog .bo-tog'); if (l) l.classList.toggle('on', state.together);
      syncSummary();
    });
    $('#bkOpt').addEventListener('change', function (e) {
      if (CHG) return;
      if (e.target.name === 'xEndo') pickEndo(e.target.value);
    });
    $('#bkChips').addEventListener('click', function (e) {
      if (CHG) return;                      // 시간 변경 모드에서는 항목을 못 바꾼다
      var b = e.target.closest('.bk-chip'); if (!b) return;
      pickType(b.dataset.c);
    });
    $('#mPrev').addEventListener('click', function () {
      renderMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth()-1, 1));
    });
    $('#mNext').addEventListener('click', function () {
      renderMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 1));
    });
    $('#bkDays').addEventListener('click', function (e) {
      var b = e.target.closest('.bk-day'); if (!b || b.disabled) return;
      if (b.classList.contains('phone')) { phoneNotice(); return; }   // 당일·익일 → 전화 안내
      state.date = b.dataset.d; state.time = null;
      renderMonth(viewMonth); loadAvail(); syncSummary();
    });
    $('#bkTimes').addEventListener('click', function (e) {
      var b = e.target.closest('.bk-time'); if (!b || b.disabled) return;  // 마감 시간은 선택 불가
      state.time = b.dataset.t;
      renderTimes(); syncSummary();
    });

    // 휴대전화 3칸 — 다 채우면 다음 칸으로 넘어간다(초진차트와 같은 동작)
    [['#fPh1', 3, '#fPh2'], ['#fPh2', 4, '#fPh3'], ['#fPh3', 4, null]]
      .forEach(function (p) {
        var el = $(p[0]); if (!el) return;
        el.addEventListener('input', function (e) {
          e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, p[1]);
          if (p[2] && e.target.value.length === p[1]) $(p[2]).focus();
        });
      });
    $('#fRrn1').addEventListener('input', function (e) {
      e.target.value = e.target.value.replace(/[^\d]/g, '');
      if (e.target.value.length === 6) $('#fRrn2').focus();   // 6자리 채우면 자동 이동
      onProfileInput();
    });
    $('#fRrn2').addEventListener('input', function (e) {
      e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 1);
      onProfileInput();
    });
    $('#bkExtra').addEventListener('change', onExtraChange);
    $('#bkForm').addEventListener('submit', submit);
  }

  // ── 제출 ────────────────────────────────────────
  function submit(e) {
    e.preventDefault();
    if (CHG) return submitChange();
    if (!state.type) return alert('예약 항목을 선택해 주세요.');
    if (!state.date) return alert('예약 날짜를 선택해 주세요.');
    if (!state.time) return alert('예약 시간을 선택해 주세요.');
    // 내시경은 항혈전제 확인이 안전과 직결 — 빈칸으로 넘어가지 못하게 막는다
    if (hasEndo() && !state.anti) {
      $('#bkAnti').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return alert('피가 묽어지는 약(항혈전제) 복용 여부를 선택해 주세요.\n' +
                   '잘 모르시면 "잘 모르겠습니다"를 선택하시면 됩니다.');
    }

    var name = $('#fName').value.trim();
    var rrn1 = $('#fRrn1').value.replace(/\D/g, '');
    var rrn2 = $('#fRrn2').value.replace(/\D/g, '');
    var phone = ['#fPh1', '#fPh2', '#fPh3'].map(function (s) {
      return $(s).value.replace(/\D/g, '');
    }).join('');

    if (name.length < 2) return alert('이름을 입력해 주세요.');
    if (rrn1.length !== 6) {
      return alert('주민등록번호 앞 6자리를 입력해 주세요. (예: 850312)');
    }
    if (rrn2.length !== 1) {
      return alert('주민등록번호 뒷자리 첫 한 자리를 입력해 주세요.');
    }
    var id = parseRrn(rrn1, rrn2);
    if (!id) return alert('주민등록번호 앞자리를 다시 확인해 주세요.');
    var birth = id.birth;
    var g = { value: id.gender };
    if (phone.length < 10) return alert('휴대전화번호를 정확히 입력해 주세요.');
    if (state.type.reasons && !checkedReasons().length &&
        !($('#xEtc') && $('#xEtc').value.trim())) {
      return alert('내원 목적을 하나 이상 선택해 주세요.\n' +
                   '해당하는 항목이 없으시면 "그 밖에 말씀하실 내용"에 적어주세요.');
    }
    // 국외이전 동의는 삭제됨 — 접수 서버가 국내(가비아)로 바뀌어 이전 자체가 없다
    if (!$('#agr1').checked) return alert('개인정보 수집·이용에 동의해 주세요.');

    // 검진 상세
    var endoOpt = state.type.endoOpt ? ENDO_MAP[state.endo] : null;
    var addons = state.type.addons ? checkedAddons() : [];
    var reasons = state.type.reasons ? checkedReasons() : [];
    var addonEtc = ($('#xEtc') && $('#xEtc').value.trim()) || '';

    var wrongSex = addons.filter(function (c) {
      return ADDON_MAP[c].f && ADDON_MAP[c].f !== g.value;
    });
    if (wrongSex.length) {
      return alert('여성 대상 검사가 선택되어 있습니다: ' +
        wrongSex.map(function (c) { return ADDON_MAP[c].n; }).join(', ') +
        '\n선택을 해제하시거나 성별을 확인해 주세요.');
    }

    // 내시경이 포함되면 내시경실도 함께 잡아야 해 서버 코드가 달라진다
    var code = state.type.code + (endoOpt ? endoOpt.sfx : '');

    var payload = {
      client_id: 'r' + Date.now() + Math.random().toString(36).slice(2, 8),
      type: code,
      type_name: state.type.name + (endoOpt ? ' (' + endoOpt.name + ' 포함)' : ''),
      date: state.date, time: state.time,
      name: name, birth: birth, phone: phone, gender: g.value,
      endo_included: endoOpt ? endoOpt.name : '',
      sedation: hasEndo() ? state.sedation : '',
      antithrombotic: hasEndo() ? state.anti : '',
      addons: addons.map(function (c) { return ADDON_MAP[c].n; }),
      reasons: reasons,
      addon_etc: addonEtc,
      // 내시경 예약의 '국가검진 동반 희망'은 메모 앞에 표시로 남긴다 — 데스크가 공단 조회로 확정한다
      memo: (state.together ? '[국가검진 함께 희망] ' : '') + $('#fMemo').value.trim()
    };

    var btn = $('#bkSubmit');
    btn.disabled = true; btn.textContent = '전송 중…';

    send(payload).then(function (res) {
      $('#bkDoneBox').innerHTML =
        // 예약번호는 취소할 때 필요하다 — 맨 위에 크게 보여준다
        ((res && res.reservation_no)
          ? '<div><span>예약번호</span><b>' + res.reservation_no + '</b></div>' : '') +
        '<div><span>예약 항목</span><b>' + payload.type_name + '</b></div>' +
        (addons.length || reasons.length || addonEtc
          ? '<div><span>' + (state.type.reasons ? '내원 목적' : '추가 검사') + '</span><b>' +
            payload.addons.concat(reasons, addonEtc ? [addonEtc] : []).join(', ') +
            '</b></div>' : '') +
        '<div><span>희망 일시</span><b>' + fmtDate(state.date) + ' ' + state.time + '</b></div>' +
        '<div><span>신청자</span><b>' + name + '</b></div>';
      if (res && res.reservation_no && $('#bkGoLookup')) {
        $('#bkGoLookup').href = 'reservation-lookup.html?no=' + encodeURIComponent(res.reservation_no);
      }
      $('#bkDoneWarn').innerHTML = $('#bkTypeWarn').innerHTML;
      $('#bkDoneWarn').hidden = $('#bkTypeWarn').hidden;
      document.querySelector('.bk-panels').hidden = true;
      $('#bkFormWrap').hidden = true;
      $('#bkDoneView').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }).catch(function () {
      // 전화 예약으로 유도하지 않는다(원장 지시 2026-07-21) — 온라인에서 끝나야 한다
      alert('전송에 실패했습니다.\n잠시 후 다시 시도해 주세요.\n' +
            '계속 실패하면 인터넷 연결을 확인해 주세요.');
    }).then(function () {
      btn.disabled = false; btn.textContent = '예약 신청하기';
    });
  }

  /* 시간 변경 신청 — 서버는 요청만 받아 두고, 원내(허브)가 새 자리를 잡아야 성립한다.
     자리를 못 잡으면 기존 예약이 그대로 남는다(환자가 예약을 잃지 않는다). */
  function submitChange() {
    if (!state.date) return alert('예약 날짜를 선택해 주세요.');
    if (!state.time) return alert('예약 시간을 선택해 주세요.');
    if (state.date === CHG.date && state.time === CHG.time) {
      return alert('지금 예약과 같은 시간입니다. 다른 시간을 선택해 주세요.');
    }
    if (!confirm('예약 시간을 바꾸시겠습니까?\n\n' +
                 '지금: ' + fmtDate(CHG.date) + ' ' + CHG.time + '\n' +
                 '변경: ' + fmtDate(state.date) + ' ' + state.time)) return;

    var btn = $('#bkSubmit');
    btn.disabled = true; btn.textContent = '전송 중…';

    fetch(API_CHANGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservation_no: CHG.no, token: CHG.token,
                             date: state.date, time: state.time })
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function () {
      try { sessionStorage.removeItem('bk_change'); } catch (e) {}
      $('#bkDoneBox').innerHTML =
        '<div><span>예약 항목</span><b>' + CHG.type_name + '</b></div>' +
        '<div><span>지금 예약</span><b>' + fmtDate(CHG.date) + ' ' + CHG.time + '</b></div>' +
        '<div><span>변경 요청</span><b>' + fmtDate(state.date) + ' ' + state.time + '</b></div>';
      var h = document.querySelector('#bkDoneView .bk-h');
      if (h) h.textContent = '시간 변경을 신청했습니다';
      var note = document.querySelector('#bkDoneView .bk-note');
      if (note) {
        note.innerHTML = '아직 <b>변경이 확정된 것은 아닙니다.</b> ' +
          '병원 확인 후 알림톡으로 안내해 드립니다.<br>' +
          '요청하신 시간에 자리가 없으면 <b>기존 예약이 그대로 유지</b>됩니다.<br>' +
          '진행 상황은 <b>예약 조회</b>에서 확인하실 수 있습니다.';
      }
      $('#bkDoneWarn').hidden = true;
      document.querySelector('.bk-panels').hidden = true;
      var intro = document.querySelector('.bk-intro'); if (intro) intro.hidden = true;
      $('#bkFormWrap').hidden = true;
      $('#bkDoneView').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = '시간 변경 신청';
      var m = String(err.message || '');
      if (m.indexOf('429') >= 0) {
        alert('시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      } else if (m.indexOf('404') >= 0) {
        alert('예약을 찾을 수 없습니다. 「내 예약」에서 다시 조회해 주세요.');
      } else if (m.indexOf('409') >= 0) {
        alert('이미 변경을 신청하셨거나, 변경할 수 없는 예약입니다.\n' +
              '예약 조회에서 상태를 확인해 주세요.');
      } else {
        alert('전송에 실패했습니다.\n잠시 후 다시 시도해 주세요.');
      }
    });
  }

  function send(payload) {
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  /* ── 시간 변경 모드 화면 만들기 ──────────────────
     항목은 바꿀 수 없다(항목이 바뀌면 준비사항·리드타임·자리가 통째로 달라진다).
     날짜·시간만 고른다(본인 확인은 조회 단계에서 이미 끝났다). */
  function setupChangeUI() {
    var t = typeFromCode(CHG.btype);
    if (!t.type) { CHG = null; return; }      // 모르는 종류면 일반 예약 화면 그대로
    state.type = t.type;
    state.endo = t.endo;
    state.date = null; state.time = null;

    var h1 = document.querySelector('.sub-hero h1');
    if (h1) h1.textContent = '예약 시간 변경';
    var lead = document.querySelector('.sub-hero .sh-lead');
    if (lead) {
      lead.textContent = '새로 원하시는 날짜와 시간을 선택해 주세요. ' +
        '병원 확인 후 알림톡으로 안내드리며, 확정 전까지는 기존 예약이 그대로 유지됩니다.';
    }

    // 예약 전 안내 → 지금 예약 정보로 교체
    var intro = document.querySelector('.bk-intro');
    if (intro) {
      intro.innerHTML =
        '<p class="bi-lead">지금 예약 <b>' + CHG.type_name + '</b><br>' +
        fmtDate(CHG.date) + ' ' + CHG.time + '</p>' +
        '<ul class="bi-list">' +
        '<li><b>검사 항목은 변경하실 수 없습니다.</b> 항목 변경을 원하시는 경우 ' +
        '<b>예약을 취소하신 뒤 새로 신청</b>해 주세요.</li>' +
        '<li>요청하신 시간에 자리가 없으면 <b>기존 예약이 그대로 유지</b>됩니다.</li>' +
        '</ul>';
    }

    /* 항목 선택 패널은 감춘다.
       ⚠ hidden 속성만으로는 부족하다 — `.bk-panel{display:flex}` 가 이겨서 그대로 보였고,
          실제로 변경 화면에서 항목이 눌리는 사고가 났다(2026-07-21).
          CSS 에 `[hidden]{display:none!important}` 를 넣었고, 여기서도 한 번 더 막는다. */
    var panels = document.querySelectorAll('.bk-panel');
    if (panels[0]) {
      panels[0].hidden = true;
      panels[0].style.display = 'none';
    }

    /* 예약자 정보는 다시 받지 않는다 — 조회에서 본인 확인이 끝났고,
       그때 받은 토큰으로 변경한다(개인정보를 화면 사이로 들고 다니지 않는다). */
    var wrap = document.querySelector('#bkFormWrap .bp-h2');
    if (wrap) wrap.textContent = '변경 내용 확인';
    Array.prototype.forEach.call(document.querySelectorAll('#bkForm .bk-field'),
      function (f) { f.hidden = true; });
    ['.bk-agree', '.bk-warn', '#bkExtra'].forEach(function (sel) {
      var el = document.querySelector(sel); if (el) el.hidden = true;
    });
    var btn = $('#bkSubmit');
    if (btn) btn.textContent = '시간 변경 신청';
  }

  // ── 시작 ────────────────────────────────────────
  fetch('assets/closed-days.json')
    .then(function (r) { return r.json(); })
    .catch(function () { return []; })
    .then(function (list) {
      closedDays = list || [];
      if (CHG) setupChangeUI();
      if (PREVIEW) {                       // 미리보기 모드 — 안내 배너를 바꿔 둔다
        var oi = document.querySelector('.bk-openinfo');
        if (oi) oi.innerHTML = '<b>🔍 미리보기 모드 — 내과·검진 예약이 열려 있습니다.</b>' +
          '<span>원장님 테스트용 화면입니다. 일반 방문자에겐 보이지 않습니다.</span>';
      }
      renderTabs(); renderChips();
      renderMonth(new Date());
      renderTimes(); syncSummary(); bind();
      if (CHG) { showWarn(); renderSed(); renderAnti(); }
    });
})();
