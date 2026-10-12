import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, addDoc, doc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { mountFeed } from "/helpers/feed.js";

import { firebaseConfig } from "/helpers/configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const staffRoles = [
  "simplestaff",
  "modstaff",
  "advstaff",
  "advstaffplus",
  "superadmin"
];

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");
const logoutBtn = document.getElementById("logoutBtn");
const assocList = document.getElementById("assocList");

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login/";
});

async function loadMemberships(uid) {
  const snap = await getDocs(query(collection(db, "associations"), where("stato", "==", "approvata")));

  const memberships = await Promise.all(snap.docs.map(async (d) => {
    try {
      const memberSnap = await getDoc(doc(db, "associations", d.id, "members", uid));
      if (!memberSnap.exists()) return null;

      return { ...memberSnap.data(), id: d.id, name: d.data().nome || "Associazione" };
    } catch (error) {
      console.error("Errore lettura appartenenza:", error);
      return null;
    }
  }));

  return memberships.filter(Boolean);
}

function renderManageLinks(m) {
  const box = document.getElementById("manageLinks");
  box.innerHTML = "";

  const permissions = m.permessi || [];
  const links = [];

  if (m.role === "referente" && permissions.includes("pagina")) {
    links.push(["Modifica la pagina", `/association/dashboard/page/?assoc=${encodeURIComponent(m.id)}`]);
  }

  if (m.role === "referente" && permissions.includes("membri")) {
    links.push(["Gestisci le richieste", `/association/dashboard/members/?assoc=${encodeURIComponent(m.id)}`]);
  }

  links.forEach(([label, href]) => {
    const a = document.createElement("a");
    a.className = "manage-link";
    a.href = href;
    a.textContent = label;
    box.appendChild(a);
  });

  box.hidden = links.length === 0;
}

function showFeed(confirmed, user, userName) {
  document.getElementById("feedSection").hidden = false;

  const tabs = document.getElementById("assocTabs");
  const root = document.getElementById("feedRoot");
  tabs.innerHTML = "";

  const select = (m, btn) => {
    tabs.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
    renderManageLinks(m);

    return mountFeed(root, {
      db,
      user,
      userName,
      associationId: m.id,
      role: m.role,
      canPost: m.role === "referente",
      canModerate: false
    });
  };

  let firstBtn = null;

  confirmed.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.textContent = m.name;
    btn.addEventListener("click", () => select(m, btn));
    tabs.appendChild(btn);

    if (!firstBtn) firstBtn = btn;
  });

  return select(confirmed[0], firstBtn);
}

function showPending(pending) {
  document.getElementById("pendingBox").hidden = false;
  document.getElementById("wipTitle").textContent = "Richiesta in attesa";
  document.getElementById("wipText").textContent = "L'associazione deve ancora confermare la tua richiesta. Appena sarà accettata potrai accedere alla bacheca.";

  assocList.innerHTML = "";

  pending.forEach((m) => {
    const li = document.createElement("li");

    const link = document.createElement("a");
    link.href = `/associations/view/?id=${encodeURIComponent(m.id)}`;
    link.textContent = m.name;
    li.appendChild(link);

    const role = document.createElement("span");
    role.className = "assoc-role";
    role.textContent = " — richiesta in attesa";
    li.appendChild(role);

    assocList.appendChild(li);
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login/";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));

    if (!userSnap.exists()) {
      clearTimeout(timeoutId);
      setStatus("Profilo non trovato.", "error");
      window.location.href = "/login/";
      return;
    }

    const userData = userSnap.data();

    if (userData.accountType === "association") {
      window.location.href = "/association/dashboard/";
      return;
    }

    addDoc(collection(db, "viewedPages"), {
      type: "page_view",
      timestamp: serverTimestamp(),
      userId: user.uid,
      page: window.location.pathname
    }).catch((error) => console.error("Errore viewedPages:", error));

    initBottomNav(userData, user, "user");

    if (staffRoles.includes(userData.role)) {
      const staffLinkEl = document.querySelector(".navbar");
      const br = document.createElement("br");
      const link = document.createElement("a");
      link.href = "/staff/dashboard/";
      link.textContent = "Passa alla dashboard staff";
      staffLinkEl.appendChild(br);
      staffLinkEl.appendChild(link);
    }

    const memberships = await loadMemberships(user.uid);
    const confirmed = memberships.filter((m) => m.stato === "confermata");
    const pending = memberships.filter((m) => m.stato === "richiesta");

    if (confirmed.length === 0 && pending.length === 0) {
      clearTimeout(timeoutId);
      window.location.replace("/associations/");
      return;
    }

    const userName = `${userData.name || ""} ${userData.surname || ""}`.trim() || userData.username || "Utente";

    if (confirmed.length > 0) {
      await showFeed(confirmed, user, userName);
    } else {
      showPending(pending);
    }

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  } catch (error) {
    console.error("Errore durante il caricamento:", error);
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    setStatus("Errore nel caricamento dell'area volontari.", "error");
  }
});