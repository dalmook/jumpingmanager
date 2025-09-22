// ==========================
// File: app.js (관리자 기본 목록 + 검색 + 등록/수정 + 안전가드 + 디버그)
// ==========================
/* global firebase */

// 1) Firebase 설정값 채우기 (콘솔 > 프로젝트 설정 > 일반)
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

// 2) 디버그 패널 연동 (있으면 씀)
(function () {
  const area = () => document.getElementById("__dbgArea");
  function stamp() {
    const d = new Date();
    return d.toLocaleString() + "." + String(d.getMilliseconds()).padStart(3, "0");
  }
  function write(kind, ...args) {
    try {
      const el = area();
      if (!el) return;
      const line =
        `[${stamp()}] ${kind}: ` +
        args
          .map((a) => {
            try {
              return typeof a === "string" ? a : JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(" ");
      el.value += (el.value ? "\n" : "") + line;
      el.scrollTop = el.scrollHeight;
    } catch {}
  }
  const _log = console.log.bind(console);
  const _warn = console.warn.bind(console);
  const _err = console.error.bind(console);
  console.log = (...a) => {
    write("LOG", ...a);
    _log(...a);
  };
  console.warn = (...a) => {
    write("WARN", ...a);
    _warn(...a);
  };
  console.error = (...a) => {
    write("ERROR", ...a);
    _err(...a);
  };
  window.addEventListener("error", (e) => write("UNCAUGHT", e?.message || e));
  window.addEventListener("unhandledrejection", (e) =>
    write("REJECTION", e?.reason?.message || e?.reason)
  );

  // 전역 try 헬퍼 (원하면 호출)
  window.__dbgTry = async (label, fn) => {
    try {
      return await fn();
    } catch (e) {
      console.error(`[${label}]`, e?.message || e, e);
      alert(`[${label}] 오류: ${e?.message || e}`);
      throw e;
    }
  };
})();

// 3) 유틸/안전 가드
const $ = (s) => document.querySelector(s);
const byId = (id) => document.getElementById(id);
const setHTML = (id, html) => {
  const el = byId(id);
  if (!el) {
    console.warn(`[missing-el] #${id} 가 없어 innerHTML 생략`);
    return;
  }
  el.innerHTML = html;
};
const setText = (id, text) => {
  const el = byId(id);
  if (!el) {
    console.warn(`[missing-el] #${id} 가 없어 textContent 생략`);
    return;
  }
  el.textContent = text;
};
const toast = (m) => alert(m);
const normPhone = (p) => (p || "").replace(/\D/g, "");
const sumPass = (p) => Object.values(p || {}).reduce((a, b) => a + (b || 0), 0);

// 4) 권한 (간단 버전: 이메일 화이트리스트)
const adminEmails = ["chosungmook@naver.com"]; // 필요시 추가

// 5) DOM 참조
// 인증
const signedOut = byId("signedOut");
const signedIn = byId("signedIn");
const whoami = byId("whoami");
const btnLogin = byId("btnLogin");
const btnSignup = byId("btnSignup");
const btnLogout = byId("btnLogout");

// 관리자 패널/검색/목록 컨테이너
const adminPanel = byId("adminPanel");
const adminList = byId("adminList"); // 전체/검색 결과 표시 영역
const searchPhone = byId("searchPhone");
const btnSearch = byId("btnSearch");
const btnLoadAll = byId("btnLoadAll");

// 회원 등록 입력/버튼
const regName = byId("regName");
const regPhone = byId("regPhone");
const regTeam = byId("regTeam");
const btnRegister = byId("btnRegister");

// 손님 마이페이지
const memberSelf = byId("memberSelf");
const selfCard = byId("selfCard");

let isAdmin = false;

// 6) Auth 상태 감시
auth.onAuthStateChanged(async (user) => {
  console.log("onAuthStateChanged", !!user, user?.email);
  if (user) {
    signedOut?.classList.add("hidden");
    signedIn?.classList.remove("hidden");
    setText("whoami", user.email || "");

    isAdmin = adminEmails.includes(user.email || "");
    adminPanel?.classList.toggle("hidden", !isAdmin);
    memberSelf?.classList.toggle("hidden", isAdmin);

    try {
      if (isAdmin) {
        await loadAllMembers(); // 관리자 로그인 시 기본 전체 목록
      } else {
        await loadSelf(user);
      }
    } catch (e) {
      console.error("initial load", e);
    }
  } else {
    signedOut?.classList.remove("hidden");
    signedIn?.classList.add("hidden");
    adminPanel?.classList.add("hidden");
    memberSelf?.classList.add("hidden");
    setText("whoami", "");
  }
});

// 7) 로그인/회원가입/로그아웃
btnLogin?.addEventListener("click", async () => {
  const email = byId("loginEmail")?.value?.trim();
  const pass = byId("loginPass")?.value?.trim();
  if (!email || !pass) return toast("이메일/비밀번호를 입력하세요.");
  await __dbgTry("login", () => auth.signInWithEmailAndPassword(email, pass));
  toast("로그인 성공");
});

btnSignup?.addEventListener("click", async () => {
  const email = byId("loginEmail")?.value?.trim();
  const pass = byId("loginPass")?.value?.trim();
  if (!email || !pass) return toast("이메일/비밀번호를 입력하세요.");
  await __dbgTry("signup", async () => {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    console.log("signup uid", cred.user?.uid);
    // 기본 멤버 문서 생성 (DocID: phone 우선, 없으면 email)
    const phone = email.replace(/@.*/, "");
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const ref = db.collection("members").doc(phone || email);
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
  });
  toast("회원가입 완료");
});

btnLogout?.addEventListener("click", async () => {
  await __dbgTry("logout", () => auth.signOut());
  toast("로그아웃되었습니다.");
});

// 8) 관리자: 회원 등록/수정
btnRegister?.addEventListener("click", async () => {
  if (!isAdmin) return toast("운영자 전용 기능입니다.");
  if (!regName || !regPhone) {
    console.warn("[missing-el] reg inputs");
    return;
  }
  const name = regName.value.trim();
  const phone = normPhone(regPhone.value);
  const team = regTeam?.value?.trim() || "";
  if (!name || !phone) return toast("이름과 휴대폰번호(숫자)를 입력하세요.");

  const now = firebase.firestore.FieldValue.serverTimestamp();
  const ref = db.collection("members").doc(phone);
  console.log("register/update", { name, phone, team });
  await __dbgTry("registerOrUpdate", async () => {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        tx.update(ref, { name, team, updatedAt: now });
      } else {
        tx.set(ref, {
          name,
          phone,
          team,
          stamp: 0,
          freeCredits: 0,
          passes: {},
          totalVisits: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    });
  });
  toast("등록/수정 완료");
  // 목록 갱신 (컨테이너가 있을 때만)
  if (adminList) await loadAllMembers();
});

// 9) 관리자: 전체 목록 로드 (100건)
async function loadAllMembers() {
  if (!adminList) {
    console.warn("[missing-el] #adminList 가 없어 목록 표시를 생략합니다.");
    return;
  }
  adminList.innerHTML = '<div class="muted">불러오는 중…</div>';
  await __dbgTry("loadAllMembers", async () => {
    let qs;
    try {
      qs = await db.collection("members").orderBy("updatedAt", "desc").limit(100).get();
    } catch (e) {
      // 일부 문서에 updatedAt이 없거나 인덱스 문제 시 phone 기준 대체
      qs = await db.collection("members").orderBy("phone").limit(100).get();
    }
    if (qs.empty) {
      adminList.innerHTML = '<div class="muted">회원이 없습니다.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    qs.forEach((doc) => {
      const d = doc.data() || {};
      const div = document.createElement("div");
      div.className = "item";
      div.textContent = `${d.name || "-"} · ${d.phone || ""} · 스탬프:${d.stamp || 0}/10 · 무료:${
        d.freeCredits || 0
      } · 다회:${sumPass(d.passes || {})}`;
      frag.appendChild(div);
    });
    adminList.innerHTML = "";
    adminList.appendChild(frag);
  });
}

// 10) 관리자: 검색 (전체번호/끝 4자리)
async function searchMembers() {
  if (!adminList) return;
  const raw = (searchPhone?.value || "").trim();
  const q = raw.replace(/\D/g, ""); // 숫자만
  if (!q) return loadAllMembers();

  adminList.innerHTML = '<div class="muted">검색 중…</div>';
  await __dbgTry("searchMembers", async () => {
    let docs = [];
    if (q.length >= 7) {
      // 충분히 길면 정확 DocID 조회 우선 (members/{phone})
      const snap = await db.collection("members").doc(q).get();
      if (snap.exists) {
        docs = [snap];
      } else {
        // 없으면 phone prefix 검색
        const qs = await db
          .collection("members")
          .orderBy("phone")
          .startAt(q)
          .endAt(q + "\uf8ff")
          .limit(50)
          .get();
        docs = qs.docs;
      }
    } else {
      // 끝 4자리 등 짧은 검색 → 클라 필터
      const qs = await db.collection("members").orderBy("phone").limit(500).get();
      docs = qs.docs.filter((d) => (d.data().phone || "").endsWith(q));
    }

    if (!docs.length) {
      adminList.innerHTML = '<div class="muted">검색 결과가 없습니다.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    docs.forEach((doc) => {
      const d = doc.data() || {};
      const div = document.createElement("div");
      div.className = "item";
      div.textContent = `${d.name || "-"} · ${d.phone || ""} · 스탬프:${d.stamp || 0}/10 · 무료:${
        d.freeCredits || 0
      } · 다회:${sumPass(d.passes || {})}`;
      frag.appendChild(div);
    });
    adminList.innerHTML = "";
    adminList.appendChild(frag);
  });
}

// 11) 검색 이벤트 바인딩
btnSearch?.addEventListener("click", searchMembers);
btnLoadAll?.addEventListener("click", loadAllMembers);
searchPhone?.addEventListener("keyup", (e) => {
  if (e.key === "Enter") searchMembers();
});

// 12) 손님: 내 정보
async function loadSelf(user) {
  if (!selfCard) {
    console.warn("[missing-el] #selfCard 가 없어 마이페이지 표시를 생략합니다.");
    return;
  }
  selfCard.innerHTML = '<div class="muted">불러오는 중…</div>';
  await __dbgTry("loadSelf", async () => {
    const email = user?.email || "";
    const phone = email.replace(/@.*/, "");

    let snap = await db.collection("members").doc(phone).get();
    if (!snap.exists) snap = await db.collection("members").doc(email).get();

    if (!snap.exists) {
      selfCard.innerHTML =
        '<div class="muted">회원 정보가 없습니다. 관리자에게 등록을 요청해 주세요.</div>';
      return;
    }
    const d = snap.data() || {};
    const passStr =
      Object.entries(d.passes || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ") || "-";

    selfCard.innerHTML = `
      <div><b>${d.name || "-"}</b> (${d.phone || ""})</div>
      <div>팀: ${d.team || "-"}</div>
      <div>스탬프: ${d.stamp || 0}/10</div>
      <div>무료권: ${d.freeCredits || 0}</div>
      <div>다회권: ${passStr}</div>
    `;
  });
}

console.log("app.js loaded: admin default list + search + register/update + safe guards");
