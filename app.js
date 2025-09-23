// ==========================
// File: app.js (관리자 편집/조작 + 휴대폰 회원가입/로그인 + 검색/목록 + N증감 + 삭제 + 손님 탭)
// ==========================
/* global firebase */

// 1) Firebase 설정값 (사용자 제공값)
const firebaseConfig = {
  apiKey: "AIzaSyD9tP0HnP3S8X82NoZXQ5DPwoigoHJ-zfU",
  authDomain: "jumpingmanager-dcd21.firebaseapp.com",
  projectId: "jumpingmanager-dcd21",
  storageBucket: "jumpingmanager-dcd21.firebasestorage.app",
  messagingSenderId: "286929980468",
  appId: "G-4CJN8R3XQ4"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// 2) 유틸/로그/전화번호
const $ = (s)=>document.querySelector(s);
const byId = (id)=>document.getElementById(id);
const toast = (m)=> alert(m);
const ts = ()=> firebase.firestore.FieldValue.serverTimestamp();

// 도메인(점 포함 필수)
const PHONE_DOMAIN = 'phone.local';

// +82 → 0, 숫자만
function canonPhone(s){
  let d = (s||'').replace(/\D/g,'');
  if (d.startsWith('82')) {
    if (d.startsWith('8210')) d = '0' + d.slice(2);
    else d = d.replace(/^82/, '0');
  }
  return d;
}
const isPhoneInput = (s)=> /^\d{9,12}$/.test(canonPhone(s||""));
const toEmailFromPhone = (p)=> `${canonPhone(p)}@${PHONE_DOMAIN}`;

const fmtPhone = (p)=> {
  const s = canonPhone(p);
  if (s.length===11) return `${s.slice(0,3)}-${s.slice(3,7)}-${s.slice(7)}`;
  if (s.length===10) return `${s.slice(0,3)}-${s.slice(3,6)}-${s.slice(6)}`;
  return s||"-";
};
// ✅ 교체: 숫자/객체(하위호환) 모두 지원
const sumPass = (passes, passBatches) => {
  const legacy = Object.values(passes||{}).reduce((acc, v)=>{
    if (typeof v === 'number') return acc + (v||0);
    if (v && typeof v === 'object') return acc + (v.count||0);
    return acc;
  }, 0);
  const batches = Object.values(passBatches||{}).reduce((acc, v)=> acc + (v?.count||0), 0);
  return legacy + batches;
};

// ✅ 기존 유틸 유지(레거시용)
function getPassCount(v){ return typeof v==='number' ? (v||0) : (v?.count||0); }
function setPassCount(oldVal, newCount){
  if (typeof oldVal === 'number' || oldVal == null) return { count: newCount };
  return { ...oldVal, count: newCount };
}
function setPassExpire(oldVal, expireTs){
  if (typeof oldVal === 'number' || oldVal == null) return expireTs ? { count:(oldVal||0), expireAt:expireTs } : { count:(oldVal||0) };
  const next = { ...oldVal }; if (expireTs) next.expireAt = expireTs; else delete next.expireAt; return next;
}
function fmtDate(d){
  try{ const dd = d?.toDate ? d.toDate() : d; const y=dd.getFullYear(), m=String(dd.getMonth()+1).padStart(2,'0'), day=String(dd.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }catch{return '-';}
}
// ✅ 배치용 ID
const newBatchId = ()=> db.collection('_').doc().id;

// ✅ YYYY-MM-DD (로컬) 헬퍼
function ymdLocal(date){
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

// ✅ 만료일 디폴트: 오늘 min, 기본값 = 1년 후
function initPassExpireDefault(){
  const el = document.getElementById('passExpire');
  if (!el) return;
  const today = new Date();
  const oneYear = new Date(today);
  oneYear.setFullYear(oneYear.getFullYear() + 1);

  el.min = ymdLocal(today);              // 오늘 이전 선택 불가
  if (!el.value) el.value = ymdLocal(oneYear); // 값 비었으면 1년 후로 기본값
}




// 디버그 패널(있으면 로그 표시)
(function(){
  const area = ()=> byId('__dbgArea');
  function stamp(){ const d=new Date(); return d.toLocaleString()+'.'+String(d.getMilliseconds()).padStart(3,'0'); }
  function write(kind,...args){
    const el=area(); if(!el) return;
    const line = `[${stamp()}] ${kind}: ` + args.map(a=>{try{return typeof a==='string'?a:JSON.stringify(a);}catch{return String(a);}}).join(' ');
    el.value += (el.value?'\n':'') + line; el.scrollTop = el.scrollHeight;
  }
  const _log=console.log.bind(console), _warn=console.warn.bind(console), _err=console.error.bind(console);
  console.log=(...a)=>{write('LOG',...a);_log(...a);};
  console.warn=(...a)=>{write('WARN',...a);_warn(...a);};
  console.error=(...a)=>{write('ERROR',...a);_err(...a);};
  window.addEventListener('error', e=> write('UNCAUGHT', e?.message||e));
  window.addEventListener('unhandledrejection', e=> write('REJECTION', e?.reason?.message||e?.reason));
})();

// 3) 권한(간단)
const adminEmails = ["01041668764@phone.local"];

// 4) DOM 참조
// 인증/공통
const signedOut = $('#signedOut');
const signedIn  = $('#signedIn');
const whoami    = $('#whoami');
const btnLogin  = $('#btnLogin');
const btnSignup = $('#btnSignup');
const btnLogout = $('#btnLogout');

// 관리자 리스트/검색
const adminPanel = $('#adminPanel');
const adminList  = $('#adminList');
const searchPhone= $('#searchPhone');
const btnSearch  = $('#btnSearch');
const btnLoadAll = $('#btnLoadAll');

// 회원 등록
const regName  = $('#regName');
const regPhone = $('#regPhone');
const regTeam  = $('#regTeam');
const btnRegister = $('#btnRegister');

// 손님 마이페이지 (요약 카드)
const memberSelf = $('#memberSelf');
const selfCard   = $('#selfCard');

const passPresetCustom   = $('#passPresetCustom');
const passPresetWeekday  = $('#passPresetWeekday');

// 상세/조작 패널 (관리자)
const memberSection = $('#memberSection');
const mPhoneTeam = $('#mPhoneTeam');

// === 스테이지 정의/DOM ===
const STAGE_TOTALS = {
  '베이직':21, '이지':21, '노말':19, '하드':17, '챌린저':15,
  '여름':22, '우주':21,
};
const stageOrder = ['베이직','이지','노말','하드','챌린저','여름','우주'];

const stageList      = $('#stageList');        // 관리자 입력용 컨테이너
const btnSaveStages  = $('#btnSaveStages');    // 관리자 저장 버튼

const btnViewStages  = $('#btnViewStages');    // 손님 ‘기록 보기’
const selfStageList  = $('#selfStageList');    // 손님 카드 리스트

const mCar       = $('#mCar');     // 차량번호 표시
const mNote      = $('#mNote');    // 비고 표시
const mStamp = $('#mStamp');;
const mFree  = $('#mFree');
const mFreeWk = $('#mFreeWk');   // 추가
const mFreeSl = $('#mFreeSl');   // 추가
const mPassTotal = $('#mPassTotal');
const stampDots  = $('#stampDots');

const editName = $('#editName');
const editTeam = $('#editTeam');
const editCar  = $('#editCar');     // 차량번호
const editNote = $('#editNote');    // 비고
const btnSaveProfile = $('#btnSaveProfile');

const btnAddVisit   = $('#btnAddVisit');
const btnUseFree    = $('#btnUseFree');
const btnResetStamp = $('#btnResetStamp');

const passName   = $('#passName');
const passCount  = $('#passCount');
const btnAddPass = $('#btnAddPass');
const passSelect = $('#passSelect');
let lastSelectedPass = '';

passSelect?.addEventListener('change', () => {
  lastSelectedPass = passSelect.value || '';
});

const btnUsePass = $('#btnUsePass');
const btnRefundPass = $('#btnRefundPass');
const passPreset10 = $('#passPreset10');
const passPreset20 = $('#passPreset20');

const passList = $('#passList');
const logList  = $('#logList');

// === N개 증감/삭제용 새 요소들 ===
const stampDelta   = $('#stampDelta');
const btnAddStampN = $('#btnAddStampN');
const btnSubStampN = $('#btnSubStampN');

const freeDelta    = $('#freeDelta');
const btnAddFreeN  = $('#btnAddFreeN');
const btnSubFreeN  = $('#btnSubFreeN');

const freeWkDelta   = $('#freeWkDelta');     // 추가
const btnAddFreeWkN = $('#btnAddFreeWkN');   // 추가
const btnSubFreeWkN = $('#btnSubFreeWkN');   // 추가

const freeSlDelta   = $('#freeSlDelta');     // 추가
const btnAddFreeSlN = $('#btnAddFreeSlN');   // 추가
const btnSubFreeSlN = $('#btnSubFreeSlN');   // 추가


const passDelta      = $('#passDelta');
const btnUsePassN    = $('#btnUsePassN');
const btnRefundPassN = $('#btnRefundPassN');
const btnDeletePass  = $('#btnDeletePass');

const btnDeleteMember = $('#btnDeleteMember');

// --- 손님 탭 전환용 ---
const selfTabsBar   = document.querySelector('#memberSelf .tabbar');
const selfTabPanes  = {
  summary: document.getElementById('selfTab-summary'),
  passes : document.getElementById('selfTab-passes'),
  logs   : document.getElementById('selfTab-logs'),
};
const selfPassList  = document.getElementById('selfPassList');
const selfLogList   = document.getElementById('selfLogList');




// === 빠른 회원 등록/수정 ===
btnRegister?.addEventListener('click', async ()=>{
  if(!isAdmin) return toast('운영자 전용 기능입니다.');

  const name  = regName?.value?.trim()  || '';
  const phone = canonPhone(regPhone?.value?.trim() || '');
  const team  = regTeam?.value?.trim()  || '';

  if(!phone) return toast('휴대폰번호(숫자만)를 입력하세요.');

  try{
    const ref = db.collection('members').doc(phone);
    await db.runTransaction(async (tx)=>{
      const snap = await tx.get(ref);
      const base = snap.exists ? (snap.data()||{}) : {
        name:'', phone, team:'', stamp:0,
        freeCredits:0, freeWeekday:0, freeSlush:0,  // 추가
        passes:{}, totalVisits:0, createdAt: ts()
      };
      tx.set(ref, {
        ...base,
        name: name || base.name,
        team: team || base.team,
        updatedAt: ts()
      }, { merge:true });
    });

    // 목록 갱신 및 폼 비우기(선택)
    await loadAllMembers();
    toast('등록/수정 완료');
    // regName.value = ''; regPhone.value=''; regTeam.value='';
  }catch(e){
    console.error('quick-register', e);
    toast('등록/수정 실패: '+(e?.message||e));
  }
});

// 상태
let isAdmin = false;
let currentMemberRef = null; // 현재 편집 중 회원 ref

// 5) 인증 상태
auth.onAuthStateChanged(async(user)=>{
  if(user){
    signedOut?.classList.add('hidden');
    signedIn?.classList.remove('hidden');
    if(whoami) whoami.textContent = user.email || '';

    isAdmin = adminEmails.includes(user.email || '');
    adminPanel?.classList.toggle('hidden', !isAdmin);
    memberSelf?.classList.toggle('hidden', isAdmin);
    // 디버그 버튼/패널: 관리자만 표시
    dbgToggle?.classList.toggle('hidden', !isAdmin);
    dbgPanel ?.classList.add('hidden');   // 열려 있었다면 닫아두기


    // 손님 탭 전환 바인딩(1회)
    selfTabsBar?.addEventListener('click', (e)=>{
      const btn = e.target.closest('.tab');
      if(!btn) return;
      const key = btn.dataset.tab;
      if(!key) return;
      activateSelfTab(key);
    });

    try{
      if(isAdmin){
        await loadAllMembers();
        hideMemberPanel();
        initPassExpireDefault();
      }else{
        await loadSelf(user);
      }
    }catch(e){ console.error('initial', e); }
        // === QR 스캔 처리: ?stamp=휴대폰 ===
    try{
      const params = new URLSearchParams(location.search);
      const phoneFromQR = params.get('stamp');
      if(isAdmin && phoneFromQR){
        await openMember(canonPhone(phoneFromQR));  // 해당 회원 상세 열기

        const nRaw = prompt('적립할 스탬프 개수를 입력하세요', '1');
        const N = parseInt(nRaw||'0', 10);
        if(Number.isFinite(N) && N>0 && currentMemberRef){
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(currentMemberRef);
            const d = snap.data() || {};
            const s0 = d.stamp || 0;
            const total = s0 + N;
            const addFree = Math.floor(total / 10);
            const s1 = total % 10;
            const totalVisits = (d.totalVisits || 0) + N;
            const freeCredits = (d.freeCredits || 0) + addFree;
            tx.update(currentMemberRef, {
              stamp: s1,
              freeCredits,
              totalVisits,
              updatedAt: ts()
            });
          });
          await addLog('stamp_add_n', { n: N, via:'qr' });
          renderMember((await currentMemberRef.get()).data());
          toast(`스탬프 ${N}개 적립 완료`);
        }
        // 파라미터 제거 (새로고침/뒤로가기 시 재실행 방지)
        history.replaceState({}, '', window.location.pathname);
      }
    }catch(e){ console.warn('qr-stamp', e); }

  }else{
    signedOut?.classList.remove('hidden');
    signedIn?.classList.add('hidden');
    adminPanel?.classList.add('hidden');
    memberSelf?.classList.add('hidden');
    // 디버그 버튼/패널 숨김
    dbgToggle?.classList.add('hidden');
    dbgPanel ?.classList.add('hidden');

    hideMemberPanel();
  }
});

// 6) 로그인: 관리자(이메일) / 손님(휴대폰)
btnLogin?.addEventListener("click", async () => {
  const idRaw = byId("loginEmail")?.value?.trim();
  const pass = byId("loginPass")?.value?.trim();
  if (!idRaw || !pass) return toast("아이디(이메일/휴대폰)와 비밀번호를 입력하세요.");

  let emailForAuth = null;
  const looksLikeEmail = idRaw.includes("@");
  const isAdminEmailTyped = adminEmails.includes(idRaw);

  if (looksLikeEmail || isAdminEmailTyped) {
    emailForAuth = idRaw; // 관리자: 이메일 그대로
  } else if (isPhoneInput(idRaw)) {
    emailForAuth = toEmailFromPhone(idRaw); // 손님: 휴대폰 → 내부 이메일
  } else {
    return toast("로그인: 관리자=이메일, 손님=휴대폰번호(숫자만) 입력");
  }

  try {
    await auth.signInWithEmailAndPassword(emailForAuth, pass);
    toast("로그인 성공");
  } catch (e) {
    console.error("login error", e);
    toast("로그인 실패: " + (e?.message || e));
  }
});

// 7) 회원가입: 휴대폰번호 + 비밀번호
btnSignup?.addEventListener("click", async () => {
  const phoneRaw = byId("loginEmail")?.value?.trim();
  const pass = byId("loginPass")?.value?.trim();
  const phone = canonPhone(phoneRaw || "");

  if (!isPhoneInput(phone)) return toast("회원가입: 휴대폰번호(숫자만)를 정확히 입력하세요.");
  if (!pass) return toast("회원가입: 비밀번호를 입력하세요.");

  const email = toEmailFromPhone(phone); // 예: 01012345678@phone.local
  const now = ts();

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    console.log("signup uid", cred.user?.uid);

    // Firestore 문서: members/{phone}
    const ref = db.collection("members").doc(phone);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        tx.set(ref, {
          name: "",
          phone,
          team: "",
          stamp: 0,
          freeCredits: 0,
          freeWeekday: 0,   // 추가
          freeSlush: 0,     // 추가
          passes: {},
          totalVisits: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    toast("회원가입 완료");
  } catch (e) {
    console.error("signup error", e);
    toast("회원가입 실패: " + (e?.message || e));
  }
});

// 8) 로그아웃
btnLogout?.addEventListener('click', async()=>{
  try{ await auth.signOut(); toast('로그아웃'); }catch(e){ console.error('logout',e); }
});

// 9) 관리자: 전체 목록/검색
btnLoadAll?.addEventListener('click', loadAllMembers);
btnSearch?.addEventListener('click', searchMembers);
searchPhone?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') searchMembers(); });

async function loadAllMembers(){
  if(!adminList) return;
  adminList.innerHTML = '<div class="muted">불러오는 중…</div>';
  try{
    let qs;
    try{ qs = await db.collection('members').orderBy('updatedAt','desc').limit(100).get(); }
    catch{ qs = await db.collection('members').orderBy('phone').limit(100).get(); }
    if(qs.empty){ adminList.innerHTML = '<div class="muted">회원 없음</div>'; return; }

    const frag = document.createDocumentFragment();
    qs.forEach(doc=>{
      const d = doc.data() || {};
      const div = document.createElement('div');
      div.className = 'item';
      div.textContent = `${d.name||'-'} · ${fmtPhone(d.phone||'')} · 스탬프:${d.stamp||0}/10 · 무료:${d.freeCredits||0} · 팀:${d.team||'-'}`;
      div.dataset.id = doc.id;
      div.style.cursor = 'pointer';
      div.addEventListener('click', ()=> openMember(doc.id));
      frag.appendChild(div);
    });
    adminList.innerHTML = '';
    adminList.appendChild(frag);
  }catch(e){ console.error('loadAllMembers',e); adminList.innerHTML = '로드 실패: '+e.message; }
}

async function searchMembers(){
  if(!adminList) return;
  const qRaw = (searchPhone?.value||'').trim();
  const q = canonPhone(qRaw);
  if(!q) return loadAllMembers();

  adminList.innerHTML = '<div class="muted">검색 중…</div>';
  try{
    let docs = [];
    if(q.length>=7){
      const snap = await db.collection('members').doc(q).get();
      if(snap.exists) docs=[snap];
      else{
        const qs = await db.collection('members').orderBy('phone').startAt(q).endAt(q+'\uf8ff').limit(50).get();
        docs = qs.docs;
      }
    }else{
      const qs = await db.collection('members').orderBy('phone').limit(500).get();
      docs = qs.docs.filter(d=>(canonPhone(d.data().phone||'')).endsWith(q));
    }

    if(!docs.length){ adminList.innerHTML = '<div class="muted">검색 결과 없음</div>'; return; }
    const frag = document.createDocumentFragment();
    docs.forEach(doc=>{
      const d = doc.data() || {};
      const div = document.createElement('div');
      div.className='item';
      div.textContent = `${d.name||'-'} · ${fmtPhone(d.phone||'')} · 스탬프:${d.stamp||0}/10 · 무료:${d.freeCredits||0} · 팀:${d.team||'-'}`;
      div.dataset.id = doc.id;
      div.style.cursor='pointer';
      div.addEventListener('click', ()=> openMember(doc.id));
      frag.appendChild(div);
    });
    adminList.innerHTML=''; adminList.appendChild(frag);
  }catch(e){ console.error('searchMembers',e); adminList.innerHTML='검색 실패: '+e.message; }
}


function renderStageInputs(stages = {}) {
  if (!stageList) return;
  const frag = document.createDocumentFragment();

  stageOrder.forEach((name) => {
    const total = STAGE_TOTALS[name] || 0;
    const cur = Math.max(0, Math.min(total, parseInt(stages[name] ?? 0, 10)));

    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `
      <span>${name} <span class="muted">/ ${total}</span></span>
      <div class="row">
        <input type="number" class="w110" min="0" max="${total}" step="1"
               value="${cur}" data-stage="${name}" />
      </div>
    `;
    frag.appendChild(row);
  });

  stageList.innerHTML = '';
  stageList.appendChild(frag);
}

function renderSelfStages(d = {}) {
  if (!selfStageList) return;
  const stages = d.stages || {};
  const frag = document.createDocumentFragment();

  stageOrder.forEach((name) => {
    const total = STAGE_TOTALS[name] || 0;
    if (!total) return;
    const cur = Math.max(0, Math.min(total, parseInt(stages[name] ?? 0, 10)));

    const card = document.createElement('div');
    card.className = 'stage-card' + (cur >= total ? ' clear' : '');
    card.innerHTML = `
      <span class="s-name">${name}</span>
      <span class="s-progress">${cur} / ${total}</span>
    `;
    frag.appendChild(card);
  });

  selfStageList.innerHTML = '';
  selfStageList.appendChild(frag);
}


// 10) 회원 상세/렌더/로그
function hideMemberPanel(){ memberSection?.classList.add('hidden'); currentMemberRef=null; }

async function openMember(id){
  const ref = db.collection('members').doc(id);
  const snap = await ref.get();
  if(!snap.exists){ toast('회원 없음'); return; }
  currentMemberRef = ref;
  renderMember(snap.data());
  memberSection?.classList.remove('hidden');
  await loadLogs();
}

function renderMember(d){
  // 0) 방어 & 이전 선택값 백업
  const prevSelected = lastSelectedPass || passSelect?.value || '';

  // 1) 리스트/셀렉트 비우기
  if (passList)  passList.innerHTML = '';
  if (passSelect) passSelect.innerHTML = '';

  if(!d) return;

  // --- 회원 기본정보 ---
  if(mPhoneTeam) mPhoneTeam.textContent = `${fmtPhone(d.phone)} · ${d.team||'-'}`;
  if(mCar)       mCar.textContent  = d.car  || '-';
  if(mNote)      mNote.textContent = d.note || '-';
  if(mStamp)     mStamp.textContent = d.stamp || 0;
  if(mFree)      mFree.textContent  = d.freeCredits || 0;
  if(mFreeWk)    mFreeWk.textContent = d.freeWeekday || 0;
  if(mFreeSl)    mFreeSl.textContent = d.freeSlush || 0;
  if(mPassTotal) mPassTotal.textContent = sumPass(d.passes||{}, d.passBatches||{});

  if(editName) editName.value = d.name || '';
  if(editTeam) editTeam.value = d.team || '';
  if(editCar)  editCar.value  = d.car || '';
  if(editNote) editNote.value = d.note || '';

  // --- 스탬프 점 표시 ---
  if(stampDots){
    stampDots.innerHTML = '';
    for(let i=0;i<10;i++){
      const dot = document.createElement('div');
      dot.className = 'dot' + (i < (d.stamp||0) ? ' on' : '');
      stampDots.appendChild(dot);
    }
  }

  // --- 다회권 (배치 + 레거시) ---
  Object.entries(d.passBatches || {}).forEach(([id,b])=>{
    const cnt = b?.count || 0;
    const exp = b?.expireAt ? fmtDate(b.expireAt) : null;
    const line = exp ? `${b.name} · 잔여 ${cnt} · 만료 ${exp}` : `${b.name} · 잔여 ${cnt}`;

    if(passList){
      const item = document.createElement('div');
      item.className = 'item';
      item.textContent = line + '  [배치]';
      passList.appendChild(item);
    }
    if(passSelect){
      const opt = document.createElement('option');
      opt.value = `batch:${id}`;
      opt.textContent = exp ? `${b.name} (잔 ${cnt}, 만료 ${exp})` : `${b.name} (잔 ${cnt})`;
      passSelect.appendChild(opt);
    }
  });

  Object.entries(d.passes || {}).forEach(([k,v])=>{
    const cnt = getPassCount(v);
    const exp = (v && typeof v==='object' && v.expireAt) ? fmtDate(v.expireAt) : null;
    const line = exp ? `${k} · 잔여 ${cnt} · 만료 ${exp}` : `${k} · 잔여 ${cnt}`;

    if(passList){
      const item = document.createElement('div');
      item.className = 'item';
      item.textContent = line + '  [레거시]';
      passList.appendChild(item);
    }
    if(passSelect){
      const opt = document.createElement('option');
      opt.value = `legacy:${k}`;
      opt.textContent = exp ? `${k} (잔 ${cnt}, 만료 ${exp})` : `${k} (잔 ${cnt})`;
      passSelect.appendChild(opt);
    }
  });

  // --- 선택값 복원 ---
  if (passSelect) {
    const hasPrev = Array.from(passSelect.options).some(o => o.value === prevSelected);
    passSelect.value = hasPrev ? prevSelected : (passSelect.options[0]?.value || '');
    lastSelectedPass = passSelect.value;
  }

  // --- 스테이지 입력 렌더 ---
  renderStageInputs(d.stages || {});
}

async function addLog(type, extra={}){
  if(!currentMemberRef || !logList) return;
  try{
    await currentMemberRef.collection('logs').add({
      type, ...extra, at: ts(), by: auth.currentUser?.uid||null
    });
    await loadLogs();
  }catch(e){ console.error('addLog', e); }
}
async function loadLogs(){
  if(!currentMemberRef || !logList) return;
  const qs = await currentMemberRef.collection('logs').orderBy('at','desc').limit(20).get();
  const frag = document.createDocumentFragment();
  qs.docs.forEach(d=>{
    const v=d.data()||{};
    const div=document.createElement('div');
    div.className='item';
    const when = v.at?.toDate?.()?.toLocaleString?.() || '';
    div.textContent = `${(v.type||'').toUpperCase()} · ${when}`;
    frag.appendChild(div);
  });
  logList.innerHTML='';
  logList.appendChild(frag);
}


btnSaveStages?.addEventListener('click', async () => {
  if (!isAdmin) return toast('운영자 전용');
  if (!currentMemberRef) return toast('회원을 먼저 선택');

  try {
    const inputs = stageList?.querySelectorAll('input[data-stage]') || [];
    const stages = {};
    inputs.forEach((el) => {
      const name = el.dataset.stage;
      const total = STAGE_TOTALS[name] || 0;
      let val = parseInt(el.value || '0', 10);
      if (!Number.isFinite(val) || val < 0) val = 0;
      if (val > total) val = total;
      stages[name] = val;
    });

    await currentMemberRef.update({ stages, updatedAt: ts() });
    await addLog('stages_save', { stages });
    renderMember((await currentMemberRef.get()).data());
    toast('스테이지 저장 완료');
  } catch (e) {
    console.error('save stages', e);
    toast('저장 실패: ' + (e?.message || e));
  }
});


// 11) 프로필 저장(이름/팀명)
btnSaveProfile?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용');
  if(!currentMemberRef) return toast('회원을 먼저 선택');
   const name = editName?.value?.trim() || '';
   const team = editTeam?.value?.trim() || '';
   const car  = editCar?.value?.trim()  || '';
   const note = editNote?.value?.trim() || '';
   try{
     await currentMemberRef.update({ name, team, car, note, updatedAt: ts() });
    await addLog('profile_save', {name, team});
    const d = (await currentMemberRef.get()).data();
    renderMember(d);
    toast('저장 완료');
  }catch(e){ console.error('saveProfile',e); toast('저장 실패: '+e.message); }
});

// 12) 스탬프/무료권 (기존 +1 / -1 성격)
btnAddVisit?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  try{
    await db.runTransaction(async(tx)=>{
      const snap=await tx.get(currentMemberRef);
      const d=snap.data()||{};
      let stamp=(d.stamp||0)+1;
      let free =(d.freeCredits||0);
      let total=(d.totalVisits||0)+1;
      if(stamp>=10){ stamp=0; free+=1; }
      tx.update(currentMemberRef, { stamp, freeCredits:free, totalVisits:total, updatedAt: ts() });
    });
    await addLog('visit');
    const d=(await currentMemberRef.get()).data(); renderMember(d);
  }catch(e){ console.error('addVisit',e); toast('실패: '+e.message); }
});
btnUseFree?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  try{
    await db.runTransaction(async(tx)=>{
      const snap=await tx.get(currentMemberRef);
      const d=snap.data()||{};
      const free=Math.max(0,(d.freeCredits||0)-1);
      tx.update(currentMemberRef, { freeCredits: free, updatedAt: ts() });
    });
    await addLog('free_use');
    const d=(await currentMemberRef.get()).data(); renderMember(d);
  }catch(e){ console.error('useFree',e); toast('실패: '+e.message); }
});
btnResetStamp?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  if(!confirm('스탬프를 0으로 초기화할까요?')) return;
  try{
    await currentMemberRef.update({ stamp:0, updatedAt: ts() });
    await addLog('stamp_reset');
    const d=(await currentMemberRef.get()).data(); renderMember(d);
  }catch(e){ console.error('resetStamp',e); toast('실패: '+e.message); }
});
function ensureExpireDefaultIfEmpty(){
  const el = document.getElementById('passExpire');
  if (!el || el.value) return;
  const d = new Date(); d.setFullYear(d.getFullYear()+1);
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  el.value = `${y}-${m}-${day}`;
}

passPresetCustom?.addEventListener('click', ()=>{
  if(passName&&passCount){
    passName.value='다회권'; passCount.value='1';
    ensureExpireDefaultIfEmpty();
  }
});

passPresetWeekday?.addEventListener('click', ()=>{
  if(passName&&passCount){
    passName.value='평일무료권'; passCount.value='1';
    ensureExpireDefaultIfEmpty();
  }
});
// 13) 다회권 (기존 +/-1)
passPreset10?.addEventListener('click', ()=>{ if(passName&&passCount){ passName.value='10회권'; passCount.value='10'; }});
passPreset20?.addEventListener('click', ()=>{ if(passName&&passCount){ passName.value='20회권'; passCount.value='20'; }});

btnAddPass?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용'); 
  if(!currentMemberRef) return toast('회원을 먼저 선택');

  const rawName = (passName?.value || '').trim();
  const cnt = parseInt(passCount?.value || '1', 10);
  const expireStr = document.getElementById('passExpire')?.value || '';
  if(!rawName || !(cnt > 0)) return toast('권종/수량 확인');

  // 이름 정규화(공백 제거 기준)
  const name = rawName.replace(/\s+/g, '');

  // 분기: 평일무료권 / 무료권 / 그 외(다회권·10회권·20회권·기타)
  const isWeekdayFree = (name === '평일무료권');
  const isFree = (!isWeekdayFree && name === '무료권');
  const isMulti = (name === '다회권' || name === '10회권' || name === '20회권');

  try{
    await db.runTransaction(async(tx)=>{
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};

      if (isWeekdayFree) {
        // ✅ 평일무료권 카운트만 증가
        const cur = d.freeWeekday || 0;
        tx.update(currentMemberRef, { 
          freeWeekday: cur + cnt, 
          updatedAt: ts() 
        });
      } else if (isFree) {
        // ✅ 무료권 카운트만 증가
        const cur = d.freeCredits || 0;
        tx.update(currentMemberRef, { 
          freeCredits: cur + cnt, 
          updatedAt: ts() 
        });
      } else if (isMulti) {
        // ✅ 다회권/10회권/20회권 → 새 배치 추가
        const passBatches = { ...(d.passBatches || {}) };
        const id = newBatchId();
        const batch = { name: rawName, count: cnt };
        if (expireStr){
          const dt = new Date(expireStr + 'T23:59:59');
          batch.expireAt = firebase.firestore.Timestamp.fromDate(dt);
        }
        passBatches[id] = batch;
        tx.update(currentMemberRef, { passBatches, updatedAt: ts() });
      } else {
        // ✅ 그 외 이름도 배치로 추가 (기존 동작 유지)
        const passBatches = { ...(d.passBatches || {}) };
        const id = newBatchId();
        const batch = { name: rawName, count: cnt };
        if (expireStr){
          const dt = new Date(expireStr + 'T23:59:59');
          batch.expireAt = firebase.firestore.Timestamp.fromDate(dt);
        }
        passBatches[id] = batch;
        tx.update(currentMemberRef, { passBatches, updatedAt: ts() });
      }
    });

    // 로그 구분
    if (isWeekdayFree) {
      await addLog('free_weekday_add_n', { n: cnt, via: 'pass_add' });
    } else if (isFree) {
      await addLog('free_add_n', { n: cnt, via: 'pass_add' });
    } else {
      await addLog('pass_add_batch', { name: rawName, cnt, expire: expireStr || null });
    }

    // 입력값 초기화
    if(passName) passName.value = '';
    if(passCount) passCount.value = '1';
    const pe = document.getElementById('passExpire'); 
    if (pe) pe.value = '';

    // 리렌더
    renderMember((await currentMemberRef.get()).data());
    toast('처리 완료');
  }catch(e){
    console.error('addPass', e);
    toast('실패: ' + (e?.message || e));
  }
});



// 다회권 -1
btnUsePass?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용');
  if(!currentMemberRef) return toast('회원을 먼저 선택');

  const sel = parseSelectedPassKey(); if(!sel) return;

  try{
    await db.runTransaction(async(tx)=>{
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};
      const nowMs = firebase.firestore.Timestamp.now().toMillis();

      if(sel.kind === 'batch'){
        const passBatches = { ...(d.passBatches || {}) };
        const b = passBatches[sel.key];
        if(!b) throw new Error('선택한 배치를 찾을 수 없습니다.');
        if (b.expireAt && b.expireAt.toMillis() < nowMs) throw new Error('만료된 배치입니다.');
        if((b.count || 0) <= 0) throw new Error('잔여 없음');

        passBatches[sel.key] = { ...b, count: (b.count || 0) - 1 };
        tx.update(currentMemberRef, { passBatches, updatedAt: ts() });

      } else { // legacy
        const passes = { ...(d.passes || {}) };
        const prev = passes[sel.key];
        if (prev && typeof prev === 'object' && prev.expireAt && prev.expireAt.toMillis() < nowMs) {
          throw new Error('만료된 권종입니다.');
        }
        const cur = getPassCount(prev);
        if(cur <= 0) throw new Error('잔여 없음');

        passes[sel.key] = setPassCount(prev, cur - 1);
        tx.update(currentMemberRef, { passes, updatedAt: ts() });
      }
    });

    await addLog('pass_use', { where: sel.kind, key: sel.key, cnt: 1 });
    renderMember((await currentMemberRef.get()).data());
  }catch(e){
    console.error('usePass -1', e);
    toast('실패: ' + (e?.message || e));
  }
});



btnRefundPass?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용');
  if(!currentMemberRef) return toast('회원을 먼저 선택');

  const sel = parseSelectedPassKey(); if(!sel) return;   // ← 파싱 필수

  try{
    await db.runTransaction(async(tx)=>{
      const snap=await tx.get(currentMemberRef);
      const d=snap.data()||{};

      if (sel.kind === 'batch') {
        const passBatches = { ...(d.passBatches||{}) };
        const b = passBatches[sel.key];
        if(!b) throw new Error('배치를 찾을 수 없습니다.');
        passBatches[sel.key] = { ...b, count:(b.count||0)+1 };
        tx.update(currentMemberRef, { passBatches, updatedAt: ts() });
      } else {
        const passes = { ...(d.passes||{}) };
        passes[sel.key] = setPassCount(passes[sel.key], getPassCount(passes[sel.key]) + 1);
        tx.update(currentMemberRef, { passes, updatedAt: ts() });
      }
    });
    await addLog('pass_refund', { where: sel.kind, key: sel.key, cnt:1 });
    renderMember((await currentMemberRef.get()).data());
  }catch(e){ console.error('refundPass',e); toast('실패: '+(e?.message||e)); }
});


// 14) === N개 증감 & 권종 삭제 & 회원 삭제 ===
function parsePosInt(el, def = 1) {
  const n = parseInt(el?.value ?? def, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}
function parseSelectedPassKey(){
  const raw = passSelect?.value || '';
  if (!raw) { toast('권종을 선택하세요'); return null; }
  const i = raw.indexOf(':');
  if (i < 0) { toast('권종 선택값이 올바르지 않습니다'); return null; }
  const kind = raw.slice(0, i);
  const key  = raw.slice(i + 1);
  if (!kind || !key) { toast('권종 선택값이 올바르지 않습니다'); return null; }
  return { kind, key };
}




// 스탬프 +N (10마다 무료권 자동 적립)
btnAddStampN?.addEventListener('click', async () => {
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const N = parsePosInt(stampDelta, 1);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};
      const s0 = d.stamp || 0;
      const total = s0 + N;
      const addFree = Math.floor(total / 10);
      const s1 = total % 10;
      const totalVisits = (d.totalVisits || 0) + N;
      const freeCredits = (d.freeCredits || 0) + addFree;
      tx.update(currentMemberRef, { stamp: s1, freeCredits, totalVisits, updatedAt: ts() });
    });
    await addLog('stamp_add_n', { n: N });
    renderMember((await currentMemberRef.get()).data());
  } catch (e) { console.error('stamp +N', e); toast('실패: ' + e.message); }
});

// 스탬프 -N (무료권 변화 없음)
btnSubStampN?.addEventListener('click', async () => {
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const N = parsePosInt(stampDelta, 1);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};
      const s0 = d.stamp || 0;
      const s1 = Math.max(0, s0 - N);
      tx.update(currentMemberRef, { stamp: s1, updatedAt: ts() });
    });
    await addLog('stamp_sub_n', { n: N });
    renderMember((await currentMemberRef.get()).data());
  } catch (e) { console.error('stamp -N', e); toast('실패: ' + e.message); }
});

// 무료권 +N / -N
btnAddFreeN?.addEventListener('click', async () => {
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const N = parsePosInt(freeDelta, 1);
  try {
    await currentMemberRef.update({ freeCredits: firebase.firestore.FieldValue.increment(N), updatedAt: ts() });
    await addLog('free_add_n', { n: N });
    renderMember((await currentMemberRef.get()).data());
  } catch (e) { console.error('free +N', e); toast('실패: ' + e.message); }
});
btnSubFreeN?.addEventListener('click', async () => {
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const N = parsePosInt(freeDelta, 1);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};
      const cur = d.freeCredits || 0;
      const next = Math.max(0, cur - N);
      tx.update(currentMemberRef, { freeCredits: next, updatedAt: ts() });
    });
    await addLog('free_sub_n', { n: N });
    renderMember((await currentMemberRef.get()).data());
  } catch (e) { console.error('free -N', e); toast('실패: ' + e.message); }
});

// 다회권 -N
btnUsePassN?.addEventListener('click', async () => {
  if(!isAdmin) return toast('운영자 전용');
  if(!currentMemberRef) return toast('회원을 먼저 선택');

  const sel = parseSelectedPassKey(); if(!sel) return;

  const N = parsePosInt(passDelta, 1);
  if(!(N > 0)) return toast('수량(N)을 확인하세요.');

  try{
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};
      const nowMs = firebase.firestore.Timestamp.now().toMillis();

      if (sel.kind === 'batch') {
        const passBatches = { ...(d.passBatches || {}) };
        const b = passBatches[sel.key];
        if (!b) throw new Error('선택한 배치를 찾을 수 없습니다.');
        if (b.expireAt && b.expireAt.toMillis() < nowMs) throw new Error('만료된 배치입니다.');

        const cur = b.count || 0;
        if (cur < N) throw new Error('잔여 수량이 부족합니다.');
        passBatches[sel.key] = { ...b, count: cur - N };

        tx.update(currentMemberRef, { passBatches, updatedAt: ts() });

      } else { // legacy
        const passes = { ...(d.passes || {}) };
        const prev = passes[sel.key];
        if (prev && typeof prev === 'object' && prev.expireAt && prev.expireAt.toMillis() < nowMs) {
          throw new Error('만료된 권종입니다.');
        }

        const cur = getPassCount(prev);
        if (cur < N) throw new Error('잔여 수량이 부족합니다.');

        passes[sel.key] = setPassCount(prev, cur - N);
        tx.update(currentMemberRef, { passes, updatedAt: ts() });
      }
    });

    await addLog('pass_use_n', { where: sel.kind, key: sel.key, n: N });
    renderMember((await currentMemberRef.get()).data());

  } catch (e) {
    console.error('usePass -N', e);
    toast('실패: ' + (e?.message || e));
  }
});



// 다회권 +N
btnRefundPassN?.addEventListener('click', async () => {
  if(!isAdmin) return toast('운영자 전용');
  if(!currentMemberRef) return toast('회원을 먼저 선택');

  const sel = parseSelectedPassKey(); // "batch:<id>" 또는 "legacy:<name>"
  if(!sel) return;

  const N = parsePosInt(passDelta, 1);
  if (!(N > 0)) return toast('수량(N)을 확인하세요.');

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};

      if (sel.kind === 'batch') {
        // ✅ 배치 +N
        const passBatches = { ...(d.passBatches || {}) };
        const b = passBatches[sel.key];
        if (!b) throw new Error('배치를 찾을 수 없습니다.');
        passBatches[sel.key] = { ...b, count: (b.count || 0) + N };
        tx.update(currentMemberRef, { passBatches, updatedAt: ts() });

      } else {
        // ✅ 레거시 +N
        const passes = { ...(d.passes || {}) };
        passes[sel.key] = setPassCount(passes[sel.key], getPassCount(passes[sel.key]) + N);
        tx.update(currentMemberRef, { passes, updatedAt: ts() });
      }
    });

    await addLog('pass_add_n', { where: sel.kind, key: sel.key, n: N });
    renderMember((await currentMemberRef.get()).data());

  } catch (e) {
    console.error('pass +N', e);
    toast('실패: ' + (e?.message || e));
  }
});


// 권종 삭제(키 자체 제거)
btnDeletePass?.addEventListener('click', async () => {
  if (!isAdmin) return toast('운영자 전용');
  if (!currentMemberRef) return toast('회원을 먼저 선택');

  const sel = parseSelectedPassKey(); // { kind: 'batch'|'legacy', key: string }
  if (!sel) return;

  // 보기 좋은 확인문구 (선택 옵션 표시 텍스트 사용)
  const label = passSelect?.selectedOptions?.[0]?.textContent?.trim() || sel.key;
  if (!confirm(`'${label}' 를 삭제할까요? (잔여 수량과 함께 사라집니다)`)) return;

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};

      if (sel.kind === 'batch') {
        const passBatches = { ...(d.passBatches || {}) };
        if (!passBatches[sel.key]) throw new Error('배치를 찾을 수 없습니다.');
        delete passBatches[sel.key];
        tx.update(currentMemberRef, { passBatches, updatedAt: ts() });

      } else {
        const passes = { ...(d.passes || {}) };
        if (!(sel.key in passes)) throw new Error('권종을 찾을 수 없습니다.');
        delete passes[sel.key];
        tx.update(currentMemberRef, { passes, updatedAt: ts() });
      }
    });

    await addLog('pass_delete', { where: sel.kind, key: sel.key });
    renderMember((await currentMemberRef.get()).data());
  } catch (e) {
    console.error('pass delete', e);
    toast('실패: ' + (e?.message || e));
  }
});


// 회원 삭제 (문서만 삭제; logs 서브컬렉션은 유지)
btnDeleteMember?.addEventListener('click', async () => {
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const id = currentMemberRef.id;
  if(!confirm(`회원(${id})을 삭제할까요? (로그 서브컬렉션은 유지)`)) return;
  try {
    await currentMemberRef.delete();
    hideMemberPanel();
    await loadAllMembers();
    toast('회원 삭제 완료');
  } catch (e) { console.error('delete member', e); toast('삭제 실패: ' + e.message); }
});
// 평일무료권 +N
btnAddFreeWkN?.addEventListener('click', async ()=>{
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const N = parsePosInt(freeWkDelta, 1);
  try{
    await currentMemberRef.update({ freeWeekday: firebase.firestore.FieldValue.increment(N), updatedAt: ts() });
    await addLog('free_weekday_add_n', { n:N });
    renderMember((await currentMemberRef.get()).data());
  }catch(e){ console.error('freeWeekday +N',e); toast('실패: '+e.message); }
});

// 평일무료권 -N
btnSubFreeWkN?.addEventListener('click', async ()=>{
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const N = parsePosInt(freeWkDelta, 1);
  try{
    await db.runTransaction(async(tx)=>{
      const snap = await tx.get(currentMemberRef);
      const d = snap.data()||{};
      const next = Math.max(0, (d.freeWeekday||0) - N);
      tx.update(currentMemberRef, { freeWeekday: next, updatedAt: ts() });
    });
    await addLog('free_weekday_sub_n', { n:N });
    renderMember((await currentMemberRef.get()).data());
  }catch(e){ console.error('freeWeekday -N',e); toast('실패: '+e.message); }
});

// 슬러시 무료권 +N
btnAddFreeSlN?.addEventListener('click', async ()=>{
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const N = parsePosInt(freeSlDelta, 1);
  try{
    await currentMemberRef.update({ freeSlush: firebase.firestore.FieldValue.increment(N), updatedAt: ts() });
    await addLog('free_slush_add_n', { n:N });
    renderMember((await currentMemberRef.get()).data());
  }catch(e){ console.error('freeSlush +N',e); toast('실패: '+e.message); }
});

// 슬러시 무료권 -N
btnSubFreeSlN?.addEventListener('click', async ()=>{
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const N = parsePosInt(freeSlDelta, 1);
  try{
    await db.runTransaction(async(tx)=>{
      const snap = await tx.get(currentMemberRef);
      const d = snap.data()||{};
      const next = Math.max(0, (d.freeSlush||0) - N);
      tx.update(currentMemberRef, { freeSlush: next, updatedAt: ts() });
    });
    await addLog('free_slush_sub_n', { n:N });
    renderMember((await currentMemberRef.get()).data());
  }catch(e){ console.error('freeSlush -N',e); toast('실패: '+e.message); }
});

// 15) 손님 탭 전환 & 마이페이지 로딩
function activateSelfTab(key){
  // 탭 버튼 on/off
  selfTabsBar?.querySelectorAll('.tab').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.tab === key);
  });
  // 패널 show/hide
  Object.entries(selfTabPanes).forEach(([k,el])=>{
    el?.classList.toggle('active', k === key);
  });
}

async function loadSelf(user){
  // 기본 탭: 요약
  activateSelfTab('summary');

  const cardEl = document.getElementById('selfCard');
  if(!cardEl) return;
  
  cardEl.innerHTML = '<div class="muted">불러오는 중…</div>';

  try{
    const email = user?.email || '';
    const m = email.match(/^(\d{9,12})@phone\.local$/);
    const phone = m ? m[1] : email.replace(/@.*/, '');

    // 내 기본 정보
    let snap = await db.collection('members').doc(phone).get();
    if(!snap.exists) snap = await db.collection('members').doc(email).get();
    if(!snap.exists){
      cardEl.innerHTML = '<div class="muted">회원 정보 없음</div>';
      if(selfPassList) selfPassList.innerHTML = '';
      if(selfLogList)  selfLogList.innerHTML  = '';
      return;
    }
    const d = snap.data() || {};

// 요약 박스 + 도장 격자(2행×5열)
    cardEl.innerHTML = `
      <div class="summary-box">
        <div class="summary-row top">
          <div class="summary-title">${d.name || '-'}</div>
          <div class="summary-badge">⭐ 스탬프 ${d.stamp || 0}/10</div>
        </div>
        <div class="summary-row mid muted">
          ${fmtPhone(d.phone)} · ${d.team || '-'}
        </div>
        <div class="summary-row bottom perks">
          🎁 무료 <b>${d.freeCredits||0}</b>　
          🏖️ 평일 <b>${d.freeWeekday||0}</b>　
          🧊 슬러시 <b>${d.freeSlush||0}</b>
        </div>
      </div>
    
      <div id="selfStampGrid" class="stamp-grid"></div>
    
    <p class="stamp-note muted">스탬프 10개를 찍으면 무료 1회 제공!</p>
  `;
    // === 여기 뒤에 QR 코드 생성 추가 ===
    const qrTarget = document.getElementById('selfBigQR');
    if(qrTarget){
      qrTarget.innerHTML = '';
      const stampURL = `${window.location.origin}${window.location.pathname}?stamp=${encodeURIComponent(phone)}`;
      
      new QRCode(qrTarget, {
        text: stampURL,       // ← 절대 URL을 QR에 넣기
        width: 120,
        height: 120,
        colorDark: "#000000",
        colorLight: "#ffffff"
      });

    }

// 팽귄 도장 격자 (2행×5열)
    const grid = document.getElementById('selfStampGrid');
    if(grid){
      grid.innerHTML = '';
      const stampCount = d.stamp || 0;
      // 프로젝트 루트에 penguin.png 를 넣어주세요 (경로 바꾸면 아래도 같이)
      const imgURL = './penguin.png';   // 루트 같

      for(let i=0;i<10;i++){
        const cell = document.createElement('div');
        cell.className = 'stamp-slot' + (i < stampCount ? ' filled' : ' empty');
        if(i < stampCount){
          // 채워진 칸: 팽귄 얼굴
          cell.style.setProperty('--stamp-url', `url("${imgURL}")`);
        }
        grid.appendChild(cell);
      }
    }


    // 다회권 목록
// 다회권 목록 (배치 + 레거시 모두 표기)
if (selfPassList) {
  const frag = document.createDocumentFragment();
  const items = [];

  // 1) 배치형
  Object.entries(d.passBatches || {}).forEach(([id, b]) => {
    const cnt = b?.count || 0;
    const exp = b?.expireAt ? fmtDate(b.expireAt) : null;
    items.push({
      kind: 'batch',
      name: b?.name || '(이름없음)',
      count: cnt,
      expire: exp
    });
  });

  // 2) 레거시형
  Object.entries(d.passes || {}).forEach(([k, v]) => {
    const cnt = getPassCount(v);
    const exp = (v && typeof v === 'object' && v.expireAt) ? fmtDate(v.expireAt) : null;
    items.push({
      kind: 'legacy',
      name: k,
      count: cnt,
      expire: exp
    });
  });

  if (items.length === 0) {
    selfPassList.innerHTML = '<div class="muted">보유한 다회권이 없습니다</div>';
  } else {
    // (선택) 만료 임박순 정렬: 만료 있는 것 먼저, 날짜 빠른 순
    items.sort((a, b) => {
      const ax = a.expire ? 0 : 1;
      const bx = b.expire ? 0 : 1;
      if (ax !== bx) return ax - bx;
      if (!a.expire || !b.expire) return 0;
      return a.expire.localeCompare(b.expire);
    });

    items.forEach(({ name, count, expire }) => {
      const row = document.createElement('div');
      row.className = 'pass-card';
      row.innerHTML = `
        <span class="p-name">🎫 ${name}${expire ? ` <span class="muted" style="font-weight:700;font-size:12px;">· 만료 ${expire}</span>` : ''}</span>
        <span class="p-count">${count}</span>
      `;
      frag.appendChild(row);
    });
    selfPassList.innerHTML = '';
    selfPassList.appendChild(frag);
  }
}




    // 손님 화면: 스테이지 기록 보기
    const btnView = byId('btnViewStages');
    if (btnView) {
      btnView.onclick = async () => {
        try {
          const snap = await db.collection('members').doc(phone).get();
          renderSelfStages(snap.data() || {});   // 스테이지 기록 렌더링
        } catch (e) {
          console.error('view stages', e);
          selfStageList.innerHTML = '<div class="muted">기록을 불러올 수 없습니다</div>';
        }
      };
    }


  }catch(e){
    console.error('loadSelf', e);
    cardEl.innerHTML = '로드 실패: '+e.message;
    if(selfPassList) selfPassList.innerHTML = '';
    if(selfLogList)  selfLogList.innerHTML  = '';
  }
}

console.log('app.js loaded: admin edit + visits + passes + logs + N-delta + deletions + self tabs');
// === 디버그 패널 토글/복사/지우기 ===
const dbgToggle = byId('__dbgToggle');
const dbgPanel  = byId('__dbgPanel');
const dbgClose  = byId('__dbgClose');
const dbgCopy   = byId('__dbgCopy');
const dbgClear  = byId('__dbgClear');
const dbgArea   = byId('__dbgArea');

dbgToggle?.addEventListener('click', ()=> dbgPanel?.classList.toggle('hidden'));
dbgClose ?.addEventListener('click', ()=> dbgPanel?.classList.add('hidden'));
dbgCopy  ?.addEventListener('click', async ()=>{
  try{
    await navigator.clipboard.writeText(dbgArea?.value || '');
    toast('디버그 로그를 클립보드에 복사했습니다.');
  }catch(e){ console.error('dbg copy',e); toast('복사 실패'); }
});
dbgClear ?.addEventListener('click', ()=>{
  if(dbgArea) dbgArea.value='';
});
