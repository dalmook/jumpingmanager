// ==========================
// File: app.js
// ==========================
/* global firebase */
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

const $ = (s)=>document.querySelector(s);
const signedOut = $('#signedOut');
const signedIn = $('#signedIn');
const whoami = $('#whoami');
const btnLogin = $('#btnLogin');
const btnLogout = $('#btnLogout');
const btnSignup = $('#btnSignup');

const adminPanel = $('#adminPanel');
const allMembers = $('#allMembers');
const memberSelf = $('#memberSelf');
const selfCard = $('#selfCard');

let isAdmin = false;

// 관리자 이메일 리스트(추후 커스텀 클레임으로 대체 가능)
const adminEmails = ["admin@example.com"]; // 필요시 추가

// Auth 상태 감시
auth.onAuthStateChanged(async(user)=>{
  if(user){
    signedOut.classList.add('hidden');
    signedIn.classList.remove('hidden');
    whoami.textContent = `${user.email}`;

    isAdmin = adminEmails.includes(user.email);

    if(isAdmin){
      adminPanel.classList.remove('hidden');
      memberSelf.classList.add('hidden');
      await loadAllMembers();
    } else {
      adminPanel.classList.add('hidden');
      memberSelf.classList.remove('hidden');
      await loadSelf(user);
    }
  } else {
    signedOut.classList.remove('hidden');
    signedIn.classList.add('hidden');
    adminPanel.classList.add('hidden');
    memberSelf.classList.add('hidden');
  }
});

// 로그인
btnLogin?.addEventListener('click', async()=>{
  const email = $('#loginEmail').value.trim();
  const pass = $('#loginPass').value.trim();
  if(!email || !pass) return alert('이메일/비번 입력');
  try{
    await auth.signInWithEmailAndPassword(email, pass);
    alert('로그인 성공');
  }catch(e){ alert('로그인 실패: '+e.message); }
});

// 회원가입(손님): 이메일을 휴대폰@도메인 형식으로 사용 가능
btnSignup?.addEventListener('click', async()=>{
  const email = $('#loginEmail').value.trim();
  const pass = $('#loginPass').value.trim();
  if(!email || !pass) return alert('이메일/비번 입력');
  try{
    await auth.createUserWithEmailAndPassword(email, pass);
    // members 문서는 email을 키로 사용(간단화). phone은 @앞부분 추출
    const phone = email.replace(/@.*/, '');
    await db.collection('members').doc(email).set({
      name: '', phone, team: '',
      stamp: 0, freeCredits: 0, passes: {}, totalVisits: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('회원가입 완료');
  }catch(e){ alert('회원가입 실패: '+e.message); }
});

// 로그아웃
btnLogout?.addEventListener('click', async()=>{ await auth.signOut(); });

// 관리자: 전체 회원 로드
async function loadAllMembers(){
  const qs = await db.collection('members').orderBy('createdAt','desc').get();
  allMembers.innerHTML='';
  qs.forEach(doc=>{
    const d = doc.data();
    const div = document.createElement('div');
    div.className='item';
    div.textContent = `${d.name||'-'} · ${d.phone||''} · 스탬프:${d.stamp||0} · 무료:${d.freeCredits||0} · 다회권:${sumPass(d.passes||{})}`;
    allMembers.appendChild(div);
  });
}

function sumPass(p){
  return Object.values(p).reduce((a,b)=>a+(b||0),0);
}

// 손님: 자기 정보만 표시
async function loadSelf(user){
  const snap = await db.collection('members').doc(user.email).get();
  if(!snap.exists){ selfCard.textContent='회원 정보 없음'; return; }
  const d = snap.data();
  const passStr = Object.entries(d.passes||{}).map(([k,v])=>`${k}:${v}`).join(', ') || '-';
  selfCard.innerHTML = `
    <div><b>${d.name||'-'}</b> (${d.phone||''})</div>
    <div>팀: ${d.team||'-'}</div>
    <div>스탬프: ${d.stamp||0}/10</div>
    <div>무료권: ${d.freeCredits||0}</div>
    <div>다회권: ${passStr}</div>
  `;
}
