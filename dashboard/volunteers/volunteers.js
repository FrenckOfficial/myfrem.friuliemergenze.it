import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, addDoc, deleteDoc, doc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { mountFeed } from "/helpers/feed.js";
import { firebaseConfig } from "/helpers/configFirebase.js";
import { addStaffLink } from "/helpers/loadNavbar.js";
import { expiringCount } from "/dashboard/volunteers/catalog.js";
import { shouldTrackPageView } from "/helpers/pageViews.js";

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
const leaveBox = document.getElementById("leaveBox");

let currentUser = null;
let isLeaving = false;

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

  if (m.role === "referente" && (permissions.includes("turni") || permissions.includes("membri"))) {
    links.push(["Gestisci i turni", `/association/dashboard/shifts/?assoc=${encodeURIComponent(m.id)}`]);
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

function openLeaveModal(m, labels) {
  const modal = document.createElement("div");
  modal.className = "modal active";

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const container = document.createElement("div");
  container.className = "modal-container";

  const step = document.createElement("div");
  step.className = "modal-step active";

  const header = document.createElement("div");
  header.className = "modal-header";
  const title = document.createElement("h2");
  title.textContent = labels.title;
  header.appendChild(title);

  const body = document.createElement("div");
  body.className = "modal-content";
  const text = document.createElement("p");
  text.textContent = labels.question.replace("{name}", m.name);
  body.appendChild(text);

  const footer = document.createElement("div");
  footer.className = "modal-footer";
  const group = document.createElement("div");
  group.className = "button-group";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn-modal btn-back";
  cancelBtn.textContent = "Annulla";

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "btn-modal danger";
  confirmBtn.textContent = labels.yes;

  group.append(cancelBtn, confirmBtn);
  footer.appendChild(group);
  step.append(header, body, footer);
  container.appendChild(step);
  modal.append(overlay, container);
  document.body.appendChild(modal);

  const close = () => {
    if (isLeaving) return;
    document.removeEventListener("keydown", onKey);
    modal.remove();
  };

  const onKey = (e) => {
    if (e.key === "Escape") close();
  };

  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", close);
  cancelBtn.addEventListener("click", close);

  confirmBtn.addEventListener("click", async () => {
    if (isLeaving || !currentUser) return;

    isLeaving = true;
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = "Attendi...";

    try {
      await deleteDoc(doc(db, "associations", m.id, "members", currentUser.uid));
      setStatus(labels.done, "success");
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      console.error("Errore uscita dall'associazione:", error);
      setStatus("Non è stato possibile completare l'operazione. Riprova.", "error");
      isLeaving = false;
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = labels.yes;
    }
  });

  confirmBtn.focus();
}

function buildLeaveControl(container, m, labels) {
  container.innerHTML = "";

  const askBtn = document.createElement("button");
  askBtn.type = "button";
  askBtn.className = "leave-btn";
  askBtn.textContent = labels.ask;
  askBtn.addEventListener("click", () => openLeaveModal(m, labels));

  container.appendChild(askBtn);
}

function renderLeave(m) {
  leaveBox.hidden = false;

  buildLeaveControl(leaveBox, m, {
    ask: "Lascia l'associazione",
    title: "Lascia l'associazione",
    question: "Vuoi davvero lasciare {name}? Non vedrai più la bacheca e per rientrare dovrai fare una nuova richiesta.",
    yes: "Sì, lascia",
    done: "Hai lasciato l'associazione."
  });
}

function showFeed(confirmed, user, userData, userName) {
  document.getElementById("feedSection").hidden = false;

  const tabs = document.getElementById("assocTabs");
  const root = document.getElementById("feedRoot");
  tabs.replaceChildren();

  const memberships = confirmed.map((m) => ({ id: m.id, name: m.name, role: m.role }));
  const author = { name: userName, photoURL: userData.photoURL || "" };
  const readOnly = userData.role === "testacc";

  const select = (m, btn) => {
    tabs.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));

    if (m) {
      renderManageLinks(m);
      renderLeave(m);
    } else {
      document.getElementById("manageLinks").hidden = true;
      leaveBox.hidden = true;
    }

    return mountFeed(root, {
      db,
      user,
      author,
      memberships,
      scope: m ? { type: "association", id: m.id, name: m.name } : { type: "community" },
      readOnly,
      canModerate: false
    });
  };

  const addTab = (label, m, iconName) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    if (iconName) {
      const i = document.createElement("i");
      i.className = `fa-solid ${iconName}`;
      i.setAttribute("aria-hidden", "true");
      btn.append(i, " ");
    }
    btn.append(label);
    btn.addEventListener("click", () => select(m, btn));
    tabs.appendChild(btn);
    return btn;
  };

  const communityBtn = addTab("Community", null, "fa-earth-europe");
  confirmed.forEach((m) => addTab(m.name, m));

  return select(null, communityBtn);
}

async function showVolunteerNotice(uid) {
  let volunteer = null;

  try {
    const snap = await getDoc(doc(db, "volunteers", uid));
    volunteer = snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error("Errore lettura profilo volontario:", error);
    return;
  }

  const expiring = expiringCount(volunteer);
  let text = "";
  let action = "";

  if (!volunteer) {
    text = "Completa il tuo profilo volontario: la tua associazione vedrà qualifiche, mansioni e disponibilità.";
    action = "Compila il profilo";
  } else if (expiring) {
    text = expiring === 1
      ? "Hai una qualifica scaduta o in scadenza. Quando la rinnovi aggiorna la data."
      : `Hai ${expiring} qualifiche scadute o in scadenza. Quando le rinnovi aggiorna le date.`;
    action = "Controlla le scadenze";
  } else {
    return;
  }

  const notice = document.getElementById("volNotice");
  notice.classList.toggle("notice--info", !volunteer);

  const message = document.createElement("span");
  message.textContent = text;

  const link = document.createElement("a");
  link.className = "btn btn--sm";
  link.href = "/dashboard/volunteers/profile/";
  link.textContent = action;

  notice.replaceChildren(message, link);
  notice.hidden = false;
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

    const cancelWrap = document.createElement("div");
    cancelWrap.className = "leave-box";
    buildLeaveControl(cancelWrap, m, {
      ask: "Annulla la richiesta",
      title: "Annulla la richiesta",
      question: "Vuoi annullare la richiesta a {name}?",
      yes: "Sì, annulla",
      done: "Richiesta annullata."
    });
    li.appendChild(cancelWrap);

    assocList.appendChild(li);
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login/";
    return;
  }

  currentUser = user;

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

    if (shouldTrackPageView(user.uid)) {
      addDoc(collection(db, "viewedPages"), {
        type: "page_view",
        timestamp: serverTimestamp(),
        userId: user.uid,
        page: window.location.pathname
      }).catch((error) => console.error("Errore viewedPages:", error));
    }

    initBottomNav(userData, user, "user");

    if (staffRoles.includes(userData.role)) {
      addStaffLink();
    }

    const memberships = await loadMemberships(user.uid);
    const confirmed = memberships.filter((m) => m.stato === "confermata");
    const pending = memberships.filter((m) => m.stato === "richiesta");

    const userName = `${userData.name || ""} ${userData.surname || ""}`.trim() || userData.username || "Utente";

    if (confirmed.length > 0) showVolunteerNotice(user.uid);
    if (pending.length > 0) showPending(pending);
    if (confirmed.length === 0 && pending.length === 0) document.getElementById("joinBox").hidden = false;

    await showFeed(confirmed, user, userData, userName);

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