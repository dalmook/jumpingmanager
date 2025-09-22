// ==========================
// File: app.js (회원등록/수정 핸들러 포함 버전)
// ==========================
/* global firebase */

// 1) Firebase 설정값 채우기
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
const db = firebase.firestore();

// 2) 간단 헬퍼/유틸
const $ = (s)=>document.querySelector(s);
const toast = (m)=> alert(m);
const normPhone = (p)=> (p||"").replace(/\D/g,"");
const ts = ()=> firebase.firestore.FieldValue.serverTimestamp();

// 3) 디버그 패널 로그(태블릿용)
(function(){
  const area = ()=> document.getElementById('__dbgArea');
  function stamp(){ const d=new Date(); return d.toLocaleString()+'.'+String(d.getMilliseconds()).padStart(3,'0'); }
  function write(kind, ...args){
    try{
      const el=area(); if(!el) return;
      const line = `[${stamp()}] ${kind}: ${args.map(a=>{try{return typeof a==='string'?a:JSON.stringify(a);}catch{return String(a);}}).join(' ')}`;
      el.value += (el.value?'\n':'')+line; el.scrollTop = el.scrollHeight;
    }catch(_){}
  }
  const _log=console.log.bind(console), _err=console.error.bind(console), _warn=console.warn.bind(console);
  console.log=(...a)=>{ write('LOG',...a); _log(...a); };
  console.warn=(...a)=>{ write('WARN',...a); _warn(...a); };
  console.error=(...a)=>{ write('ERROR',...a); _err(...a); };
  window.addEventListener('error', e=> write('UNCAUGHT', e?.message||e));
  window.addEventListener('unhandledrejection', e=> write('REJECTION', e?.reason?.message||e?.reason));
})();

// 4) 권한(간단): 관리자 이메일 리스트
const adminEmails = ["chosungmook@naver.com"];

// 5) 공통 DOM
const signedOut = $('#signedOut');
const signedIn  = $('#signedIn');
const whoami    = $('#whoami');
const btnLogin  = $('#btnLogin');
const btnSignup = $('#btnSignup');
const btnLogout = $('#btnLogout');

const adminPanel = $('#adminPanel');
const allMembers = $('#allMembers');  // 관리자 전체 목록 컨테이너(없어도 무방)
const memberSelf = $('#memberSelf');
const selfCard   = $('#selfCard');    // 손님 카드 컨테이너(없어도 무방)

// ★ 회원등록/수정에 필요한 입력 요소
const regName  = $('#regName');
const regPhone = $('#regPhone');
const regTeam  = $('#regTeam');
const btnRegister = $('#btnRegister');

let isAdmin = false;

// 6) 인증 상태
auth.onAuthStateChanged(async(user)=>{
  if(user){
    signedOut?.classList.add('hidden');
    signedIn?.classList.remove('hidden');
    if (whoami) whoami.textContent = user.email || '';

    isAdmin = adminEmails.includes(user.email || '');
    adminPanel?.classList.toggle('hidden', !isAdmin);
    memberSelf?.classList.toggle('hidden', isAdmin);

    try{
      if(isAdmin){
        await loadAllMembers();
      }else{
        await loadSelf(user);
      }
    }catch(e){ console.error('initial load', e); }
  }else{
    signedOut?.classList.remove('hidden');
    signedIn?.classList.add('hidden');
    adminPanel?.classList.add('hidden');
    memberSelf?.classList.add('hidden');
  }
});

// 7) 로그인/회원가입/로그아웃
btnLogin?.addEventListener('click', async()=>{
  const email = $('#loginEmail')?.value?.trim();
  const pass  = $('#loginPass')?.value?.trim();
  if(!email || !pass) return toast('이메일/비밀번호를 입력하세요.');
  try{
    await auth.signInWithEmailAndPassword(email, pass);
    toast('로그인 성공');
  }catch(e){ console.error('login', e); toast('로그인 실패: '+e.message); }
});

btnSignup?.addEventListener('click', async()=>{
  const email = $('#loginEmail')?.value?.trim();
  const pass  = $('#loginPass')?.value?.trim();
  if(!email || !pass) return toast('이메일/비밀번호를 입력하세요.');
  try{
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    console.log('signup uid:', cred.user?.uid);
    const phone = email.replace(/@.*/, '');
    const ref = db.collection('members').doc(phone || email);
    await db.runTransaction(async(tx)=>{
      const s = await tx.get(ref);
      if(!s.exists){
        tx.set(ref, {
          name:'', phone, team:'', stamp:0, freeCredits:0, passes:{}, totalVisits:0,
          createdAt: ts(), updatedAt: ts()
        });
      }
    });
    toast('회원가입 완료');
  }catch(e){ console.error('signup', e); toast('회원가입 실패: '+e.message); }
});

btnLogout?.addEventListener('click', async()=>{
  try{ await auth.signOut(); toast('로그아웃'); }catch(e){ console.error('logout', e); }
});

// 8) ★★★ 관리자: 회원 등록/수정 핸들러 ★★★
btnRegister?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('운영자 전용 기능입니다.');
  if(!regName || !regPhone) { console.warn('[missing-el] reg inputs'); return; }

  const name  = regName.value.trim();
  const phone = normPhone(regPhone.value);
  const team  = regTeam?.value?.trim() || '';

  if(!name || !phone){
    return toast('이름과 휴대폰번호(숫자) 를 입력해 주세요.');
  }

  const ref = db.collection('members').doc(phone);
  console.log('register/update member', {name, phone, team});

  try{
    await db.runTransaction(async(tx)=>{
      const snap = await tx.get(ref);
      if(snap.exists){
        tx.update(ref, { name, team, updatedAt: ts() });
      }else{
        tx.set(ref, {
          name, phone, team, stamp:0, freeCredits:0, passes:{}, totalVisits:0,
          createdAt: ts(), updatedAt: ts()
        });
      }
    });
    toast('등록/수정 완료');
    // 입력칸 유지 / 필요시 초기화 원하면 아래 주석 해제
    // regName.value=''; regPhone.value=''; regTeam.value='';
    // 목록 새로고침(컨테이너가 있을 때만)
    if(allMembers) await loadAllMembers();
  }catch(e){
    console.error('btnRegister', e);
    toast('등록/수정 실패: '+e.message);
  }
});

// 9) 관리자: 전체 회원 목록 로드(컨테이너 있을 때만)
async function loadAllMembers(){
  if(!allMembers){ console.warn('[missing-el] #allMembers'); return; }
  allMembers.innerHTML = '<div class="muted">불러오는 중…</div>';
  try{
    // updatedAt 기준 최신 100
    const qs = await db.collection('members').orderBy('updatedAt','desc').limit(100).get();
    if(qs.empty){ allMembers.innerHTML = '<div class="muted">회원 없음</div>'; return; }
    const frag = document.createDocumentFragment();
    qs.forEach(doc=>{
      const d = doc.data() || {};
      const div = document.createElement('div');
      div.className = 'item';
      div.textContent = `${d.name||'-'} · ${d.phone||''} · 스탬프:${d.stamp||0}/10 · 무료:${d.freeCredits||0} · 다회:${Object.values(d.passes||{}).reduce((a,b)=>a+(b||0),0)}`;
      frag.appendChild(div);
    });
    allMembers.innerHTML = '';
    allMembers.appendChild(frag);
  }catch(e){
    console.error('loadAllMembers', e);
    allMembers.innerHTML = '로드 실패: '+e.message;
  }
}

// 10) 손님: 내 정보(컨테이너 있을 때만)
async function loadSelf(user){
  if(!selfCard){ console.warn('[missing-el] #selfCard'); return; }
  selfCard.innerHTML = '<div class="muted">불러오는 중…</div>';
  try{
    const email = user?.email || '';
    const phone = email.replace(/@.*/, '');
    let snap = await db.collection('members').doc(phone).get();
    if(!snap.exists) snap = await db.collection('members').doc(email).get();

    if(!snap.exists){
      selfCard.innerHTML = '<div class="muted">회원 정보 없음 (관리자에게 등록 요청)</div>';
      return;
    }
    const d = snap.data() || {};
    const passStr = Object.entries(d.passes||{}).map(([k,v])=>`${k}:${v}`).join(', ') || '-';
    selfCard.innerHTML = `
      <div><b>${d.name||'-'}</b> (${d.phone||''})</div>
      <div>팀: ${d.team||'-'}</div>
      <div>스탬프: ${d.stamp||0}/10</div>
      <div>무료권: ${d.freeCredits||0}</div>
      <div>다회권: ${passStr}</div>
    `;
  }catch(e){
    console.error('loadSelf', e);
    selfCard.innerHTML = '로드 실패: '+e.message;
  }
}

// 초기 로그
console.log('app.js loaded (with register/update handler).');

