// ==========================
// File: app.js (관리자 편집/조작 포함 풀버전)
// ==========================
/* global firebase */

// 1) Firebase 설정값
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

// 2) 유틸/로그
const $ = (s)=>document.querySelector(s);
const byId = (id)=>document.getElementById(id);
const toast = (m)=> alert(m);
// 🔧 휴대폰 → 내부 이메일 변환 설정 (도메인에 점이 있어야 함)
const PHONE_DOMAIN = 'phone.local'; // 예: phone.local, app.internal 등

// 🔧 휴대폰 정규화(+82 → 0, 숫자만)
function canonPhone(s){
  let d = (s||'').replace(/\D/g,'');      // 숫자만
  if (d.startsWith('82')) {               // +82 / 82로 시작하면 국내형으로 변환
    if (d.startsWith('8210')) d = '0' + d.slice(2); // 8210xxxx → 010xxxx
    else d = d.replace(/^82/, '0');       // 그 외 82 → 0
  }
  return d;
}

const isPhoneInput = (s)=> /^\d{9,12}$/.test(canonPhone(s||""));
const toEmailFromPhone = (p)=> `${canonPhone(p)}@${PHONE_DOMAIN}`;


const fmtPhone = (p)=> {
  const s = normPhone(p);
  if (s.length===11) return `${s.slice(0,3)}-${s.slice(3,7)}-${s.slice(7)}`;
  if (s.length===10) return `${s.slice(0,3)}-${s.slice(3,6)}-${s.slice(6)}`;
  return s||"-";
};
const sumPass = (passes)=> Object.values(passes||{}).reduce((a,b)=>a+(b||0),0);
const ts = ()=> firebase.firestore.FieldValue.serverTimestamp();

// 디버그 패널 연동(있으면 로그 노출)
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

// 3) 권한(간단 버전)
const adminEmails = ["chosungmook@naver.com"];

// 4) DOM 참조
// 인증
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
// 회원 등록(간단 등록 UI가 있다면)
const regName  = $('#regName');
const regPhone = $('#regPhone');
const regTeam  = $('#regTeam');
const btnRegister = $('#btnRegister');
// 손님 마이페이지
const memberSelf = $('#memberSelf');
const selfCard   = $('#selfCard');

// 상세/조작 패널
const memberSection = $('#memberSection');
const mPhoneTeam = $('#mPhoneTeam');
const mStamp = $('#mStamp');
const mFree  = $('#mFree');
const mPassTotal = $('#mPassTotal');
const stampDots  = $('#stampDots');

const editName = $('#editName');
const editTeam = $('#editTeam');
const btnSaveProfile = $('#btnSaveProfile');

const btnAddVisit   = $('#btnAddVisit');
const btnUseFree    = $('#btnUseFree');
const btnResetStamp = $('#btnResetStamp');

const passName   = $('#passName');
const passCount  = $('#passCount');
const btnAddPass = $('#btnAddPass');
const passSelect = $('#passSelect');
const btnUsePass = $('#btnUsePass');
const btnRefundPass = $('#btnRefundPass');
const passPreset10 = $('#passPreset10');
const passPreset20 = $('#passPreset20');
const passPreset30 = $('#passPreset30');

const passList = $('#passList');
const logList  = $('#logList');

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

    try{
      if(isAdmin){
        await loadAllMembers();    // 관리자: 기본 전체 목록
        hideMemberPanel();         // 시작 시 패널 닫힘
      }else{
        await loadSelf(user);      // 손님: 마이페이지
      }
    }catch(e){ console.error('initial', e); }
  }else{
    signedOut?.classList.remove('hidden');
    signedIn?.classList.add('hidden');
    adminPanel?.classList.add('hidden');
    memberSelf?.classList.add('hidden');
    hideMemberPanel();
  }
});

// 로그인: 관리자(이메일) / 손님(휴대폰) 지원
btnLogin?.addEventListener("click", async () => {
  const idRaw = byId("loginEmail")?.value?.trim();
  const pass = byId("loginPass")?.value?.trim();
  if (!idRaw || !pass) return toast("아이디(이메일/휴대폰)와 비밀번호를 입력하세요.");

  let emailForAuth = null;

  const looksLikeEmail = idRaw.includes("@");
  const isAdminEmailTyped = adminEmails.includes(idRaw);

  if (looksLikeEmail || isAdminEmailTyped) {
    // 관리자: 이메일 그대로 사용
    emailForAuth = idRaw;
  } else if (isPhoneInput(idRaw)) {
    // 손님: 휴대폰 → 내부 이메일로
    emailForAuth = toEmailFromPhone(idRaw);
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



// 회원가입: 휴대폰번호 + 비밀번호
btnSignup?.addEventListener("click", async () => {
  const phoneRaw = byId("loginEmail")?.value?.trim();
  const pass = byId("loginPass")?.value?.trim();
  const phone = canonPhone(phoneRaw || "");

  if (!isPhoneInput(phone)) return toast("회원가입: 휴대폰번호(숫자만)를 정확히 입력하세요.");
  if (!pass) return toast("회원가입: 비밀번호를 입력하세요.");

  const email = toEmailFromPhone(phone); // 예: 01012345678@phone.local
  const now = firebase.firestore.FieldValue.serverTimestamp();

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



btnLogout?.addEventListener('click', async()=>{ try{ await auth.signOut(); toast('로그아웃'); }catch(e){ console.error('logout',e); }});

// 7) 관리자: 전체 목록/검색
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
      div.textContent = `${d.name||'-'} · ${d.phone||''} · 스탬프:${d.stamp||0}/10 · 무료:${d.freeCredits||0}`;
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
  const q = qRaw.replace(/\D/g,'');
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
      docs = qs.docs.filter(d=>(d.data().phone||'').endsWith(q));
    }

    if(!docs.length){ adminList.innerHTML = '<div class="muted">검색 결과 없음</div>'; return; }
    const frag = document.createDocumentFragment();
    docs.forEach(doc=>{
      const d = doc.data() || {};
      const div = document.createElement('div');
      div.className='item';
      div.textContent = `${d.name||'-'} · ${d.phone||''} · 스탬프:${d.stamp||0}/10 · 무료:${d.freeCredits||0}`;
      div.dataset.id = doc.id;
      div.style.cursor='pointer';
      div.addEventListener('click', ()=> openMember(doc.id));
      frag.appendChild(div);
    });
    adminList.innerHTML=''; adminList.appendChild(frag);
  }catch(e){ console.error('searchMembers',e); adminList.innerHTML='검색 실패: '+e.message; }
}

// 8) 회원 상세 열기/렌더/로그
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
  if(!d) return;
  if(mPhoneTeam) mPhoneTeam.textContent = `${fmtPhone(d.phone)} · ${d.team||'-'}`;
  if(mStamp)     mStamp.textContent = d.stamp || 0;
  if(mFree)      mFree.textContent  = d.freeCredits || 0;
  if(mPassTotal) mPassTotal.textContent = sumPass(d.passes||{});

  if(editName) editName.value = d.name || '';
  if(editTeam) editTeam.value = d.team || '';

  if(stampDots){
    stampDots.innerHTML = '';
    for(let i=0;i<10;i++){
      const dot = document.createElement('div');
      dot.className = 'dot' + (i < (d.stamp||0) ? ' on' : '');
      stampDots.appendChild(dot);
    }
  }

  // 다회권 목록/선택
  if(passList)  passList.innerHTML='';
  if(passSelect){ passSelect.innerHTML=''; }
  Object.entries(d.passes||{}).forEach(([k,v])=>{
    if(passList){
      const item = document.createElement('div');
      item.className='item'; item.textContent=`${k} · 잔여 ${v}`;
      passList.appendChild(item);
    }
    if(passSelect){
      const opt = document.createElement('option');
      opt.value=k; opt.textContent=`${k} (잔 ${v})`;
      passSelect.appendChild(opt);
    }
  });
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

// 9) 프로필 저장(이름/팀명)
btnSaveProfile?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용');
  if(!currentMemberRef) return toast('회원을 먼저 선택');
  const name = editName?.value?.trim() || '';
  const team = editTeam?.value?.trim() || '';
  try{
    await currentMemberRef.update({ name, team, updatedAt: ts() });
    await addLog('profile_save', {name, team});
    const d = (await currentMemberRef.get()).data();
    renderMember(d);
    toast('저장 완료');
  }catch(e){ console.error('saveProfile',e); toast('저장 실패: '+e.message); }
});

// 10) 스탬프/무료권
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

// 11) 다회권
passPreset10?.addEventListener('click', ()=>{ if(passName&&passCount){ passName.value='10회권'; passCount.value='10'; }});
passPreset20?.addEventListener('click', ()=>{ if(passName&&passCount){ passName.value='20회권'; passCount.value='20'; }});
passPreset30?.addEventListener('click', ()=>{ if(passName&&passCount){ passName.value='30회권'; passCount.value='30'; }});

btnAddPass?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const name=(passName?.value||'').trim();
  const cnt=parseInt(passCount?.value||'1',10);
  if(!name || !(cnt>0)) return toast('권종/수량 확인');
  try{
    await db.runTransaction(async(tx)=>{
      const snap=await tx.get(currentMemberRef);
      const d=snap.data()||{};
      const passes = Object.assign({}, d.passes||{});
      passes[name] = (passes[name]||0) + cnt;
      tx.update(currentMemberRef, { passes, updatedAt: ts() });
    });
    await addLog('pass_add', {name, cnt});
    if(passName) passName.value='';
    if(passCount) passCount.value='1';
    const d=(await currentMemberRef.get()).data(); renderMember(d);
  }catch(e){ console.error('addPass',e); toast('실패: '+e.message); }
});
btnUsePass?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const key = passSelect?.value;
  if(!key) return toast('권종을 선택하세요');
  try{
    await db.runTransaction(async(tx)=>{
      const snap=await tx.get(currentMemberRef);
      const d=snap.data()||{};
      const passes = Object.assign({}, d.passes||{});
      const cur = passes[key]||0;
      if(cur<=0) throw new Error('잔여 없음');
      passes[key] = cur - 1;
      tx.update(currentMemberRef, { passes, updatedAt: ts() });
    });
    await addLog('pass_use', {name:key, cnt:1});
    const d=(await currentMemberRef.get()).data(); renderMember(d);
  }catch(e){ console.error('usePass',e); toast('실패: '+e.message); }
});
btnRefundPass?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용'); if(!currentMemberRef) return toast('회원을 먼저 선택');
  const key = passSelect?.value;
  if(!key) return toast('권종을 선택하세요');
  try{
    await db.runTransaction(async(tx)=>{
      const snap=await tx.get(currentMemberRef);
      const d=snap.data()||{};
      const passes = Object.assign({}, d.passes||{});
      passes[key] = (passes[key]||0) + 1;
      tx.update(currentMemberRef, { passes, updatedAt: ts() });
    });
    await addLog('pass_refund', {name:key, cnt:1});
    const d=(await currentMemberRef.get()).data(); renderMember(d);
  }catch(e){ console.error('refundPass',e); toast('실패: '+e.message); }
});

// 12) 손님 마이페이지
async function loadSelf(user){
  if(!selfCard) return;
  selfCard.innerHTML = '<div class="muted">불러오는 중…</div>';
  try{
    const email = user?.email || '';
    const phone = email.replace(/@.*/, '');
    let snap = await db.collection('members').doc(phone).get();
    if(!snap.exists) snap = await db.collection('members').doc(email).get();
    if(!snap.exists){ selfCard.innerHTML = '<div class="muted">회원 정보 없음</div>'; return; }

    const d = snap.data() || {};
    const passStr = Object.entries(d.passes||{}).map(([k,v])=>`${k}:${v}`).join(', ') || '-';
    selfCard.innerHTML = `
      <div><b>${d.name||'-'}</b> (${fmtPhone(d.phone)})</div>
      <div>팀: ${d.team||'-'}</div>
      <div>스탬프: ${d.stamp||0}/10</div>
      <div>무료권: ${d.freeCredits||0}</div>
      <div>다회권: ${passStr}</div>
    `;
  }catch(e){ console.error('loadSelf',e); selfCard.innerHTML = '로드 실패: '+e.message; }
}

console.log('app.js loaded: admin edit + visits + passes + logs');

