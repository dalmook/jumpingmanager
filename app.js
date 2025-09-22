// ==========================
// File: app.js
// Purpose: GitHub Pages + Firebase 멤버 관리 (관리자/손님) - 캔버스 최신 HTML에 맞춘 JS
// ==========================

/* 1) Firebase 설정값 채우기 (콘솔 > 프로젝트 설정 > 일반에서 복사) */
const firebaseConfig = {
  apiKey: "AIzaSyD9tP0HnP3S8X82NoZXQ5DPwoigoHJ-zfU",
  authDomain: "jumpingmanager-dcd21.firebaseapp.com",
  projectId: "jumpingmanager-dcd21",
  storageBucket: "jumpingmanager-dcd21.firebasestorage.app",
  messagingSenderId: "286929980468",
  appId: "G-4CJN8R3XQ4"
};
// --- 초기화
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* 2) 디버그 패널: 콘솔/에러를 화면으로도 확인 (태블릿 편의) */
(function debugPanel() {
  const $ = (id) => document.getElementById(id);
  const area = () => $("__dbgArea");
  const panel = () => $("__dbgPanel");

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
              if (typeof a === "string") return a;
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(" ");
      el.value += (el.value ? "\n" : "") + line;
      el.scrollTop = el.scrollHeight;
    } catch (_) {}
  }

  // 버튼
  window.addEventListener("DOMContentLoaded", () => {
    $("__dbgToggle")?.addEventListener("click", () => panel()?.classList.toggle("hidden"));
    $("__dbgClose")?.addEventListener("click", () => panel()?.classList.add("hidden"));
    $("__dbgClear")?.addEventListener("click", () => {
      if (area()) area().value = "";
    });
    $("__dbgCopy")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(area()?.value || "");
        alert("복사됨");
      } catch (e) {
        alert("복사 실패: " + (e?.message || e));
      }
    });
  });

  // console 프록시
  const _log = console.log.bind(console);
  const _warn = console.warn.bind(console);
  const _err = console.error.bind(console);
  console.log = (...args) => {
    write("LOG", ...args);
    _log(...args);
  };
  console.warn = (...args) => {
    write("WARN", ...args);
    _warn(...args);
  };
  console.error = (...args) => {
    write("ERROR", ...args);
    _err(...args);
  };

  // 전역 오류
  window.addEventListener("error", (e) => write("UNCAUGHT", e?.message || e?.error || e));
  window.addEventListener("unhandledrejection", (e) =>
    write("REJECTION", e?.reason?.message || e?.reason || e)
  );

  // 전역 try 헬퍼(원하면 사용)
  window.__dbgTry = async (label, fn) => {
    try {
      return await fn();
    } catch (e) {
      console.error(label, e?.message || e, e);
      alert(`[${label}] 오류: ${e?.message || e}`);
      throw e;
    }
  };
})();

/* 3) 유틸 & DOM 안전 접근자 */
const $ = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);
const setHTML = (id, html) => {
  const el = byId(id);
  if (el) el.innerHTML = html;
};
const setText = (id, text) => {
  const el = byId(id);
  if (el) el.textContent = text;
};
const normPhone = (p) => (p || "").replace(/\D/g, "");
const fmtPhone = (p) => {
  const s = normPhone(p);
  if (s.length === 11) return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`;
  return s || "-";
};
const sumPass = (passes) => Object.values(passes || {}).reduce((a, b) => a + (b || 0), 0);
const toast = (m) => alert(m);

/* 4) 관리자 이메일 목록 (간단 권한 분기) */
const adminEmails = ["chosungmook@naver.com"]; // 필요 시 추가

/* 5) HTML 요소 참조 (캔버스 최신본 기준) */
const signedOut = byId("signedOut");
const signedIn = byId("signedIn");
const whoami = byId("whoami");
const btnLogin = byId("btnLogin");
const btnSignup = byId("btnSignup");
const btnLogout = byId("btnLogout");

// 관리자/손님 패널
const adminPanel = byId("adminPanel"); // 내부에 allMembers만 존재
const allMembers = byId("allMembers");

const memberSelf = byId("memberSelf");
const selfCard = byId("selfCard");

/* 6) 인증 상태 */
let isAdmin = false;

auth.onAuthStateChanged(async (user) => {
  console.log("onAuthStateChanged:", !!user, user?.email);

  if (user) {
    signedOut?.classList.add("hidden");
    signedIn?.classList.remove("hidden");
    setText("whoami", user.email || "");

    // 관리자 여부
    isAdmin = adminEmails.includes(user.email || "");
    adminPanel?.classList.toggle("hidden", !isAdmin);
    memberSelf?.classList.toggle("hidden", isAdmin);

    try {
      if (isAdmin) {
        await loadAllMembers();
      } else {
        await loadSelf(user);
      }
    } catch (e) {
      console.error("initial load error", e);
    }
  } else {
    signedOut?.classList.remove("hidden");
    signedIn?.classList.add("hidden");
    adminPanel?.classList.add("hidden");
    memberSelf?.classList.add("hidden");
    setText("whoami", "");
  }
});

/* 7) 로그인/가입/로그아웃 */
btnLogin?.addEventListener("click", async () => {
  const email = byId("loginEmail")?.value?.trim();
  const pass = byId("loginPass")?.value?.trim();
  if (!email || !pass) return toast("이메일/비밀번호를 입력하세요.");
  await __dbgTry("login", async () => {
    await auth.signInWithEmailAndPassword(email, pass);
  });
  toast("로그인 성공");
});

btnSignup?.addEventListener("click", async () => {
  const email = byId("loginEmail")?.value?.trim();
  const pass = byId("loginPass")?.value?.trim();
  if (!email || !pass) return toast("이메일/비밀번호를 입력하세요.");
  await __dbgTry("signup", async () => {
    // 계정 생성
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    console.log("signup user uid:", cred.user?.uid);

    // 멤버 문서 생성 (DocID: phone 우선, 없으면 email)
    const phone = email.replace(/@.*/, "");
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const ref = db.collection("members").doc(phone || email);

    // 이미 있으면 건너뛰고, 없으면 생성
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

/* 8) 데이터 로드: 관리자/손님 */
async function loadAllMembers() {
  if (!allMembers) return;

  setHTML("allMembers", `<div class="muted">불러오는 중…</div>`);
  await __dbgTry("loadAllMembers", async () => {
    // createdAt 또는 updatedAt 정렬 가능한 필드가 없을 수도 있어 orderBy 제거(최대 200)
    const qs = await db.collection("members").limit(200).get();
    if (qs.empty) {
      setHTML("allMembers", `<div class="muted">회원이 없습니다.</div>`);
      return;
    }
    const frag = document.createDocumentFragment();
    qs.forEach((doc) => {
      const d = doc.data() || {};
      const div = document.createElement("div");
      div.className = "item";
      div.textContent = `${d.name || "-"} · ${fmtPhone(d.phone)} · 스탬프:${d.stamp || 0}/10 · 무료:${
        d.freeCredits || 0
      } · 다회권:${sumPass(d.passes || {})}`;
      frag.appendChild(div);
    });
    allMembers.innerHTML = "";
    allMembers.appendChild(frag);
  });
}

async function loadSelf(user) {
  if (!selfCard) return;

  setHTML("selfCard", `<div class="muted">불러오는 중…</div>`);
  await __dbgTry("loadSelf", async () => {
    const email = user?.email || "";
    const phone = email.replace(/@.*/, "");

    // phone Doc 우선 → 없으면 email Doc
    let snap = await db.collection("members").doc(phone).get();
    if (!snap.exists) {
      snap = await db.collection("members").doc(email).get();
    }
    if (!snap.exists) {
      setHTML(
        "selfCard",
        `<div class="muted">회원 정보가 없습니다. 관리자에게 등록을 요청해 주세요.</div>`
      );
      return;
    }
    const d = snap.data() || {};
    const passStr =
      Object.entries(d.passes || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ") || "-";

    setHTML(
      "selfCard",
      `
      <div><b>${d.name || "-"}</b> (${fmtPhone(d.phone)})</div>
      <div>팀: ${d.team || "-"}</div>
      <div>스탬프: ${d.stamp || 0}/10</div>
      <div>무료권: ${d.freeCredits || 0}</div>
      <div>다회권: ${passStr}</div>
    `.trim()
    );
  });
}

/* 9) 초기 로그 */
console.log("app.js loaded. HTML bindings ready.");

