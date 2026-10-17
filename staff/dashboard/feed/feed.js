import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, limit, getDocs, getDoc, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/helpers/configFirebase.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { setNavCount } from "/helpers/loadNavbar.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];
const MOD_ROLES = ["modstaff", "advstaff", "advstaffplus", "superadmin"];
const MEDIA_ORIGIN = "https://cdn.enti-associazioni.friuliemergenze.it/";

const REASONS = {
  spam: "Spam",
  offensivo: "Offensivo",
  privacy: "Privacy",
  falso: "Falso",
  altro: "Altro"
};

const EMPTY = {
  reported: "Nessun post segnalato. Ottimo lavoro della community.",
  hidden: "Nessun post nascosto.",
  recent: "Ancora nessun post nel feed."
};

const list = document.getElementById("modList");
const tabsEl = document.getElementById("modTabs");

let currentUser = null;
let tab = "reported";
const data = { reported: [], hidden: [], recent: [] };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name) {
  const i = el("i", `fa-solid ${name}`);
  i.setAttribute("aria-hidden", "true");
  return i;
}

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }) : "";
}

function actionButton(label, className, iconName, handler) {
  const btn = el("button", `btn btn--sm ${className}`.trim());
  btn.type = "button";
  btn.append(icon(iconName), label);
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await handler();
    } finally {
      btn.disabled = false;
    }
  });
  return btn;
}

async function clearReports(postId) {
  const reports = await getDocs(collection(db, "feedPosts", postId, "reports"));
  if (reports.empty) return;
  const batch = writeBatch(db);
  reports.docs.forEach((r) => batch.delete(r.ref));
  await batch.commit();
}

async function moderate(postId, update, message) {
  try {
    await updateDoc(doc(db, "feedPosts", postId), { ...update, moderatedBy: currentUser.uid, moderatedAt: serverTimestamp() });
    if (update.reportCount === 0) await clearReports(postId);
    setStatus(message, "success");
    await loadAll();
  } catch (error) {
    console.error("Errore moderazione:", error);
    setStatus("Operazione non riuscita.", "error");
  }
}

async function removePost(postId) {
  if (!confirm("Eliminare definitivamente il post con commenti e segnalazioni?")) return;
  try {
    await deleteDoc(doc(db, "feedPosts", postId));
    setStatus("Post eliminato", "success");
    await loadAll();
  } catch (error) {
    console.error("Errore eliminazione:", error);
    setStatus("Non è stato possibile eliminare il post.", "error");
  }
}

function renderMedia(media) {
  const items = (Array.isArray(media) ? media : []).filter((m) => typeof m?.url === "string" && m.url.startsWith(MEDIA_ORIGIN));
  if (!items.length) return null;
  const box = el("div", "mod-media");
  items.forEach((m) => {
    const link = el("a", "mod-media__item");
    link.href = m.url;
    link.target = "_blank";
    link.rel = "noopener";
    if (m.type === "video") {
      link.append(icon("fa-film"), el("span", "", "Video"));
    } else {
      const img = el("img");
      img.src = m.url;
      img.alt = "";
      img.loading = "lazy";
      link.append(img);
    }
    box.append(link);
  });
  return box;
}

async function reasonsFor(postId, target) {
  try {
    const reports = await getDocs(collection(db, "feedPosts", postId, "reports"));
    const counts = {};
    reports.docs.forEach((r) => {
      const key = r.data().motivo;
      counts[key] = (counts[key] || 0) + 1;
    });
    target.replaceChildren(...Object.entries(counts).map(([key, n]) => el("span", "chip chip--warning", `${REASONS[key] || key} · ${n}`)));
  } catch (error) {
    console.error("Errore lettura segnalazioni:", error);
  }
}

function renderPost(d) {
  const p = d.data();
  const card = el("article", "mod-post");

  const head = el("div", "mod-post__head");
  const who = el("div");
  const name = el("a", "mod-post__author", p.authorName || "Utente");
  name.href = `https://account.friuliemergenze.it/?usp=${encodeURIComponent(p.authorUid || "")}`;
  name.target = "_blank";
  name.rel = "noopener";
  who.append(name);
  const sub = [formatDate(p.createdAt), p.visibility === "community" ? "Community" : "Solo membri"];
  if (p.associationName) sub.unshift(p.associationName);
  who.append(el("div", "row__sub", sub.join(" · ")));
  head.append(who);

  const chips = el("div", "chip-list");
  if (p.official) chips.append(el("span", "chip chip--accent", "Ufficiale"));
  if (p.hidden) chips.append(el("span", "chip chip--danger", p.autoHidden ? "Nascosto in automatico" : "Nascosto"));
  if (p.reportCount) chips.append(el("span", "chip chip--warning", `${p.reportCount} segnalazioni`));
  head.append(chips);
  card.append(head);

  if (p.text) card.append(el("p", "mod-post__text", p.text));
  const media = renderMedia(p.media);
  if (media) card.append(media);

  const reasons = el("div", "chip-list");
  if (p.reportCount) {
    card.append(reasons);
    reasonsFor(d.id, reasons);
  }

  const actions = el("div", "row__actions mod-post__actions");
  if (p.hidden) {
    actions.append(actionButton("Ripristina", "btn--success", "fa-eye", () => moderate(d.id, { hidden: false, reportCount: 0 }, "Post ripristinato")));
  } else {
    actions.append(actionButton("Nascondi", "", "fa-eye-slash", () => moderate(d.id, { hidden: true }, "Post nascosto")));
    if (p.reportCount) actions.append(actionButton("Ignora segnalazioni", "btn--ghost", "fa-check", () => moderate(d.id, { reportCount: 0 }, "Segnalazioni archiviate")));
  }
  actions.append(actionButton("Elimina", "btn--danger", "fa-trash-can", () => removePost(d.id)));
  card.append(actions);

  return card;
}

function render() {
  const items = data[tab];
  list.replaceChildren(...items.map(renderPost));
  document.getElementById("modEmpty").hidden = items.length > 0;
  document.getElementById("modEmptyText").textContent = EMPTY[tab];

  tabsEl.querySelectorAll("[data-count]").forEach((badge) => { badge.textContent = data[badge.dataset.count].length; });
  tabsEl.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
    b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  });
  setNavCount("/staff/dashboard/feed/", data.reported.length);
}

async function loadAll() {
  const posts = collection(db, "feedPosts");
  const [reported, hidden, recent] = await Promise.all([
    getDocs(query(posts, where("reportCount", ">", 0), orderBy("reportCount", "desc"), limit(50))),
    getDocs(query(posts, where("hidden", "==", true), orderBy("createdAt", "desc"), limit(50))),
    getDocs(query(posts, orderBy("createdAt", "desc"), limit(30)))
  ]);

  data.reported = reported.docs.filter((d) => !d.data().hidden);
  data.hidden = hidden.docs;
  data.recent = recent.docs;
  render();
}

tabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  tab = btn.dataset.tab;
  render();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }
  currentUser = user;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const userData = snap.exists() ? snap.data() : {};

    if (!STAFF_ROLES.includes(userData.role)) {
      window.location.href = "/dashboard/";
      return;
    }

    initBottomNav(userData, user, "staff");

    if (MOD_ROLES.includes(userData.role)) {
      document.getElementById("modPanel").hidden = false;
      await loadAll();
    } else {
      document.getElementById("roleNotice").hidden = false;
    }
  } catch (error) {
    console.error("Errore caricamento moderazione:", error);
    setStatus("Errore nel caricamento della moderazione.", "error");
  } finally {
    document.querySelector(".loading").style.display = "none";
    document.querySelector(".content").style.display = "block";
  }
});
