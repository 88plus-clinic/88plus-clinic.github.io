/* 88챗봇 88돌이 — 전 페이지 공통 플로팅 위젯 (자기완결형)
   페이지엔 이 파일 한 줄만 넣으면 된다:
     <script src="assets/js/chat.js?v=..."></script>        (루트)
     <script src="../assets/js/chat.js?v=..."></script>     (checkup/ 등 하위폴더)
   CSS·DOM·로직·마스코트 이미지 경로까지 이 파일이 스스로 넣는다.
   → 위젯을 고칠 땐 이 파일 하나만 고친다(각 페이지 손대지 않는다). */
(function(){
  if (window.__doriLoaded) return;      // 중복 로드 방지
  window.__doriLoaded = true;

  // 이 스크립트의 위치에서 assets 기준경로를 구한다(하위폴더에서도 이미지가 뜨도록)
  var me = document.currentScript ||
    Array.prototype.slice.call(document.scripts).filter(function(s){ return /chat\.js/.test(s.src); }).pop();
  var BASE = (me && me.src ? me.src.replace(/js\/chat\.js.*$/, '') : 'assets/');   // → .../assets/
  var IMG  = BASE + 'img/chatbot.png';

  // 환자용 챗봇 API 주소 (예약 VPS). 비우면 "준비중"으로 안내.
  var CHAT_API = "https://api.88plus.co.kr/api/chat/ask";

  // ── 스타일 주입 ────────────────────────────────────────────
  var css = ''
  + '.dori-fab{position:fixed;right:18px;bottom:18px;z-index:120;display:flex;align-items:center;'
  +   'gap:10px;border:none;background:none;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent;}'
  + '.dori-fab.raise{bottom:74px;}'                    /* 모바일 하단 바가 있을 때 위로 */
  + '.dori-bubble{order:-1;background:#fff;color:#1A1A18;font-size:13px;font-weight:700;'
  +   'letter-spacing:-.01em;padding:9px 13px;border-radius:14px 14px 4px 14px;'
  +   'box-shadow:0 4px 16px rgba(40,40,30,.16);white-space:nowrap;animation:doriPop .5s cubic-bezier(.22,.61,.36,1) both;}'
  + '.dori-bubble b{color:#3F5A14;}'
  + '@keyframes doriPop{from{opacity:0;transform:translateY(6px) scale(.9);}}'
  + '.dori-egg{width:66px;height:66px;border-radius:50%;overflow:hidden;background:#fff;'
  +   'box-shadow:0 6px 20px rgba(92,127,34,.30);display:grid;place-items:center;'
  +   'transition:transform .25s cubic-bezier(.22,.61,.36,1);animation:doriFloat 3.2s ease-in-out infinite;}'
  + '.dori-fab:hover .dori-egg{transform:scale(1.06);}'
  + '.dori-egg img{width:100%;height:100%;object-fit:cover;display:block;}'
  + '.dori-egg.fallback{background:linear-gradient(155deg,#8BB04A,#5C7F22);}'
  + '.dori-egg .fb{font-size:30px;line-height:1;}'
  + '@keyframes doriFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}'
  + '.dori-dot{position:absolute;top:-2px;right:-2px;width:15px;height:15px;background:#E0533B;'
  +   'border:2.5px solid #FAF9F5;border-radius:50%;}'
  + '.chat{position:fixed;right:18px;bottom:18px;z-index:130;width:min(380px,calc(100vw - 24px));'
  +   'height:min(560px,calc(100vh - 32px));background:#FAF9F5;border-radius:20px;overflow:hidden;'
  +   'box-shadow:0 18px 60px rgba(30,30,20,.28);border:1px solid #E5E2D8;display:none;flex-direction:column;}'
  + '.chat.open{display:flex;animation:chatIn .28s cubic-bezier(.22,.61,.36,1) both;}'
  + '@keyframes chatIn{from{opacity:0;transform:translateY(14px) scale(.96);}}'
  + '.chat-hd{display:flex;align-items:center;gap:11px;padding:12px 14px;background:#5C7F22;color:#fff;}'
  + '.chat-hd .hd-egg{width:42px;height:42px;border-radius:50%;overflow:hidden;background:#fff;flex:0 0 auto;}'
  + '.chat-hd .hd-egg img{width:100%;height:100%;object-fit:cover;display:block;}'
  + '.chat-hd-tx{flex:1;min-width:0;line-height:1.3;}'
  + '.chat-hd-t{font-size:15px;font-weight:800;}'
  + '.chat-hd-s{font-size:11.5px;color:rgba(255,255,255,.82);font-weight:500;}'
  + '.chat-x{flex:0 0 auto;width:30px;height:30px;border:none;cursor:pointer;background:rgba(255,255,255,.14);'
  +   'color:#fff;border-radius:9px;font-size:18px;display:grid;place-items:center;transition:background .2s;}'
  + '.chat-x:hover{background:rgba(255,255,255,.26);}'
  + '.chat-body{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:11px;}'
  + '.msg{max-width:82%;font-size:14px;line-height:1.6;padding:11px 14px;border-radius:15px;'
  +   'word-break:keep-all;white-space:pre-wrap;}'
  + '.msg.bot{align-self:flex-start;background:#fff;color:#1A1A18;border:1px solid #E5E2D8;border-bottom-left-radius:5px;}'
  + '.msg.me{align-self:flex-end;background:#5C7F22;color:#fff;border-bottom-right-radius:5px;}'
  + '.msg.typing span{display:inline-block;animation:blink 1.2s infinite;}'
  + '.msg.typing span:nth-child(2){animation-delay:.2s;}.msg.typing span:nth-child(3){animation-delay:.4s;}'
  + '@keyframes blink{0%,60%,100%{opacity:.25;}30%{opacity:1;}}'
  + '.chat-chips{display:flex;flex-wrap:wrap;gap:7px;padding:0 14px 10px;}'
  + '.chip{font-size:12.5px;font-weight:600;color:#3F5A14;background:#EDF2E2;border:1px solid #DCE6C9;'
  +   'border-radius:20px;padding:7px 12px;cursor:pointer;transition:background .2s,transform .15s;}'
  + '.chip:hover{background:#E2ECCF;transform:translateY(-1px);}'
  + '.chat-in{display:flex;gap:8px;padding:12px 12px calc(12px + env(safe-area-inset-bottom));'
  +   'border-top:1px solid #E5E2D8;background:#FAF9F5;}'
  + '.chat-in input{flex:1;min-width:0;border:1px solid #E5E2D8;border-radius:12px;padding:12px 14px;'
  +   'font-size:14px;font-family:inherit;background:#fff;color:#1A1A18;outline:none;transition:border-color .2s;}'
  + '.chat-in input:focus{border-color:#5C7F22;}'
  + '.chat-send{flex:0 0 auto;width:44px;border:none;border-radius:12px;cursor:pointer;background:#5C7F22;'
  +   'color:#fff;display:grid;place-items:center;transition:background .2s;}'
  + '.chat-send:hover{background:#3F5A14;}.chat-send:disabled{background:#C7C7BC;cursor:default;}'
  + '.chat-send svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}'
  + '.chat-warn{font-size:10.5px;color:#8A8A80;text-align:center;padding:0 14px 9px;line-height:1.45;}'
  + '@media (max-width:420px){.chat{right:8px;bottom:8px;width:calc(100vw - 16px);height:calc(100vh - 16px);}'
  +   '.dori-fab{right:14px;}}'
  + '@media (prefers-reduced-motion:reduce){.dori-egg{animation:none;}.chat.open{animation:none;}.dori-bubble{animation:none;}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ── DOM 조립 ───────────────────────────────────────────────
  function eggImg(cls){
    return '<span class="'+cls+'"><img src="'+IMG+'" alt="88돌이" '
         + 'onerror="this.parentNode.classList.add(\'fallback\');this.outerHTML=\'<span class=&quot;fb&quot;>💬</span>\';"></span>';
  }
  var fab = document.createElement('button');
  fab.className = 'dori-fab'; fab.id = 'doriFab';
  fab.setAttribute('aria-label','88챗봇 열기 — 무엇이든 물어보세요');
  fab.innerHTML = '<span class="dori-bubble">무엇이든 <b>물어보세요</b></span>'
    + eggImg('dori-egg') + '<span class="dori-dot"></span>';
  document.body.appendChild(fab);

  var panel = document.createElement('section');
  panel.className = 'chat'; panel.id = 'chatPanel';
  panel.setAttribute('aria-label','88챗봇 대화'); panel.setAttribute('role','dialog');
  panel.innerHTML =
      '<header class="chat-hd">' + eggImg('hd-egg')
    +   '<span class="chat-hd-tx"><span class="chat-hd-t">88챗봇 · 88돌이</span>'
    +   '<span class="chat-hd-s">검사 · 예약 · 진료 안내를 도와드려요</span></span>'
    +   '<button class="chat-x" id="chatX" aria-label="닫기">×</button></header>'
    + '<div class="chat-body" id="chatBody" aria-live="polite"></div>'
    + '<div class="chat-chips" id="chatChips">'
    +   '<button class="chip">위내시경 준비는 어떻게 하나요?</button>'
    +   '<button class="chip">건강검진 예약하고 싶어요</button>'
    +   '<button class="chip">주차 되나요?</button>'
    +   '<button class="chip">토요일도 진료하나요?</button></div>'
    + '<form class="chat-in" id="chatForm">'
    +   '<input id="chatText" type="text" placeholder="궁금한 점을 입력하세요" autocomplete="off" maxlength="200" aria-label="질문 입력">'
    +   '<button class="chat-send" id="chatSend" type="submit" aria-label="보내기">'
    +   '<svg viewBox="0 0 24 24"><path d="m4 12 16-8-6 16-3-6-7-2z"/></svg></button></form>'
    + '<p class="chat-warn">안내용 자동응답입니다 · 개인정보(이름·주민번호·연락처)는 입력하지 마세요 · 정확한 상담은 <b>02-972-8800</b></p>';
  document.body.appendChild(panel);

  // 모바일 하단 고정 바(.quick)가 있는 페이지면 FAB 를 그 위로 올린다
  if (document.querySelector('.quick')) fab.classList.add('raise');

  // ── 로직 ───────────────────────────────────────────────────
  var body  = panel.querySelector('#chatBody');
  var form  = panel.querySelector('#chatForm');
  var text  = panel.querySelector('#chatText');
  var sendB = panel.querySelector('#chatSend');
  var chips = panel.querySelector('#chatChips');
  var dot   = fab.querySelector('.dori-dot');
  var greeted = false, busy = false;

  function open(){
    panel.classList.add('open'); fab.style.display='none'; if(dot) dot.style.display='none';
    if(!greeted){ greeted = true;
      bot("안녕하세요! 88플러스 안내를 도와드리는 88돌이예요. 🌱\n검사·예약·오시는 길 등 궁금한 점을 편하게 물어보세요.");
    }
    setTimeout(function(){ text.focus(); }, 250);
  }
  function close(){ panel.classList.remove('open'); fab.style.display='flex'; }

  fab.addEventListener('click', open);
  panel.querySelector('#chatX').addEventListener('click', close);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && panel.classList.contains('open')) close(); });

  function el(cls, txt){ var d=document.createElement('div'); d.className='msg '+cls;
    if(txt!=null) d.textContent=txt; body.appendChild(d); body.scrollTop=body.scrollHeight; return d; }
  function bot(t){ return el('bot', t); }
  function me2(t){ return el('me', t); }

  var PII = [/\d{6}\s*[-–]\s*[1-4]\d{6}/, /01[016-9][\s-]?\d{3,4}[\s-]?\d{4}/];
  function hasPII(q){ return PII.some(function(p){ return p.test(q); }); }

  function ask(q){
    q = (q||'').trim(); if(!q || busy) return;
    me2(q); text.value=''; if(chips){ chips.style.display='none'; }
    if(hasPII(q)){ bot("개인정보(주민번호·전화번호)가 들어 있어 답변을 멈췄어요. 개인정보 없이 다시 물어봐 주세요. 🙏"); return; }
    busy = true; sendB.disabled = true;
    var typing = el('bot typing'); typing.innerHTML='<span>●</span><span>●</span><span>●</span>';

    if(!CHAT_API){
      setTimeout(function(){ typing.remove();
        bot("챗봇 답변 기능은 지금 준비 중이에요. 곧 문을 열게요! 🌱\n급하신 점은 02-972-8800으로 전화 주시면 친절히 안내해 드립니다.");
        busy=false; sendB.disabled=false; }, 700);
      return;
    }
    fetch(CHAT_API, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ q: q }) })
      .then(function(r){ return r.json(); })
      .then(function(d){ typing.remove();
        if(d && d.ok && d.answer){ bot(d.answer); }
        else { bot((d && d.error) || "지금은 답변을 드리기 어려워요. 잠시 후 다시 시도하거나 02-972-8800으로 문의해 주세요."); } })
      .catch(function(){ typing.remove();
        bot("연결이 원활하지 않아요. 잠시 후 다시 시도하거나 02-972-8800으로 문의해 주세요."); })
      .then(function(){ busy=false; sendB.disabled=false; text.focus(); });
  }

  form.addEventListener('submit', function(e){ e.preventDefault(); ask(text.value); });
  chips.addEventListener('click', function(e){ var b=e.target.closest('.chip'); if(b) ask(b.textContent); });
})();
