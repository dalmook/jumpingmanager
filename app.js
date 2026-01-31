// ==========================
// File: app.js (ê´€ë¦¬ì ?¸ì§‘/ì¡°ì‘ + ?´ë????Œì›ê°€??ë¡œê·¸??+ ê²€??ëª©ë¡ + Nì¦ê° + ?? œ + ?ë‹˜ ??
// ==========================
/* global firebase */

// 1) Firebase ?¤ì •ê°?(?¬ìš©???œê³µê°?
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

// 2) ? í‹¸/ë¡œê·¸/?„í™”ë²ˆí˜¸
const $ = (s)=>document.querySelector(s);
const byId = (id)=>document.getElementById(id);
const toast = (m)=> alert(m);
const ts = ()=> firebase.firestore.FieldValue.serverTimestamp();
// ìµœì´ˆ ?Œì›ê°€??ì§í›„ 1???ˆë¡œê³ ì¹¨ ?Œë˜ê·??´ì œ (ë£¨í”„ ë°©ì?)
if (sessionStorage.getItem('__just_signed_up')) {
  sessionStorage.removeItem('__just_signed_up');
  // ?„ìš”?˜ë©´ ?ˆë‚´ ? ìŠ¤??
  // toast('?˜ì˜?©ë‹ˆ?? ì´ˆê¸° ?¤ì •??ë¶ˆëŸ¬?”ì–´??');
}

function shortPhone(raw){
  const p = canonPhone(raw); // ?«ìë§?ì¶”ì¶œ (01012345678)
  if (!p || p.length < 11) return fmtPhone(raw);

  // '010' ?œê±° ????8?ë¦¬ -> 1234-5678 ?•íƒœ
  const last8 = p.slice(-8);
  return last8.slice(0,4) + '-' + last8.slice(4);
}

// ?„ë©”?????¬í•¨ ?„ìˆ˜)
const PHONE_DOMAIN = 'phone.local';

// +82 ??0, ?«ìë§?
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
// ??êµì²´: ?«ì/ê°ì²´(?˜ìœ„?¸í™˜) ëª¨ë‘ ì§€??
const sumPass = (passes, passBatches) => {
  const legacy = Object.values(passes||{}).reduce((acc, v)=>{
    if (typeof v === 'number') return acc + (v||0);
    if (v && typeof v === 'object') return acc + (v.count||0);
    return acc;
  }, 0);
  const batches = Object.values(passBatches||{}).reduce((acc, v)=> acc + (v?.count||0), 0);
  return legacy + batches;
};

function sumNamedValidBatches(passBatches, name){
  const nowMs = firebase.firestore.Timestamp.now().toMillis();

  // ??ê³µë°± ?œê±°?´ì„œ ë¹„êµ (?? "ì²?†Œ??0?Œê¶Œ" / "ì²?†Œ??10?Œê¶Œ" ????ë§¤ì¹­)
  const want = (name || '').replace(/\s+/g, '');

  let s = 0;
  Object.values(passBatches || {}).forEach(b=>{
    if (!b) return;

    const got = (b.name || '').replace(/\s+/g, '');
    if (got !== want) return;

    if (b.expireAt && b.expireAt.toMillis() < nowMs) return; // ë§Œë£Œ ?œì™¸
    s += (b.count || 0);
  });
  return s;
}

// === NEW: KPI ì§‘ê³„ ?¬í¼ (?¤íšŒê¶??±ì¸10/20 + ì²?†Œ??0/20, ?¤íƒ¬???‰ì¼ ë¶„ë¦¬) ===
function computeKpisFromBatches(passBatches){
  const freeStamp   = sumNamedValidBatches(passBatches,'?¤íƒ¬?„ì ë¦½ì¿ ??);
  const freeWeekday = sumNamedValidBatches(passBatches,'?‰ì¼?´ìš©ê¶?);

  const pass10      = sumNamedValidBatches(passBatches,'10?Œê¶Œ');
  const pass20      = sumNamedValidBatches(passBatches,'20?Œê¶Œ');

  // ??ì¶”ê?
  const youth10     = sumNamedValidBatches(passBatches,'ì²?†Œ??10?Œê¶Œ');
  const youth20     = sumNamedValidBatches(passBatches,'ì²?†Œ??20?Œê¶Œ');

  // ???¤íšŒê¶??”ì—¬ = ?±ì¸10/20 + ì²?†Œ??0/20 ?©ê³„
  const general     = pass10 + pass20 + youth10 + youth20;

  return { freeStamp, freeWeekday, pass10, pass20, youth10, youth20, general };
}


// ??ê¸°ì¡´ ? í‹¸ ? ì?(?ˆê±°?œìš©)
function getPassCount(v){ return typeof v==='number' ? (v||0) : (v?.count||0); }
function setPassCount(oldVal, newCount){
  if (typeof oldVal === 'number' || oldVal == null) return { count: newCount };
  return { ...oldVal, count: newCount };
}

function fmtDate(d){
  try{ const dd = d?.toDate ? d.toDate() : d; const y=dd.getFullYear(), m=String(dd.getMonth()+1).padStart(2,'0'), day=String(dd.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }catch{return '-';}
}
// ??ë°°ì¹˜??ID
const newBatchId = ()=> db.collection('_').doc().id;

// ??YYYY-MM-DD (ë¡œì»¬) ?¬í¼
function ymdLocal(date){
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
// === ë§Œë£Œ???ë™?¸íŒ… ?¬í¼ ì¶”ê? (ymdLocal ?„ë˜??ë¶™ì—¬?£ê¸°) ===
function addMonths(date, n){
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0); // ë§ì¼ ë³´ì •
  return d;
}
function addYears(date, n){
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + n);
  return d;
}

// ??ë¡œì»¬ ?€?„ì¡´ ê¸°ì? "Nê°œì›” ?? ?¹ì¼ 23:59:59" Timestamp ë§Œë“¤ê¸?
function tsEndOfDayMonthsAhead(nMonths) {
  const dt = new Date();
  dt.setMonth(dt.getMonth() + nMonths);
  dt.setHours(23, 59, 59, 999);
  return firebase.firestore.Timestamp.fromDate(dt);
}

// ??ê¶Œì¢…ëª…ì— ?°ë¥¸ ê¸°ë³¸ ë§Œë£Œ ê°œì›” ??
function defaultExpireMonthsByName(name) {
  if (name === '?‰ì¼?´ìš©ê¶?) return 1;      // 1ê°œì›”
  if (name === '?¤íƒ¬?„ì ë¦½ì¿ ??) return 6; // 6ê°œì›”
  // ?¤íšŒê¶?10?Œê¶Œ/20?Œê¶Œ ???¼ë°˜ê¶?
  return 12;                            // 1??
}

// === QR ê³ í•´?ë„ PNG ?¤ìš´ë¡œë“œ ? í‹¸ (?œëª©: ?í•‘ë°°í?[ì£¼í™©] + ?”ì„±ë³‘ì ??ê²€??) ===
function downloadHighResQR(text, filename = 'qr.png', size = 1024){
  const tmp = document.createElement('div');
  tmp.style.position='fixed';
  tmp.style.left='-9999px';
  document.body.appendChild(tmp);

  const qr = new QRCode(tmp, {
    text,
    width: size,
    height: size,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  setTimeout(()=>{
    let c = document.createElement('canvas');
    let ctx = c.getContext('2d');

    const margin = 40;
    const titleHeight = 100;
    c.width  = size + margin*2;
    c.height = size + margin*2 + titleHeight;

    // ë°°ê²½ ?°ìƒ‰
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,c.width,c.height);

    // === ?œëª©: "?í•‘ë°°í? ?”ì„±ë³‘ì ?? ===
    ctx.font = "bold 48px 'Apple SD Gothic Neo','Noto Sans KR',sans-serif";
    ctx.textBaseline = "top";

    const leftText = "?í•‘ë°°í?";
    const rightText = " ?”ì„±ë³‘ì ??;

    // ?„ì²´ ?ìŠ¤????
    const totalWidth = ctx.measureText(leftText + rightText).width;
    const startX = (c.width - totalWidth) / 2;  // ê°€?´ë° ?•ë ¬ ê¸°ì?

    // ?¼ìª½ ?ìŠ¤??(ì£¼í™©)
    ctx.fillStyle = "#ff6600";
    ctx.fillText(leftText, startX, margin/2);

    // ?¤ë¥¸ìª??ìŠ¤??(ê²€?? ???¼ìª½ ?ìŠ¤????§Œ???¤ì—???œì‘
    const leftWidth = ctx.measureText(leftText).width;
    ctx.fillStyle = "#000000";
    ctx.fillText(rightText, startX + leftWidth, margin/2);

    // QR ì½”ë“œ ë¶™ì´ê¸?
    const cvs = tmp.querySelector('canvas');
    const img = tmp.querySelector('img');

    if (cvs) {
      ctx.drawImage(cvs, margin, margin+titleHeight, size, size);
      triggerDownload();
    } else if (img) {
      const qrImg = new Image();
      qrImg.onload = ()=>{
        ctx.drawImage(qrImg, margin, margin+titleHeight, size, size);
        triggerDownload();
      };
      qrImg.src = img.src;
      return;
    }

    function triggerDownload(){
      const dataUrl = c.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      tmp.remove();
    }
  }, 200);
}





/**
 * ê¶Œì¢…ëª…ì— ?°ë¼ #passExpire ê¸°ë³¸ê°’ì„ ?¤ì •
 * - ?‰ì¼ë¬´ë£Œê¶? +1ê°œì›”
 * - ?¤íƒ¬?„ì ë¦½ì¿ ?? +1ê°œì›”
 * - ?¤íšŒê¶?10?Œê¶Œ/20?Œê¶Œ(ê·???ê¸°ë³¸): +1??
 * - ?¬ìš©?ê? ? ì§œë¥?ì§ì ‘ ê³ ì¹˜ë©????´ìƒ ??–´?°ì? ?Šë„ë¡?data-autoset ?Œë˜ê·??¬ìš©
 */
function setExpireDefaultByName(name){
  const el = document.getElementById('passExpire');
  if (!el) return;

  const today = new Date();
  el.min = ymdLocal(today);      // ?¤ëŠ˜ ?´ì „ ? íƒ ë¶ˆê?

  if (!el.dataset.autoset && el.value) return; // ?¬ìš©???˜ë™ê°’ì´ë©?? ì?

  const n = (name || '').replace(/\s+/g, '');
  let target;
  if (n === '?‰ì¼?´ìš©ê¶?) {
    target = addMonths(today, 1);
  } else if (n === '?¤íƒ¬?„ì ë¦½ì¿ ??) {
    target = addMonths(today, 1);
  } else if (n === '10?Œê¶Œ' || n === '20?Œê¶Œ' || n === 'ì²?†Œ??0?Œê¶Œ' || n === 'ì²?†Œ??0?Œê¶Œ') {
    target = addYears(today, 1);
  } else {
    target = addYears(today, 1); // ê¸°ë³¸
  }

  el.value = ymdLocal(target);
  el.dataset.autoset = '1';
}


// ?¬ìš©?ê? ? ì§œë¥?ì§ì ‘ ë°”ê¾¸ë©?autoset ?´ì œ
document.getElementById('passExpire')?.addEventListener('input', (e)=>{
  if (e.currentTarget) e.currentTarget.dataset.autoset = '';
});

// (êµì²´) ë§Œë£Œ??ê¸°ë³¸ê°?ê°•ì œ X, ?¤ëŠ˜ ?´ì „ë§?ë§‰ìŒ
function initPassExpireDefault(){
  const el = document.getElementById('passExpire');
  if (!el) return;
  const today = new Date();
  el.min = ymdLocal(today);
  // el.value ?¤ì •?€ ?˜ì? ?ŠìŒ (ê¶Œì¢…ë³?setExpireDefaultByNameë¡?ì²˜ë¦¬)
}





// ?”ë²„ê·??¨ë„(?ˆìœ¼ë©?ë¡œê·¸ ?œì‹œ)
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

// 3) ê¶Œí•œ(ê°„ë‹¨)
const adminEmails = ["01041668764@phone.local"];

// 4) DOM ì°¸ì¡°
// ?¸ì¦/ê³µí†µ
const whoami = $('#whoami');
const signedOut = $('#signedOut');
const signedIn  = $('#signedIn');
const btnLogin  = $('#btnLogin');
const btnSignup = $('#btnSignup');
const btnLogout = $('#btnLogout');
const mascot = document.querySelector('.mascot-badge');

// ëª¨ë‹¬/???„ë“œ ì°¸ì¡°
const signupModal = document.getElementById('signupModal');
const signupForm  = document.getElementById('signupForm');
const btnCancelSignup = document.getElementById('btnCancelSignup');

const suName  = document.getElementById('suName');
const suPhone = document.getElementById('suPhone');
const suPass  = document.getElementById('suPass');
const suEmail = document.getElementById('suEmail');
const suTeam  = document.getElementById('suTeam');
const suCar   = document.getElementById('suCar');
const suAgree = document.getElementById('suAgree');


// [ì¶”ê?] QR ?¤ìº” UI ì°¸ì¡°
const btnQRScan = document.getElementById('btnQRScan');
const qrModal   = document.getElementById('qrModal');
const qrVideo   = document.getElementById('qrVideo');
const qrClose   = document.getElementById('qrClose');


// ê´€ë¦¬ì ë¦¬ìŠ¤??ê²€??
const adminPanel = $('#adminPanel');
const adminList  = $('#adminList');
const searchPhone= $('#searchPhone');
const btnSearch  = $('#btnSearch');
const btnLoadAll = $('#btnLoadAll');

// ?Œì› ?±ë¡
const regName  = $('#regName');
const regPhone = $('#regPhone');
const regTeam  = $('#regTeam');
const btnRegister = $('#btnRegister');

const btnReloadLogs = document.getElementById('btnReloadLogs');
const btnMoreLogs   = document.getElementById('btnMoreLogs');

btnReloadLogs?.addEventListener('click', () => loadLogs(true));
btnMoreLogs  ?.addEventListener('click', () => loadLogs(false));


// ?ë‹˜ ë§ˆì´?˜ì´ì§€ (?”ì•½ ì¹´ë“œ)
const memberSelf = $('#memberSelf');
const selfCard   = $('#selfCard');

// ?ì„¸/ì¡°ì‘ ?¨ë„ (ê´€ë¦¬ì)
const memberSection = $('#memberSection');
const mTeam  = $('#mTeam');
const mEmail = $('#mEmail');
const mPhone = $('#mPhone');

// === ?¤í…Œ?´ì? ?•ì˜/DOM ===
const STAGE_TOTALS = {
  'ë² ì´ì§?:21, '?´ì?':21, '?¸ë§':19, '?˜ë“œ':17, 'ì±Œë¦°?€':15,
  '?¬ë¦„':22, '?°ì£¼':21,
};
const stageOrder = ['ë² ì´ì§?,'?´ì?','?¸ë§','?˜ë“œ','ì±Œë¦°?€','?¬ë¦„','?°ì£¼'];

const stageList      = $('#stageList');        // ê´€ë¦¬ì ?…ë ¥??ì»¨í…Œ?´ë„ˆ
const btnSaveStages  = $('#btnSaveStages');    // ê´€ë¦¬ì ?€??ë²„íŠ¼

const btnViewStages  = $('#btnViewStages');    // ?ë‹˜ ?˜ê¸°ë¡?ë³´ê¸°??
const selfStageList  = $('#selfStageList');    // ?ë‹˜ ì¹´ë“œ ë¦¬ìŠ¤??

const mCar       = $('#mCar');     // ì°¨ëŸ‰ë²ˆí˜¸ ?œì‹œ
const mNote      = $('#mNote');    // ë¹„ê³  ?œì‹œ
const mStamp = $('#mStamp');;
const mFree  = $('#mFree');
const mFreeWk = $('#mFreeWk');   // ì¶”ê?
const mFreeSl = $('#mFreeSl');   // ì¶”ê?
const mPassTotal = $('#mPassTotal');
const stampDots  = $('#stampDots');

const editName = $('#editName');
const editTeam = $('#editTeam');
const editEmail = $('#editEmail');
const editCar  = $('#editCar');     // ì°¨ëŸ‰ë²ˆí˜¸
const editNote = $('#editNote');    // ë¹„ê³ 
const btnSaveProfile = $('#btnSaveProfile');

const btnAddVisit   = $('#btnAddVisit');
const btnResetStamp = $('#btnResetStamp');

const passName   = $('#passName');
const passCount  = $('#passCount');
const btnAddPass = $('#btnAddPass');
const passSelect = $('#passSelect');
let lastSelectedPass = '';

passSelect?.addEventListener('change', () => {
  lastSelectedPass = passSelect.value || '';
});

const passPreset10 = $('#passPreset10');
const passPreset20 = $('#passPreset20');

// ??ì¶”ê?
const passPresetY10 = $('#passPresetY10');
const passPresetY20 = $('#passPresetY20');

const passPresetFree = document.getElementById('passPresetFree');
const passPresetWk   = document.getElementById('passPresetWk');



passPresetFree?.addEventListener('click', ()=>{
  if(passName&&passCount){
    passName.value='?¤íƒ¬?„ì ë¦½ì¿ ??;
    passCount.value='1';
    setExpireDefaultByName('?¤íƒ¬?„ì ë¦½ì¿ ??);
  }
});
passPresetWk?.addEventListener('click', ()=>{
  if(passName&&passCount){
    passName.value='?‰ì¼?´ìš©ê¶?;
    passCount.value='1';
    setExpireDefaultByName('?‰ì¼?´ìš©ê¶?);
  }
});




const passList = $('#passList');
const logList  = $('#logList');

// === Nê°?ì¦ê°/?? œ?????”ì†Œ??===
const stampDelta   = $('#stampDelta');
const btnAddStampN = $('#btnAddStampN');
const btnSubStampN = $('#btnSubStampN');

const freeSlDelta   = $('#freeSlDelta');     // ì¶”ê?
const btnAddFreeSlN = $('#btnAddFreeSlN');   // ì¶”ê?
const btnSubFreeSlN = $('#btnSubFreeSlN');   // ì¶”ê?


const passDelta      = $('#passDelta');
const btnUsePassN    = $('#btnUsePassN');
const btnRefundPassN = $('#btnRefundPassN');
const btnDeletePass  = $('#btnDeletePass');

const btnDeleteMember = $('#btnDeleteMember');

// --- ?ë‹˜ ???„í™˜??---
const selfTabsBar   = document.querySelector('#memberSelf .tabbar');
const selfTabPanes  = {
  summary: document.getElementById('selfTab-summary'),
  passes : document.getElementById('selfTab-passes'),
  logs   : document.getElementById('selfTab-logs'),
};
const selfPassList  = document.getElementById('selfPassList');
const selfLogList   = document.getElementById('selfLogList');




// === ë¹ ë¥¸ ?Œì› ?±ë¡/?˜ì • ===
btnRegister?.addEventListener('click', async ()=>{
  if(!isAdmin) return toast('?´ì˜???„ìš© ê¸°ëŠ¥?…ë‹ˆ??');

  const name  = regName?.value?.trim()  || '';
  const phone = canonPhone(regPhone?.value?.trim() || '');
  const team  = regTeam?.value?.trim()  || '';

  if(!phone) return toast('?´ë??°ë²ˆ???«ìë§?ë¥??…ë ¥?˜ì„¸??');

  try{
    const ref = db.collection('members').doc(phone);
    await db.runTransaction(async (tx)=>{
      const snap = await tx.get(ref);
      const base = snap.exists ? (snap.data()||{}) : {
        name:'', phone, team:'', stamp:0,
        freeCredits:0, freeWeekday:0, freeSlush:0,  // ì¶”ê?
        passes:{}, totalVisits:0, createdAt: ts()
      };
      tx.set(ref, {
        ...base,
        name: name || base.name,
        team: team || base.team,
        phoneLast4: phone.slice(-4),
        updatedAt: ts()
      }, { merge:true });
    });

    // ëª©ë¡ ê°±ì‹  ë°???ë¹„ìš°ê¸?? íƒ)
    await loadAllMembers();
    toast('?±ë¡/?˜ì • ?„ë£Œ');
    // regName.value = ''; regPhone.value=''; regTeam.value='';
  }catch(e){
    console.error('quick-register', e);
    toast('?±ë¡/?˜ì • ?¤íŒ¨: '+(e?.message||e));
  }
});

// ?íƒœ
let isAdmin = false;
let currentMemberRef = null; // ?„ì¬ ?¸ì§‘ ì¤??Œì› ref
// [ì¶”ê?] QR ?¤ìº” ?íƒœ
let qrStream = null;
let qrScanRunning = false;
const qrDetector = ('BarcodeDetector' in window)
  ? new BarcodeDetector({ formats: ['qr_code'] })
  : null;
// === ?”ë²„ê·??¨ë„ ? ê?/ë³µì‚¬/ì§€?°ê¸° ===
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
    toast('?”ë²„ê·?ë¡œê·¸ë¥??´ë¦½ë³´ë“œ??ë³µì‚¬?ˆìŠµ?ˆë‹¤.');
  }catch(e){ console.error('dbg copy',e); toast('ë³µì‚¬ ?¤íŒ¨'); }
});
dbgClear ?.addEventListener('click', ()=>{
  if(dbgArea) dbgArea.value='';
});
// 5) ?¸ì¦ ?íƒœ
auth.onAuthStateChanged(async(user)=>{
  if(user){
    signedOut?.classList.add('hidden');
    signedIn?.classList.remove('hidden');

    isAdmin = adminEmails.includes(user.email || '');
    mascot?.classList.toggle('hidden', isAdmin);  // ê´€ë¦¬ìë©??¨ê?, ?ë‹˜?´ë©´ ?œì‹œ
    adminPanel?.classList.toggle('hidden', !isAdmin);
    memberSelf?.classList.toggle('hidden', isAdmin);
    // ?”ë²„ê·?ë²„íŠ¼/?¨ë„: ê´€ë¦¬ìë§??œì‹œ
    dbgToggle?.classList.toggle('hidden', !isAdmin);
    dbgPanel ?.classList.add('hidden');   // ?´ë ¤ ?ˆì—ˆ?¤ë©´ ?«ì•„?ê¸°


    // ?ë‹˜ ???„í™˜ ë°”ì¸??1??
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
        // === QR ?¤ìº” ì²˜ë¦¬: ?stamp=?´ë???===
    try{
      const params = new URLSearchParams(location.search);
      const phoneFromQR = params.get('stamp');
      if(isAdmin && phoneFromQR){
        await openMember(canonPhone(phoneFromQR));  // ?´ë‹¹ ?Œì› ?ì„¸ ?´ê¸°

        const nRaw = prompt('?ë¦½???¤íƒ¬??ê°œìˆ˜ë¥??…ë ¥?˜ì„¸??, '1');
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
            
            const passBatches = { ...(d.passBatches || {}) };
            if (addFree > 0) {
              const id = newBatchId();
              passBatches[id] = {
                name: '?¤íƒ¬?„ì ë¦½ì¿ ??,
                count: addFree,
                expireAt: tsEndOfDayMonthsAhead(defaultExpireMonthsByName('?¤íƒ¬?„ì ë¦½ì¿ ??)),
              };
            }
            
            tx.update(currentMemberRef, {
              stamp: s1,
              passBatches,      // ???¬ê¸°ë¡?ë³€ê²?
              totalVisits,
              updatedAt: ts()
            });
          });

          await addLog('stamp_add_n', { n: N, via:'qr' });
          renderMember((await currentMemberRef.get()).data());
          toast(`?¤íƒ¬??${N}ê°??ë¦½ ?„ë£Œ`);
        }
        // ?Œë¼ë¯¸í„° ?œê±° (?ˆë¡œê³ ì¹¨/?¤ë¡œê°€ê¸????¬ì‹¤??ë°©ì?)
        history.replaceState({}, '', window.location.pathname);
      }
    }catch(e){ console.warn('qr-stamp', e); }

} else {
    signedOut?.classList.remove('hidden');
    signedIn?.classList.add('hidden');
    adminPanel?.classList.add('hidden');
    mascot?.classList.add('hidden');   // ??ì¶”ê?
    memberSelf?.classList.add('hidden');
    // ?”ë²„ê·?ë²„íŠ¼/?¨ë„ ?¨ê?
    dbgToggle?.classList.add('hidden');
    dbgPanel ?.classList.add('hidden');

    // ??QR/ë§ˆì´?˜ì´ì§€ ?”ì ???•ì‹¤???•ë¦¬
    const qrTarget = document.getElementById('selfBigQR');
    if (qrTarget) qrTarget.innerHTML = '';
    const dlBtn = document.getElementById('btnQRDownload');
    if (dlBtn) dlBtn.remove();
    const selfCardEl = document.getElementById('selfCard');
    if (selfCardEl) selfCardEl.innerHTML = '';
    const selfPassList = document.getElementById('selfPassList');
    if (selfPassList) selfPassList.innerHTML = '';
    const selfStageList = document.getElementById('selfStageList');
    if (selfStageList) selfStageList.innerHTML = '';

    hideMemberPanel();
  }
});
btnSignup?.addEventListener('click', () => {
  // ì´ˆê¸°??
  if (suName)  suName.value = '';
  if (suPhone) suPhone.value = (document.getElementById("loginEmail")?.value || '').replace(/\D/g,'');
  if (suPass)  suPass.value = document.getElementById("loginPass")?.value || '';
  if (suEmail) suEmail.value = '';
  if (suTeam)  suTeam.value = '';
  if (suCar)   suCar.value = '';
  if (suAgree) suAgree.checked = false;

  signupModal?.classList.remove('hidden');
});

// 6) ë¡œê·¸?? ê´€ë¦¬ì(?´ë©”?? / ?ë‹˜(?´ë???
btnLogin?.addEventListener("click", async () => {
  const idRaw = byId("loginEmail")?.value?.trim();
  const pass = byId("loginPass")?.value?.trim();
  if (!idRaw || !pass) return toast("?„ì´???´ë©”???´ë????€ ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?˜ì„¸??");

  let emailForAuth = null;
  const looksLikeEmail = idRaw.includes("@");
  const isAdminEmailTyped = adminEmails.includes(idRaw);

  if (looksLikeEmail || isAdminEmailTyped) {
    emailForAuth = idRaw; // ê´€ë¦¬ì: ?´ë©”??ê·¸ë?ë¡?
  } else if (isPhoneInput(idRaw)) {
    emailForAuth = toEmailFromPhone(idRaw); // ?ë‹˜: ?´ë??????´ë? ?´ë©”??
  } else {
    return toast("ë¡œê·¸?? ê´€ë¦¬ì=?´ë©”?? ?ë‹˜=?´ë??°ë²ˆ???«ìë§? ?…ë ¥");
  }

  try {
    await auth.signInWithEmailAndPassword(emailForAuth, pass);
    toast("ë¡œê·¸???±ê³µ");
    byId("loginEmail").value = "";
    byId("loginPass").value  = "";
  } catch (e) {
    console.error("login error", e);
    toast("ë¡œê·¸???¤íŒ¨: " + (e?.message || e));
  }
});

// 7) ?Œì›ê°€??ë²„íŠ¼: ëª¨ë‹¬ ?´ê¸°
// ì·¨ì†Œ ë²„íŠ¼: ëª¨ë‹¬ ?«ê¸°
btnCancelSignup?.addEventListener('click', () => {
  signupModal?.classList.add('hidden');
});

// ?œì¶œ ?¸ë“¤???˜ë‚˜ë§?
signupForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name  = suName?.value?.trim()  || '';
  const phone = canonPhone(suPhone?.value?.trim() || '');
  const pass  = suPass?.value?.trim()  || '';
  const email = (suEmail?.value || '').trim();   // ? íƒ
  const team  = (suTeam?.value  || '').trim();   // ? íƒ
  const car   = (suCar?.value   || '').trim();
  const agree = !!suAgree?.checked;

  // ???„ìˆ˜ë§?ê²€?? ?´ë¦„/?„í™”/ë¹„ë²ˆ/?™ì˜
  if (!name)  return toast('?´ë¦„???…ë ¥?˜ì„¸??');
  if (!isPhoneInput(phone)) return toast('?¸ë“œ?°ë²ˆ???«ìë§?ë¥??•í™•???…ë ¥?˜ì„¸??');
    if (!pass)  return toast('ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?˜ì„¸??');
    if (pass.length !== 6) return toast('ë¹„ë?ë²ˆí˜¸??6?ë¦¬ë¡??…ë ¥?˜ì„¸??');
  // ?´ë©”?¼ì? ?…ë ¥??ê²½ìš°?ë§Œ ?•ì‹ ê²€??
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('?¬ë°”ë¥??´ë©”?¼ì„ ?…ë ¥?˜ì„¸??');
  if (!agree) return toast('ê°œì¸?•ë³´ ?œìš©???™ì˜??ì£¼ì„¸??');

  try {
    // ?ë‹˜ ë¡œê·¸???•ì±… ? ì?: phone@phone.local ë¥?Auth ê³„ì •?¼ë¡œ ?¬ìš©
    const authEmail = toEmailFromPhone(phone);
    const cred = await auth.createUserWithEmailAndPassword(authEmail, pass);

    const ref = db.collection('members').doc(phone);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const base = snap.exists ? (snap.data() || {}) : {
        name:'', phone, team:'', stamp:0,
        freeCredits:0, freeWeekday:0, freeSlush:0,
        passes:{}, passBatches:{}, totalVisits:0, createdAt: ts()
      };

      // ??ë¹?ê°’ìœ¼ë¡?ê¸°ì¡´ ?°ì´?°ë? ??–´?°ì? ?Šë„ë¡?payloadë¥?ì¡°ê±´ë¶€ êµ¬ì„±
      const payload = {
        ...base,
        name,
        phone,
        phoneLast4: phone.slice(-4),
        updatedAt: ts(),
        uid: cred.user?.uid || null
      };
      if (team)  payload.team  = team;
      if (email) payload.email = email;
      if (car)   payload.car   = car;

      tx.set(ref, payload, { merge: true });
    });

    signupModal?.classList.add('hidden');
    toast('?Œì›ê°€???„ë£Œ! ì´ˆê¸° ?•ë³´ë¥?ë¶ˆëŸ¬?¤ëŠ” ì¤‘ì…?ˆë‹¤??);
    
    // ??1???ˆë¡œê³ ì¹¨ ?Œë˜ê·??¤ì • ??ë¦¬ë¡œ??
    sessionStorage.setItem('__just_signed_up', '1');
    setTimeout(() => {
      location.reload(); // ê°™ì? ?˜ì´ì§€ë¡?1???ˆë¡œê³ ì¹¨
    }, 500);
    
    // (?„ë˜ ë¡œê·¸???…ë ¥ì°?ì´ˆê¸°?”ëŠ” ?ˆë¡œê³ ì¹¨?˜ë©´ ?˜ë? ?†ì–´ ?ëµ?´ë„ ??


  } catch(e) {
    console.error('signup submit error', e);
    if (e?.code === 'auth/email-already-in-use') {
      toast('?´ë? ê°€?…ëœ ë²ˆí˜¸?…ë‹ˆ?? ë¡œê·¸?¸ìœ¼ë¡?ì§„í–‰??ì£¼ì„¸??');
    } else {
      toast('?Œì›ê°€???¤íŒ¨: ' + (e?.message || e));
    }
  }
});


// 8) ë¡œê·¸?„ì›ƒ
btnLogout?.addEventListener('click', async()=>{
  try{
    await auth.signOut();
    mascot?.classList.add('hidden');   // ??ì¶”ê?: ì¦‰ì‹œ ?¨ê?

    // ??ê´€ë¦¬ì ?”ë©´ ?¨ê¸°ê¸?
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) adminPanel.classList.add('hidden');

    // ???Œì› ?ì„¸ ë¹„ìš°ê¸?
    const adminList = document.getElementById('adminList');
    if (adminList) adminList.innerHTML = '';
    
    const qrTarget = document.getElementById('selfBigQR');
    if (qrTarget) qrTarget.innerHTML = '';
    const dlBtn = document.getElementById('btnQRDownload');
    if (dlBtn) dlBtn.remove();
    const selfCardEl = document.getElementById('selfCard');
    if (selfCardEl) selfCardEl.innerHTML = '';
    const selfPassList = document.getElementById('selfPassList');
    if (selfPassList) selfPassList.innerHTML = '';
    const selfStageList = document.getElementById('selfStageList');
    if (selfStageList) selfStageList.innerHTML = '';
    if (whoami) whoami.textContent = '';
    toast('ë¡œê·¸?„ì›ƒ');
  }catch(e){ console.error('logout',e); }
});

// 9) ê´€ë¦¬ì: ?„ì²´ ëª©ë¡/ê²€??
btnLoadAll?.addEventListener('click', loadAllMembers);
btnSearch?.addEventListener('click', searchMembers);
searchPhone?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') searchMembers(); });
// ??ì´ˆê¸°?? ë²„íŠ¼: ?…ë ¥ ì§€?°ê³  ?„ì²´ ëª©ë¡ ë¡œë“œ
const btnClearSearch = document.getElementById('btnClearSearch');
btnClearSearch?.addEventListener('click', ()=>{
  if (searchPhone) searchPhone.value = '';
  loadAllMembers(true);  // ?„ì²´ ëª©ë¡ ?¤ì‹œ ë¶ˆëŸ¬?¤ê¸°
});


// ===== ?Œì› ëª©ë¡: ?¨ë°œ??+ ?˜ì´ì§€?¤ì´??=====
let __membersCursor = null;
const PAGE_SIZE = 10;

// --- ?„ì²´ ?Œì› ???œì‹œ ---
async function updateMemberCount(){
  try{
    const snap = await db.collection('members').get();
    const count = snap.size;
    const label = document.getElementById('memberCount');
    if(label) label.textContent = `(${count}ëª?`;
  }catch(e){ console.warn('?Œì› ??ë¶ˆëŸ¬?¤ê¸° ?¤íŒ¨', e); }
}

updateMemberCount();

// "??ë³´ê¸°" ë²„íŠ¼ ë³´ì¥ ? í‹¸ (HTML???†ìœ¼ë©??ë™ ?ì„±)
function ensureMoreMembersButton() {
  let btn = document.getElementById('btnMoreMembers');
  if (!btn && adminList && adminList.parentElement) {
    btn = document.createElement('button');
    btn.id = 'btnMoreMembers';
    btn.type = 'button';
    btn.className = 'btn ghost small mt8';
    btn.textContent = '??ë³´ê¸°';
    btn.addEventListener('click', () => loadAllMembers(false));
    adminList.parentElement.appendChild(btn);
  }
  return btn;
}

async function loadAllMembers(reset = true){
  if(!adminList) return;
  if (reset) {
    adminList.innerHTML = '<div class="muted">ë¶ˆëŸ¬?¤ëŠ” ì¤‘â€?/div>';
    __membersCursor = null;
  }

  try {
    let q = db.collection('members').orderBy('name').limit(PAGE_SIZE);
    if (__membersCursor) q = q.startAfter(__membersCursor);

    const qs = await q.get();
    if (reset) adminList.innerHTML = '';

    if (qs.empty) {
      if (!adminList.children.length) {
        adminList.innerHTML = '<div class="muted">?Œì› ?†ìŒ</div>';
      }
      const btn = document.getElementById('btnMoreMembers');
      if (btn) btn.classList.add('hidden');
      return;
    }

    const frag = document.createDocumentFragment();
    qs.forEach(doc=>{
      const d = doc.data() || {};
      const div = document.createElement('div');
      div.className = 'item member-row';
      div.innerHTML = `
        <span class="m-name">${d.name || '-'}</span>
        <span class="sep">|</span>
        <span class="m-phone">${shortPhone(d.phone || '')}</span>
        <span class="sep">|</span>
        <span class="m-team">${d.team || '-'}</span>
      `;
      div.dataset.id = doc.id;
      div.style.cursor = 'pointer';
      div.addEventListener('click', ()=> openMember(doc.id));
      frag.appendChild(div);
    });
    adminList.appendChild(frag);

    __membersCursor = qs.docs[qs.docs.length - 1];

    const btn = ensureMoreMembersButton();
    if (btn) btn.classList.remove('hidden');

  } catch(e) {
    console.error('loadAllMembers', e);
    adminList.innerHTML = 'ë¡œë“œ ?¤íŒ¨: '+(e?.message||e);
  }
}



async function searchMembers(){
  if(!adminList) return;
  const qRaw = (searchPhone?.value||'').trim();
  const q = canonPhone(qRaw);
  if(!q) return loadAllMembers();

  adminList.innerHTML = '<div class="muted">ê²€??ì¤‘â€?/div>';
  try{
    let docs = [];
    if (q.length >= 7) {
      // ?•í™• ë§¤ì¹­(ë¬¸ì„œ???„í™”ë²ˆí˜¸) ?°ì„ 
      const snap = await db.collection('members').doc(q).get();
      if (snap.exists) {
        docs = [snap];
      } else {
        // ?„í™”ë²ˆí˜¸ prefix ê²€??
        const qs = await db.collection('members')
          .orderBy('phone')
          .startAt(q).endAt(q+'\uf8ff')
          .limit(50).get();
        docs = qs.docs;
      }
    } else {
      // ?ìë¦?ê²€?? ?´ë¦„?œìœ¼ë¡?ë°›ì•„?€??endsWith ?„í„°
      const qs = await db.collection('members').orderBy('name').limit(500).get();
      docs = qs.docs.filter(d => (canonPhone(d.data().phone||'')).endsWith(q));
    }

    if (!docs.length){
      adminList.innerHTML = '<div class="muted">ê²€??ê²°ê³¼ ?†ìŒ</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    docs.forEach(doc => {
      const d = doc.data() || {};
      const div = document.createElement('div');
      div.className = 'item member-row';
      div.innerHTML = `
        <span class="m-name">${d.name || '-'}</span>
        <span class="sep">|</span>
        <span class="m-phone">${shortPhone(d.phone || '')}</span>
        <span class="sep">|</span>
        <span class="m-team">${d.team || '-'}</span>
      `;
      div.dataset.id = doc.id;
      div.style.cursor = 'pointer';
      div.addEventListener('click', ()=> openMember(doc.id));
      frag.appendChild(div);
    });

    adminList.innerHTML = '';
    adminList.appendChild(frag);

  } catch(e) {
    console.error('searchMembers', e);
    adminList.innerHTML = 'ê²€???¤íŒ¨: ' + (e?.message || e);
  }
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


// 10) ?Œì› ?ì„¸/?Œë”/ë¡œê·¸
function hideMemberPanel(){
  memberSection?.classList.add('hidden');
  currentMemberRef = null;
  if (logList) logList.innerHTML = '';        // ??ë¡œê·¸ ë¹„ìš°ê¸?
  if (typeof __logsCursor !== 'undefined') __logsCursor = null; // (? íƒ) ì»¤ì„œ ë¦¬ì…‹
}


async function openMember(id){
  const ref = db.collection('members').doc(id);
  const snap = await ref.get();
  if(!snap.exists){ toast('?Œì› ?†ìŒ'); return; }

  currentMemberRef = ref;
  renderMember(snap.data());
  memberSection?.classList.remove('hidden');

  // ??ë¡œê·¸ ëª©ë¡/ì»¤ì„œ ì´ˆê¸°?????ˆë¡œ ë¡œë“œ
  if (logList) logList.innerHTML = '<div class="muted">ë¡œê·¸ ë¶ˆëŸ¬?¤ëŠ” ì¤‘â€?/div>';
  if (typeof __logsCursor !== 'undefined') __logsCursor = null; // (?˜ì´ì§€?¤ì´???°ëŠ” ê²½ìš°)
  await loadLogs(true); // ??reset=trueë¡?ì²??˜ì´ì§€ë¶€???¤ì‹œ
}


function renderMember(d){
  // 0) ë°©ì–´ & ?´ì „ ? íƒê°?ë°±ì—…
  const prevSelected = lastSelectedPass || passSelect?.value || '';

  // 1) ë¦¬ìŠ¤???€?‰íŠ¸ ë¹„ìš°ê¸?
  if (passList)  passList.innerHTML = '';
  if (passSelect) passSelect.innerHTML = '';

  if(!d) return;

  // --- ?Œì› ê¸°ë³¸?•ë³´ ---
  if (mTeam)  mTeam.textContent  = d.team || '-';
  if (mEmail) mEmail.textContent = d.email || '-';
  if (mPhone) mPhone.textContent = fmtPhone(d.phone) || '-';
  
  if (mCar)   mCar.textContent  = d.car  || '-';
  if (mNote)  mNote.textContent = d.note || '-';

  if (mStamp)   mStamp.textContent   = d.stamp || 0;
  const __kpi   = computeKpisFromBatches(d.passBatches || {});
  if (mFree)    mFree.textContent    = __kpi.freeStamp;     // ?¤íƒ¬?„ì ë¦½ì¿ ??
  if (mFreeWk)  mFreeWk.textContent  = __kpi.freeWeekday;   // ?‰ì¼?´ìš©ê¶?
  if (mFreeSl)  mFreeSl.textContent  = d.freeSlush || 0;    // ?¬ëŸ¬??
  if (mPassTotal) mPassTotal.textContent = __kpi.general;   // ?¤íšŒê¶?10/20 ??

  if(editName) editName.value = d.name || '';
  if(editTeam) editTeam.value = d.team || '';
  if(editEmail) editEmail.value = d.email || '';
  if(editCar)  editCar.value  = d.car || '';
  if(editNote) editNote.value = d.note || '';

  // --- ?¤íƒ¬?????œì‹œ ---
  if(stampDots){
    stampDots.innerHTML = '';
    for(let i=0;i<10;i++){
      const dot = document.createElement('div');
      dot.className = 'dot' + (i < (d.stamp||0) ? ' on' : '');
      stampDots.appendChild(dot);
    }
  }

  // --- ?¤íšŒê¶?(ë°°ì¹˜ + ?ˆê±°?? ---
  Object.entries(d.passBatches || {}).forEach(([id,b])=>{
    const cnt = b?.count || 0;
    const exp = b?.expireAt ? fmtDate(b.expireAt) : null;
    const line = exp ? `${b.name} Â· ?”ì—¬ ${cnt} Â· ë§Œë£Œ ${exp}` : `${b.name} Â· ?”ì—¬ ${cnt}`;
    const isZero = cnt <= 0;

    if(passList){
      const item = document.createElement('div');
      item.className = 'item pass-item' + (isZero ? ' zero' : '');
      item.textContent = line + '  [ë°°ì¹˜]';
      item.dataset.kind = 'batch';
      item.dataset.key  = id;
      // ë¦¬ìŠ¤?¸ì—???´ë¦­ ???ë‹¨ ?€?‰íŠ¸??ë°˜ì˜
      item.addEventListener('click', ()=>{
        if (passSelect){
          passSelect.value = `batch:${id}`;
          lastSelectedPass = passSelect.value;
          passSelect.dispatchEvent(new Event('change'));
        }
      });      
      passList.appendChild(item);
    }
    if(passSelect){
      const opt = document.createElement('option');
      opt.value = `batch:${id}`;
      opt.textContent = exp ? `${b.name} (??${cnt}, ë§Œë£Œ ${exp})` : `${b.name} (??${cnt})`;
      if (isZero) opt.classList.add('zero');
      passSelect.appendChild(opt);
    }
  });

  Object.entries(d.passes || {}).forEach(([k,v])=>{
    const cnt = getPassCount(v);
    const exp = (v && typeof v==='object' && v.expireAt) ? fmtDate(v.expireAt) : null;
    const line = exp ? `${k} Â· ?”ì—¬ ${cnt} Â· ë§Œë£Œ ${exp}` : `${k} Â· ?”ì—¬ ${cnt}`;
    const isZero = cnt <= 0;

    if(passList){
      const item = document.createElement('div');
      item.className = 'item pass-item' + (isZero ? ' zero' : '');
      item.textContent = line + '  [?ˆê±°??';
      item.dataset.kind = 'legacy';
      item.dataset.key  = k;
      item.addEventListener('click', ()=>{
        if (passSelect){
          passSelect.value = `legacy:${k}`;
          lastSelectedPass = passSelect.value;
          passSelect.dispatchEvent(new Event('change'));
        }
      });      
      passList.appendChild(item);
    }
    if(passSelect){
      const opt = document.createElement('option');
      opt.value = `legacy:${k}`;
      opt.textContent = exp ? `${k} (??${cnt}, ë§Œë£Œ ${exp})` : `${k} (??${cnt})`;
      if (isZero) opt.classList.add('zero');
      passSelect.appendChild(opt);
    }
  });

  // --- ? íƒê°?ë³µì› ---
  if (passSelect) {
    const hasPrev = Array.from(passSelect.options).some(o => o.value === prevSelected);
    passSelect.value = hasPrev ? prevSelected : (passSelect.options[0]?.value || '');
    lastSelectedPass = passSelect.value;
  }

  // --- ?¤í…Œ?´ì? ?…ë ¥ ?Œë” ---
  renderStageInputs(d.stages || {});
}

// ë¡œê·¸: ?€??+ ?•ì¥ ë©”í?(ì²˜ë¦¬???€???¸ë?) ?€??
async function addLog(type, extra = {}) {
  if (!currentMemberRef) return;
  try {
    await currentMemberRef.collection('logs').add({
      type,
      ...extra,                         // ?? { n: 3, name: 'ë¬´ë£Œê¶?, where:'batch', key:'...' }
      memberId: currentMemberRef.id,    // ?€???Œì›(?´ë???
      by: auth.currentUser?.uid || null,
      byEmail: auth.currentUser?.email || null,
      at: ts(),
    });
    // ëª©ë¡ ì¦‰ì‹œ ê°±ì‹ (ì²??˜ì´ì§€ë¥??¤ì‹œ ë¶ˆëŸ¬?¤ê¸°)
    await loadLogs(true);
  } catch (e) {
    console.error('addLog', e);
  }
}

// ???„ì—­ ì»¤ì„œ(?Œì¼ ?ë‹¨ ?ë‹¹???„ì¹˜??? ì–¸)
let __logsCursor = null;

// ??êµì²´: ?ì„¸ ?¬ë§· & ?˜ì´ì§€?¤ì´??ì§€??
async function loadLogs(reset = false) {
  if (!currentMemberRef || !logList) return;

  if (reset) {
    logList.innerHTML = '';
    __logsCursor = null;
  }
  // ì²??¸ì¶œ ??ë¡œë”© ?œì‹œ
  if (!__logsCursor && !logList.children.length) {
    logList.innerHTML = '<div class="muted">ë¡œê·¸ ë¶ˆëŸ¬?¤ëŠ” ì¤‘â€?/div>';
  }

  try {
    let q = currentMemberRef.collection('logs').orderBy('at', 'desc').limit(30);
    if (__logsCursor) q = q.startAfter(__logsCursor);

    const qs = await q.get();
    if (qs.empty) {
      // ?”ë³´ê¸?ë²„íŠ¼ ?œê±°
      removeLoadMoreButton();
      if (!logList.children.length) {
        logList.innerHTML = '<div class="muted">ë¡œê·¸ê°€ ?†ìŠµ?ˆë‹¤</div>';
      }
      return;
    }

    // ì²?ë¡œë”© ë¬¸êµ¬ ?œê±°
    if (logList.children.length === 1 && logList.firstChild?.classList?.contains('muted')) {
      logList.innerHTML = '';
    }

    const frag = document.createDocumentFragment();

    qs.docs.forEach((doc) => {
      const v = doc.data() || {};
      const when = v.at?.toDate?.()?.toLocaleString?.() || '-';
      const who  = v.byEmail || '(?Œìˆ˜?†ìŒ)';
      const row  = document.createElement('div');
      row.className = 'log-item';

      // ?€?…ë³„ ?¼ë²¨/?„ì´ì½?& ?ì„¸ ë©”ì‹œì§€
      const { icon, title, detail } = formatLogLine(v);

      row.innerHTML = `
        <div class="log-left">
          <span class="log-icon">${icon}</span>
          <div class="log-main">
            <div class="log-title">${title}</div>
            ${detail ? `<div class="log-detail muted">${detail}</div>` : ''}
          </div>
        </div>
        <div class="log-right">
          <div class="log-when">${when}</div>
          <div class="log-who muted">${who}</div>
        </div>
      `;
      frag.appendChild(row);
    });

    logList.appendChild(frag);

    // ì»¤ì„œ ê°±ì‹ 
    __logsCursor = qs.docs[qs.docs.length - 1];

    // ?œë” ë³´ê¸°??ë²„íŠ¼ ë³´ì´ê¸?ê°±ì‹ 
    addOrUpdateLoadMoreButton();

  } catch (e) {
    console.error('loadLogs', e);
    if (!logList.children.length) {
      logList.innerHTML = 'ë¡œê·¸ ë¡œë“œ ?¤íŒ¨: ' + e.message;
    }
  }
}

// ?€?…ë³„ ?¼ë²¨/?„ì´ì½??”í…Œ??êµ¬ì„±
function formatLogLine(v) {
  const t = (v.type || '').toLowerCase();
  // ê³µí†µ?ìœ¼ë¡?ì°¸ì¡°?????ˆëŠ” ?„ë“œ
  const n = v.n;
  const where = v.where;     // 'batch' | 'legacy'
  const key = v.key;         // ë°°ì¹˜ID ?ëŠ” ?ˆê±°????
  const name = v.name;       // ê¶Œì¢… ?´ë¦„(ë¬´ë£Œê¶??‰ì¼ë¬´ë£Œê¶?10?Œê¶Œ ??
  const expire = v.expire;   // 'YYYY-MM-DD' ë¬¸ì???ˆì„?˜ë„/?†ì„?˜ë„)

  switch (t) {
    case 'visit':
      return { icon: '?§¾', title: 'ë°©ë¬¸ 1??ê¸°ë¡', detail: null };
    case 'stamp_add_n':
      return { icon: 'â­?, title: `?¤íƒ¬??+${n}`, detail: v.via ? `ë°©ì‹: ${v.via}` : '' };
    case 'stamp_sub_n':
      return { icon: 'â­?, title: `?¤íƒ¬??-${n}`, detail: null };
    case 'stamp_reset':
      return { icon: '?»ï¸', title: '?¤íƒ¬??ì´ˆê¸°??0)', detail: null };
    case 'pass_add_batch':
      return { icon: '?«', title: `?¤íšŒê¶?ì¶”ê?: ${name} +${v.cnt}`, detail: expire ? `ë§Œë£Œ: ${expire}` : '' };
    case 'pass_use_n':
      return { icon: '??, title: `?¤íšŒê¶??¬ìš© -${n}`, detail: where === 'batch' ? `ë°°ì¹˜: ${key}` : `?ˆê±°?? ${key}` };
    case 'pass_add_n':
      return { icon: '??, title: `?¤íšŒê¶??˜ì› +${n}`, detail: where === 'batch' ? `ë°°ì¹˜: ${key}` : `?ˆê±°?? ${key}` };
    case 'pass_delete':
      return { icon: '?—‘ï¸?, title: '?¤íšŒê¶??? œ', detail: where === 'batch' ? `ë°°ì¹˜: ${key}` : `?ˆê±°?? ${key}` };
    case 'stages_save':
      return { icon: '?¯', title: '?¤í…Œ?´ì? ?€??, detail: 'ì§„í–‰ ?„í™© ?…ë°?´íŠ¸' };
    case 'free_slush_add_n':
      return { icon: '?§Š', title: `?¬ëŸ¬??ë¬´ë£Œê¶?+${n}`, detail: null };
    case 'free_slush_sub_n':
      return { icon: '?§Š', title: `?¬ëŸ¬??ë¬´ë£Œê¶?-${n}`, detail: null };
    case 'profile_save':
      return { icon: '?‘¤', title: '?„ë¡œ???€??, detail: `?´ë¦„/?€/?´ë©”??ì°¨ëŸ‰/ë¹„ê³  ?…ë°?´íŠ¸` };
    default:
      return { icon: '?“Œ', title: t || '?????†ëŠ” ?´ë²¤??, detail: JSON.stringify(v) };
  }
}

// ?œë” ë³´ê¸°??ë²„íŠ¼ ? í‹¸
function addOrUpdateLoadMoreButton() {
  // ?˜ë™ ë²„íŠ¼???´ë? ?ˆëŠ” ê²½ìš°(ê¶Œì¥) ???™ì  ë²„íŠ¼ ?ì„± ?ëµ
  if (document.getElementById('btnMoreLogs')) return;

  let btn = document.getElementById('__logsMore');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = '__logsMore';
    btn.type = 'button';
    btn.className = 'btn-more';
    btn.textContent = '??ë³´ê¸°';
    btn.addEventListener('click', () => loadLogs(false));
    logList.parentElement?.appendChild(btn);
  }
}

function removeLoadMoreButton() {
  const btn = document.getElementById('__logsMore');
  if (btn) btn.remove();
}

// [ì¶”ê?] QR ?¤ìº???´ê¸°
async function openQRScanner(){
  if(!isAdmin) return toast('?´ì˜???„ìš©');
  if(!qrModal || !qrVideo) return;

  if(!navigator.mediaDevices?.getUserMedia){
    return toast('ì¹´ë©”?¼ë? ?¬ìš©?????†ìŠµ?ˆë‹¤.');
  }

  try{
    qrModal.classList.remove('hidden');

    qrStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    qrVideo.srcObject = qrStream;
    await qrVideo.play();

    if(!qrDetector){
      toast('??ë¸Œë¼?°ì???QR ?¤ìº”(BarcodeDetector)??ì§€?í•˜ì§€ ?ŠìŠµ?ˆë‹¤. ?¬ë¡¬/?ˆë“œë¡œì´??ìµœì‹  ë²„ì „???´ìš©?˜ì„¸??');
      return;
    }

    qrScanRunning = true;
    const tick = async () => {
      if(!qrScanRunning) return;
      try{
        const codes = await qrDetector.detect(qrVideo);
        if(codes && codes.length){
          const raw = codes[0].rawValue || '';
          await handleScannedText(raw);
          stopQRScanner();
          return;
        }
      }catch(e){ /* noop */ }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

  }catch(e){
    console.error('qr open', e);
    toast('ì¹´ë©”???‘ê·¼ ?¤íŒ¨: ' + (e?.message || e));
    stopQRScanner();
  }
}

// [ì¶”ê?] QR ?¤ìº???«ê¸°
function stopQRScanner(){
  qrScanRunning = false;
  try{
    if(qrStream){
      qrStream.getTracks().forEach(t => t.stop());
      qrStream = null;
    }
    if(qrModal) qrModal.classList.add('hidden');
  }catch{}
}

// [?˜ì •] ?¤ìº” ê²°ê³¼ ì²˜ë¦¬ ???Œì› ?´ê³  ?¤íƒ¬??N ?…ë ¥
async function handleScannedText(text){
  try{
    // 1) URL???stamp=?¸ë“œ??ì¶”ì¶œ ?œë„
    let phone = null;
    try{
      const u = new URL(text);
      const sp = u.searchParams.get('stamp');
      if (sp) phone = canonPhone(sp);
    }catch{/* URL???„ë‹ˆë©?ë¬´ì‹œ */}

    // 2) ?«ìë§??ˆëŠ” QR?´ë©´ ê·??«ì?ì„œ ì¶”ì¶œ
    if (!phone) {
      const m = text.match(/(\d{9,12})/);
      if (m) phone = canonPhone(m[1]);
    }

    if (!phone) {
      toast('QR?ì„œ ?´ë???ë²ˆí˜¸ë¥?ì°¾ì? ëª»í–ˆ?µë‹ˆ??');
      return;
    }

    // ?Œì› ?´ê¸°
    await openMember(phone);

    // ?¤íƒ¬??N ?…ë ¥ & ?ë¦½
    const nRaw = prompt('?ë¦½???¤íƒ¬??ê°œìˆ˜ë¥??…ë ¥?˜ì„¸??, '1');
    const N = parseInt(nRaw || '0', 10);
    if (!Number.isFinite(N) || N <= 0 || !currentMemberRef) return;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};

      const s0 = d.stamp || 0;
      const total = s0 + N;
      const addFree = Math.floor(total / 10); // 10ê°œë‹¹ ë¬´ë£Œê¶???
      const s1 = total % 10;
      const totalVisits = (d.totalVisits || 0) + N;

      // ë¬´ë£Œê¶?ë°°ì¹˜) ì§€ê¸?
      const passBatches = { ...(d.passBatches || {}) };
      if (addFree > 0) {
        const id = newBatchId();
        passBatches[id] = {
          name: '?¤íƒ¬?„ì ë¦½ì¿ ??,
          count: addFree,
          expireAt: tsEndOfDayMonthsAhead(defaultExpireMonthsByName('?¤íƒ¬?„ì ë¦½ì¿ ??)),
        };
      }

      // ??DB ë°˜ì˜ (?„ë½?˜ì–´ ?ˆë˜ ë¶€ë¶?
      tx.update(currentMemberRef, {
        stamp: s1,
        passBatches,
        totalVisits,
        updatedAt: ts(),
      });
    });

    await addLog('stamp_add_n', { n: N, via: 'qr_live' });
    renderMember((await currentMemberRef.get()).data());
    toast(`?¤íƒ¬??${N}ê°??ë¦½ ?„ë£Œ`);
  } catch(e) {
    console.error('scan handle', e);
    toast('ì²˜ë¦¬ ?¤íŒ¨: ' + (e?.message || e));
  }
}




btnSaveStages?.addEventListener('click', async () => {
  if (!isAdmin) return toast('?´ì˜???„ìš©');
  if (!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');

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
    toast('?¤í…Œ?´ì? ?€???„ë£Œ');
  } catch (e) {
    console.error('save stages', e);
    toast('?€???¤íŒ¨: ' + (e?.message || e));
  }
});


// 11) ?„ë¡œ???€???´ë¦„/?€ëª?
btnSaveProfile?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('?´ì˜???„ìš©');
  if(!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');
   const name = editName?.value?.trim() || '';
   const team = editTeam?.value?.trim() || '';
   const car  = editCar?.value?.trim()  || '';
   const note = editNote?.value?.trim() || '';
   const email = editEmail?.value?.trim() || '';
   try{
     await currentMemberRef.update({ name, team, email, car, note, updatedAt: ts() });
    await addLog('profile_save', {name, team});
    const d = (await currentMemberRef.get()).data();
    renderMember(d);
    toast('?€???„ë£Œ');
  }catch(e){ console.error('saveProfile',e); toast('?€???¤íŒ¨: '+e.message); }
});

// 12) ?¤íƒ¬??ë¬´ë£Œê¶?(ê¸°ì¡´ +1 / -1 ?±ê²©)
btnAddVisit?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('?´ì˜???„ìš©'); if(!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');
  try{
await db.runTransaction(async(tx)=>{
  const snap=await tx.get(currentMemberRef);
  const d=snap.data()||{};

  let stamp=(d.stamp||0)+1;
  let total=(d.totalVisits||0)+1;

  // 10ê°??¬ì„± ?? ë¬´ë£Œê¶Œì„ "ë°°ì¹˜"ë¡?ì§€ê¸?
  const passBatches = { ...(d.passBatches || {}) };
  if (stamp >= 10) {
    stamp = 0;
    const id = newBatchId();
    passBatches[id] = {
      name: '?¤íƒ¬?„ì ë¦½ì¿ ??,
      count: 1,
      expireAt: tsEndOfDayMonthsAhead(defaultExpireMonthsByName('?¤íƒ¬?„ì ë¦½ì¿ ??)),
    };
  }

  tx.update(currentMemberRef, {
    stamp,
    passBatches,
    totalVisits: total,
    updatedAt: ts()
  });
});
    await addLog('visit');
    const d=(await currentMemberRef.get()).data(); renderMember(d);
  }catch(e){ console.error('addVisit',e); toast('?¤íŒ¨: '+e.message); }
});

btnResetStamp?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('?´ì˜???„ìš©'); if(!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');
  if(!confirm('?¤íƒ¬?„ë? 0?¼ë¡œ ì´ˆê¸°?”í• ê¹Œìš”?')) return;
  try{
    await currentMemberRef.update({ stamp:0, updatedAt: ts() });
    await addLog('stamp_reset');
    const d=(await currentMemberRef.get()).data(); renderMember(d);
  }catch(e){ console.error('resetStamp',e); toast('?¤íŒ¨: '+e.message); }
});

// 13) ?¤íšŒê¶?(ê¸°ì¡´ +/-1)
passPreset10?.addEventListener('click', ()=>{
  if(passName && passCount){
    passName.value='10?Œê¶Œ';
    passCount.value='10';
    setExpireDefaultByName('10?Œê¶Œ');
  }
});
passPreset20?.addEventListener('click', ()=>{
  if(passName && passCount){
    passName.value='20?Œê¶Œ';
    passCount.value='20';
    setExpireDefaultByName('20?Œê¶Œ');
  }
});

// ??ì¶”ê?: ì²?†Œ??10/20
passPresetY10?.addEventListener('click', ()=>{
  if(passName && passCount){
    passName.value='ì²?†Œ??10?Œê¶Œ';
    passCount.value='10';
    setExpireDefaultByName('ì²?†Œ??10?Œê¶Œ');
  }
});
passPresetY20?.addEventListener('click', ()=>{
  if(passName && passCount){
    passName.value='ì²?†Œ??20?Œê¶Œ';
    passCount.value='20';
    setExpireDefaultByName('ì²?†Œ??20?Œê¶Œ');
  }
});


// ê¶Œì¢…ëª??˜ë™ ?…ë ¥/ë³€ê²????ë™ ë§Œë£Œ??ì±„ìš°ê¸?(?¬ìš©?ê? ì§ì ‘ ? ì§œ ê³ ì¹˜ê¸??„ê¹Œì§€ë§?
passName?.addEventListener('change', ()=>{
  setExpireDefaultByName(passName.value || '');
});
passName?.addEventListener('input', ()=>{
  setExpireDefaultByName(passName.value || '');
});

btnAddPass?.addEventListener('click', async()=>{
  if(!isAdmin) return toast('?´ì˜???„ìš©'); 
  if(!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');

  const rawName  = (passName?.value || '').trim();          // ?? ë¬´ë£Œê¶?/ ?‰ì¼ë¬´ë£Œê¶?/ ?¤íšŒê¶?/ 10?Œê¶Œ / 20?Œê¶Œ ...
  const cnt      = parseInt(passCount?.value || '1', 10);
  const expireStr= document.getElementById('passExpire')?.value || '';
  if(!rawName || !(cnt > 0)) return toast('ê¶Œì¢…/?˜ëŸ‰ ?•ì¸');

  try{
    await db.runTransaction(async(tx)=>{
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};
      const passBatches = { ...(d.passBatches || {}) };

      // ???´ë¦„ê³??ê??†ì´ ??ƒ "??ë°°ì¹˜" ?ì„± (ë¬´ë£Œê¶??‰ì¼ë¬´ë£Œê¶??¬í•¨)
      const id = newBatchId();
      const batch = { name: rawName, count: cnt };
      if (expireStr){
        const dt = new Date(expireStr + 'T23:59:59');
        batch.expireAt = firebase.firestore.Timestamp.fromDate(dt);
      }
      passBatches[id] = batch;

      tx.update(currentMemberRef, { passBatches, updatedAt: ts() });
    });

    // ë¡œê·¸ (?´ë¦„/ë§Œë£Œ ?¬í•¨)
    await addLog('pass_add_batch', { name: rawName, cnt, expire: expireStr || null });

    // ?…ë ¥ê°?ì´ˆê¸°??
    if(passName)  passName.value  = '';
    if(passCount) passCount.value = '1';
    const pe = document.getElementById('passExpire'); 
    if (pe) pe.value = '';

    // ë¦¬ë Œ??
    renderMember((await currentMemberRef.get()).data());
    toast('ì¶”ê? ?„ë£Œ');
  }catch(e){
    console.error('addPass', e);
    toast('?¤íŒ¨: ' + (e?.message || e));
  }
});

// 14) === Nê°?ì¦ê° & ê¶Œì¢… ?? œ & ?Œì› ?? œ ===
function parsePosInt(el, def = 1) {
  const n = parseInt(el?.value ?? def, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}
function parseSelectedPassKey(){
  const raw = passSelect?.value || '';
  if (!raw) { toast('ê¶Œì¢…??? íƒ?˜ì„¸??); return null; }
  const i = raw.indexOf(':');
  if (i < 0) { toast('ê¶Œì¢… ? íƒê°’ì´ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤'); return null; }
  const kind = raw.slice(0, i);
  const key  = raw.slice(i + 1);
  if (!kind || !key) { toast('ê¶Œì¢… ? íƒê°’ì´ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤'); return null; }
  return { kind, key };
}




// ?¤íƒ¬??+N (10ë§ˆë‹¤ ë¬´ë£Œê¶??ë™ ?ë¦½)
btnAddStampN?.addEventListener('click', async () => {
  if(!isAdmin) return toast('?´ì˜???„ìš©'); if(!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');
  const N = parsePosInt(stampDelta, 1);
  try {
      // (ê¸°ì¡´) handleScannedText ?ˆì˜ ?¸ëœ??…˜ ë¶€ë¶?êµì²´
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(currentMemberRef);
        const d = snap.data() || {};
        const s0 = d.stamp || 0;
        const total = s0 + N;
        const addFree = Math.floor(total / 10);
        const s1 = total % 10;
        const totalVisits = (d.totalVisits || 0) + N;
      
        // ë¬´ë£Œê¶Œì? ë°°ì¹˜(passBatches)ë¡?ì§€ê¸?
        const passBatches = { ...(d.passBatches || {}) };
        if (addFree > 0) {
          const id = newBatchId();
          passBatches[id] = {
            name: '?¤íƒ¬?„ì ë¦½ì¿ ??,
            count: addFree,
            expireAt: tsEndOfDayMonthsAhead(defaultExpireMonthsByName('?¤íƒ¬?„ì ë¦½ì¿ ??)),
          };
        }
      
        // ???¤ì œë¡?ë¬¸ì„œë¥??…ë°?´íŠ¸?´ì•¼ ë°˜ì˜?©ë‹ˆ??
        tx.update(currentMemberRef, {
          stamp: s1,
          passBatches,
          totalVisits,
          updatedAt: ts()
        });
      });


    await addLog('stamp_add_n', { n: N });
    renderMember((await currentMemberRef.get()).data());
  } catch (e) { console.error('stamp +N', e); toast('?¤íŒ¨: ' + e.message); }
});

// ?¤íƒ¬??-N (ë¬´ë£Œê¶?ë³€???†ìŒ)
btnSubStampN?.addEventListener('click', async () => {
  if(!isAdmin) return toast('?´ì˜???„ìš©'); if(!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');
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
  } catch (e) { console.error('stamp -N', e); toast('?¤íŒ¨: ' + e.message); }
});


// ?¤íšŒê¶?-N
btnUsePassN?.addEventListener('click', async () => {
  if(!isAdmin) return toast('?´ì˜???„ìš©');
  if(!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');

  const sel = parseSelectedPassKey(); if(!sel) return;

  const N = parsePosInt(passDelta, 1);
  if(!(N > 0)) return toast('?˜ëŸ‰(N)???•ì¸?˜ì„¸??');

  try{
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};
      const nowMs = firebase.firestore.Timestamp.now().toMillis();

      if (sel.kind === 'batch') {
        const passBatches = { ...(d.passBatches || {}) };
        const b = passBatches[sel.key];
        if (!b) throw new Error('? íƒ??ë°°ì¹˜ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.');
        if (b.expireAt && b.expireAt.toMillis() < nowMs) throw new Error('ë§Œë£Œ??ë°°ì¹˜?…ë‹ˆ??');

        const cur = b.count || 0;
        if (cur < N) throw new Error('?”ì—¬ ?˜ëŸ‰??ë¶€ì¡±í•©?ˆë‹¤.');
        passBatches[sel.key] = { ...b, count: cur - N };

        tx.update(currentMemberRef, { passBatches, updatedAt: ts() });

      } else { // legacy
        const passes = { ...(d.passes || {}) };
        const prev = passes[sel.key];
        if (prev && typeof prev === 'object' && prev.expireAt && prev.expireAt.toMillis() < nowMs) {
          throw new Error('ë§Œë£Œ??ê¶Œì¢…?…ë‹ˆ??');
        }

        const cur = getPassCount(prev);
        if (cur < N) throw new Error('?”ì—¬ ?˜ëŸ‰??ë¶€ì¡±í•©?ˆë‹¤.');

        passes[sel.key] = setPassCount(prev, cur - N);
        tx.update(currentMemberRef, { passes, updatedAt: ts() });
      }
    });

    await addLog('pass_use_n', { where: sel.kind, key: sel.key, n: N });
    renderMember((await currentMemberRef.get()).data());

  } catch (e) {
    console.error('usePass -N', e);
    toast('?¤íŒ¨: ' + (e?.message || e));
  }
});



// ?¤íšŒê¶?+N
btnRefundPassN?.addEventListener('click', async () => {
  if(!isAdmin) return toast('?´ì˜???„ìš©');
  if(!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');

  const sel = parseSelectedPassKey(); // "batch:<id>" ?ëŠ” "legacy:<name>"
  if(!sel) return;

  const N = parsePosInt(passDelta, 1);
  if (!(N > 0)) return toast('?˜ëŸ‰(N)???•ì¸?˜ì„¸??');

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};

      if (sel.kind === 'batch') {
        // ??ë°°ì¹˜ +N
        const passBatches = { ...(d.passBatches || {}) };
        const b = passBatches[sel.key];
        if (!b) throw new Error('ë°°ì¹˜ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.');
        passBatches[sel.key] = { ...b, count: (b.count || 0) + N };
        tx.update(currentMemberRef, { passBatches, updatedAt: ts() });

      } else {
        // ???ˆê±°??+N
        const passes = { ...(d.passes || {}) };
        passes[sel.key] = setPassCount(passes[sel.key], getPassCount(passes[sel.key]) + N);
        tx.update(currentMemberRef, { passes, updatedAt: ts() });
      }
    });

    await addLog('pass_add_n', { where: sel.kind, key: sel.key, n: N });
    renderMember((await currentMemberRef.get()).data());

  } catch (e) {
    console.error('pass +N', e);
    toast('?¤íŒ¨: ' + (e?.message || e));
  }
});


// ê¶Œì¢… ?? œ(???ì²´ ?œê±°)
btnDeletePass?.addEventListener('click', async () => {
  if (!isAdmin) return toast('?´ì˜???„ìš©');
  if (!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');

  const sel = parseSelectedPassKey(); // { kind: 'batch'|'legacy', key: string }
  if (!sel) return;

  // ë³´ê¸° ì¢‹ì? ?•ì¸ë¬¸êµ¬ (? íƒ ?µì…˜ ?œì‹œ ?ìŠ¤???¬ìš©)
  const label = passSelect?.selectedOptions?.[0]?.textContent?.trim() || sel.key;
  if (!confirm(`'${label}' ë¥??? œ? ê¹Œ?? (?”ì—¬ ?˜ëŸ‰ê³??¨ê»˜ ?¬ë¼ì§‘ë‹ˆ??`)) return;

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(currentMemberRef);
      const d = snap.data() || {};

      if (sel.kind === 'batch') {
        const passBatches = { ...(d.passBatches || {}) };
        if (!passBatches[sel.key]) throw new Error('ë°°ì¹˜ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.');
        delete passBatches[sel.key];
        tx.update(currentMemberRef, { passBatches, updatedAt: ts() });

      } else {
        const passes = { ...(d.passes || {}) };
        if (!(sel.key in passes)) throw new Error('ê¶Œì¢…??ì°¾ì„ ???†ìŠµ?ˆë‹¤.');
        delete passes[sel.key];
        tx.update(currentMemberRef, { passes, updatedAt: ts() });
      }
    });

    await addLog('pass_delete', { where: sel.kind, key: sel.key });
    renderMember((await currentMemberRef.get()).data());
  } catch (e) {
    console.error('pass delete', e);
    toast('?¤íŒ¨: ' + (e?.message || e));
  }
});


// ?Œì› ?? œ (ë¬¸ì„œë§??? œ; logs ?œë¸Œì»¬ë ‰?˜ì? ? ì?)
btnDeleteMember?.addEventListener('click', async () => {
  if(!isAdmin) return toast('?´ì˜???„ìš©'); if(!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');
  const id = currentMemberRef.id;
  if(!confirm(`?Œì›(${id})???? œ? ê¹Œ?? (ë¡œê·¸ ?œë¸Œì»¬ë ‰?˜ì? ? ì?)`)) return;
  try {
    await currentMemberRef.delete();
    hideMemberPanel();
    await loadAllMembers();
    toast('?Œì› ?? œ ?„ë£Œ');
  } catch (e) { console.error('delete member', e); toast('?? œ ?¤íŒ¨: ' + e.message); }
});

// ?¬ëŸ¬??ë¬´ë£Œê¶?+N
btnAddFreeSlN?.addEventListener('click', async ()=>{
  if(!isAdmin) return toast('?´ì˜???„ìš©'); if(!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');
  const N = parsePosInt(freeSlDelta, 1);
  try{
    await currentMemberRef.update({ freeSlush: firebase.firestore.FieldValue.increment(N), updatedAt: ts() });
    await addLog('free_slush_add_n', { n:N });
    renderMember((await currentMemberRef.get()).data());
  }catch(e){ console.error('freeSlush +N',e); toast('?¤íŒ¨: '+e.message); }
});

// ?¬ëŸ¬??ë¬´ë£Œê¶?-N
btnSubFreeSlN?.addEventListener('click', async ()=>{
  if(!isAdmin) return toast('?´ì˜???„ìš©'); if(!currentMemberRef) return toast('?Œì›??ë¨¼ì? ? íƒ');
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
  }catch(e){ console.error('freeSlush -N',e); toast('?¤íŒ¨: '+e.message); }
});

// 15) ?ë‹˜ ???„í™˜ & ë§ˆì´?˜ì´ì§€ ë¡œë”©
function activateSelfTab(key){
  // ??ë²„íŠ¼ on/off
  selfTabsBar?.querySelectorAll('.tab').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.tab === key);
  });
  // ?¨ë„ show/hide
  Object.entries(selfTabPanes).forEach(([k,el])=>{
    el?.classList.toggle('active', k === key);
  });
}

async function loadSelf(user){
  // ê¸°ë³¸ ?? ?”ì•½
  activateSelfTab('summary');

  const cardEl = document.getElementById('selfCard');
  if(!cardEl) return;
  
  cardEl.innerHTML = '<div class="muted">ë¶ˆëŸ¬?¤ëŠ” ì¤‘â€?/div>';

  try{
    const email = user?.email || '';
    const m = email.match(/^(\d{9,12})@phone\.local$/);
    const phone = m ? m[1] : email.replace(/@.*/, '');

    // ??ê¸°ë³¸ ?•ë³´
    let snap = await db.collection('members').doc(phone).get();
    if(!snap.exists) snap = await db.collection('members').doc(email).get();
    if(!snap.exists){
      cardEl.innerHTML = '<div class="muted">?Œì› ?•ë³´ ?†ìŒ</div>';
      if(selfPassList) selfPassList.innerHTML = '';
      if(selfLogList)  selfLogList.innerHTML  = '';
      return;
    }
    const d = snap.data() || {};
const freeSum   = sumNamedValidBatches(d.passBatches, '?¤íƒ¬?„ì ë¦½ì¿ ??);
const freeWkSum = sumNamedValidBatches(d.passBatches, '?‰ì¼?´ìš©ê¶?);

// ??ê³µë°± ?œê±° ê¸°ì??¼ë¡œ ë¬´ë£Œê¶??ë‹¨
const isFreeType = (s) => {
  const n = (s || '').replace(/\s+/g,'');
  return n === '?¤íƒ¬?„ì ë¦½ì¿ ?? || n === '?‰ì¼?´ìš©ê¶?;
};

// ?« ?¤íšŒê¶?ì´??”ì—¬(ë¬´ë£Œê¶ŒÂ·í‰?¼ì´?©ê¶Œ ?œì™¸, ë°°ì¹˜+?ˆê±°???©ì‚°)
const passTotal =
  Object.values(d.passBatches || {}).reduce((acc, b) => {
    const name = (b?.name || '');
    if (isFreeType(name)) return acc;
    return acc + (b?.count || 0);
  }, 0) +
  Object.entries(d.passes || {}).reduce((acc, [k, v]) => {
    if (isFreeType(k)) return acc;
    return acc + getPassCount(v);
  }, 0);
 

// ?”ì•½ ë°•ìŠ¤ + ?„ì¥ ê²©ì(2?‰Ã???
    cardEl.innerHTML = `
      <div class="summary-box">
        <div class="summary-row top">
          <div class="summary-title">${d.name || '-'}</div>
          <div class="summary-badge">â­??¤íƒ¬??${d.stamp || 0}/10</div>
        </div>
        <div class="summary-row mid muted">
          ${fmtPhone(d.phone)} Â· ${d.team || '-'}
        </div>
 <div class="summary-row bottom perks">
   <span class="perk">?« ?¤íšŒê¶?<b>${passTotal}</b></span>
   <span class="perk">? ?¤íƒ¬??<b>${freeSum}</b></span>
   <span class="perk">?–ï¸??‰ì¼ <b>${freeWkSum}</b></span>
   <span class="perk">?§Š ?¬ëŸ¬??<b>${d.freeSlush||0}</b></span>
 </div>
      </div>
    
      <div id="selfStampGrid" class="stamp-grid"></div>
    
    <p class="stamp-note muted">?¤íƒ¬??10ê°œë? ì°ìœ¼ë©?ë¬´ë£Œ 1???œê³µ!</p>
  `;
    // === ?¬ê¸° ?¤ì— QR ì½”ë“œ ?ì„± ì¶”ê? ===
const qrTarget = document.getElementById('selfBigQR');
if (qrTarget) {
  qrTarget.innerHTML = '';
  const stampURL = `${window.location.origin}${window.location.pathname}?stamp=${encodeURIComponent(phone)}`;

  // QR ?ì„±(?”ë©´??120px)
  new QRCode(qrTarget, {
    text: stampURL,
    width: 120,
    height: 120,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  // ì¢Œìƒ???¤ìš´ë¡œë“œ ë²„íŠ¼ ?ì„±
  const dlBtn = document.createElement('button');
  dlBtn.type = 'button';
  dlBtn.className = 'qr-dl-btn';
  dlBtn.textContent = 'QR ?€??;
  dlBtn.title = 'ê³ í•´?ë„ QR ?€??;
  dlBtn.addEventListener('click', () => {
    const fname = `?í•‘ë°°í?-QR-${phone}.png`;
    downloadHighResQR(stampURL, fname, 1024); // ???´ìƒ???„ìš”??2048 ?±ìœ¼ë¡??˜ë¦¬ë©???
  });
  qrTarget.appendChild(dlBtn);
}


// ?½ê·„ ?„ì¥ ê²©ì (2?‰Ã???
    const grid = document.getElementById('selfStampGrid');
    if(grid){
      grid.innerHTML = '';
      const stampCount = d.stamp || 0;
      // ?„ë¡œ?íŠ¸ ë£¨íŠ¸??penguin.png ë¥??£ì–´ì£¼ì„¸??(ê²½ë¡œ ë°”ê¾¸ë©??„ë˜??ê°™ì´)
      const imgURL = './penguin.png';   // ë£¨íŠ¸ ê°?

      for(let i=0;i<10;i++){
        const cell = document.createElement('div');
        cell.className = 'stamp-slot' + (i < stampCount ? ' filled' : ' empty');
        if(i < stampCount){
          // ì±„ì›Œì§?ì¹? ?½ê·„ ?¼êµ´
          cell.style.setProperty('--stamp-url', `url("${imgURL}")`);
        }
        grid.appendChild(cell);
      }
    }


    // ?¤íšŒê¶?ëª©ë¡
// ?¤íšŒê¶?ëª©ë¡ (ë°°ì¹˜ + ?ˆê±°??ëª¨ë‘ ?œê¸°)
  // ?¤íšŒê¶?ëª©ë¡ (ë°°ì¹˜ + ?ˆê±°??ëª¨ë‘ ?œê¸°)
  if (selfPassList) {
    const frag = document.createDocumentFragment();
    const items = [];

    // 1) ë°°ì¹˜??
    Object.entries(d.passBatches || {}).forEach(([id, b]) => {
      const cnt = b?.count || 0;
      const exp = b?.expireAt ? fmtDate(b.expireAt) : null;
      items.push({ kind:'batch', name: b?.name || '(?´ë¦„?†ìŒ)', count: cnt, expire: exp });
    });

    // 2) ?ˆê±°?œí˜•
    Object.entries(d.passes || {}).forEach(([k, v]) => {
      const cnt = getPassCount(v);
      const exp = (v && typeof v === 'object' && v.expireAt) ? fmtDate(v.expireAt) : null;
      items.push({ kind:'legacy', name: k, count: cnt, expire: exp });
    });

    if (items.length === 0) {
      selfPassList.innerHTML = '<div class="muted">ë³´ìœ ???¤íšŒê¶Œì´ ?†ìŠµ?ˆë‹¤</div>';
    } else {
      // ë§Œë£Œ ?ˆëŠ” ê²?ë¨¼ì?, ? ì§œ ë¹ ë¥¸ ??
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

        // D-XX ê³„ì‚°
        let remainTxt = '';
        if (expire) {
          const expDate = new Date(expire);
          const now = new Date();
          const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
          remainTxt = diffDays >= 0
            ? `<span class="p-remain">D-${diffDays}</span>`
            : `<span class="p-remain expired">ë§Œë£Œ??/span>`;
        }

        row.innerHTML = `
          <span class="p-name">
            ?« ${name}
            ${expire ? `<span class="muted" style="font-weight:700;font-size:12px;">Â· ë§Œë£Œ ${expire}</span>` : ''}
          </span>
          <span class="p-count">${count}</span>
          ${remainTxt}
        `;
        frag.appendChild(row);
      });

      selfPassList.innerHTML = '';
      selfPassList.appendChild(frag);
    } // ??items if/else ?«í˜
  } // ??selfPassList if ?«í˜

  // ?ë‹˜ ?”ë©´: ?¤í…Œ?´ì? ê¸°ë¡ ë³´ê¸° (???´ê±´ ë°”ê¹¥?¼ë¡œ ë¹¼ëŠ” ê²??ˆì „)
  const btnView = byId('btnViewStages');
  if (btnView) {
    btnView.onclick = async () => {
      try {
        const snap2 = await db.collection('members').doc(phone).get();
        renderSelfStages(snap2.data() || {});
      } catch (e2) {
        console.error('view stages', e2);
        selfStageList.innerHTML = '<div class="muted">ê¸°ë¡??ë¶ˆëŸ¬?????†ìŠµ?ˆë‹¤</div>';
      }
    };
  }

} catch (e) { // ??loadSelf try/catch
  console.error('loadSelf', e);
  cardEl.innerHTML = 'ë¡œë“œ ?¤íŒ¨: ' + e.message;
  if (selfPassList) selfPassList.innerHTML = '';
  if (selfLogList)  selfLogList.innerHTML  = '';
}
}
// [ì¶”ê?] QR ?¤ìº” ë²„íŠ¼/?«ê¸° ë²„íŠ¼ ë°”ì¸??
btnQRScan?.addEventListener('click', openQRScanner);
qrClose  ?.addEventListener('click', stopQRScanner);
window.addEventListener('pagehide', stopQRScanner); // ?˜ì´ì§€ ? ë‚  ??ì¹´ë©”???•ë¦¬

console.log('app.js loaded: admin edit + visits + passes + logs + N-delta + deletions + self tabs');

// ???Œì›ëª©ë¡?ì„œ ? íƒ????ª© ?˜ì´?¼ì´??
if (adminList) {
  adminList.addEventListener('click', (e) => {
    const item = e.target.closest('.item');
    if (!item || !adminList.contains(item)) return;

    // ê¸°ì¡´ ? íƒ ?´ì œ
    adminList.querySelectorAll('.item.selected').forEach(el => el.classList.remove('selected'));

    // ?ˆë¡œ ? íƒ????ª© ê°•ì¡°
    item.classList.add('selected');
  });
}
// ===== ë§ˆìš°??? ë¡œ ?«ì ì¦ê° ë°”ì¸??=====
function bindWheelStep(input) {
  if (!input) return;
  input.addEventListener('wheel', (e) => {
    // ?˜ì´ì§€ ?¤í¬ë¡?ë°©ì?
    e.preventDefault();

    const stepAttr = parseFloat(input.getAttribute('step') || '1');
    const step = Number.isFinite(stepAttr) && stepAttr > 0 ? stepAttr : 1;

    // Shift ?¤ë¡œ x10 ê°€??(?í•˜ë©?ì£¼ì„ ?´ì œ)
    const delta = (e.deltaY < 0 ? +1 : -1) * (e.shiftKey ? 10 : 1) * step;

    const minAttr = input.getAttribute('min');
    const maxAttr = input.getAttribute('max');
    const min = minAttr != null ? parseFloat(minAttr) : -Infinity;
    const max = maxAttr != null ? parseFloat(maxAttr) : +Infinity;

    const cur = parseFloat(input.value || '0') || 0;
    let next = cur + delta;

    // ë°˜ì˜¬ë¦??¤ì°¨ ë³´ì •
    next = Math.round((next + Number.EPSILON) * 1000) / 1000;

    if (next < min) next = min;
    if (next > max) next = max;

    input.value = String(next);
    // ?…ë ¥ê°?ë³€ê²??´ë²¤??ë°œí–‰(?„ìš” ???¤ë¥¸ ë¡œì§???£ê²Œ ??
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { passive: false });
}

// ê´€ë¦¬ì ?…ë ¥ ?„ë“œ?¤ì— ë°”ì¸??
bindWheelStep(document.getElementById('stampDelta'));   // ?¤íƒ¬??N
bindWheelStep(document.getElementById('freeSlDelta'));  // ?¬ëŸ¬??N
bindWheelStep(document.getElementById('passCount'));    // ì¶”ê? ?˜ëŸ‰
bindWheelStep(document.getElementById('passDelta'));    // ì¦ê° N
