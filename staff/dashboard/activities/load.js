import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  deleteDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { auth, db } from "/helpers/firebase.js";
import { parseActivity } from "/staff/dashboard/helpers/activityParsers.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

const CATEGORIES = [
  { id: "all", label: "Tutte", types: null },
  { id: "foto", label: "Foto", icon: "fa-image", types: ["photo_submission", "photo_approval", "photo_rejection", "photo_delete", "vehicle_draft_created"] },
  { id: "utenti", label: "Utenti", icon: "fa-user", types: ["user_creation", "user_role_change", "user_deletion", "user_permanent_deletion", "user_password_reset"] },
  { id: "whatsapp", label: "WhatsApp", icon: "fa-whatsapp", brand: true, types: ["user_creation_whatsapp", "user_edit_whatsapp", "user_role_change_whatsapp", "user_deletion_whatsapp", "user_permanent_deletion_whatsapp", "kick_add"] },
  { id: "badge", label: "Badge", icon: "fa-award", types: ["badge_added", "badge_removed"] },
  { id: "associazioni", label: "Associazioni", icon: "fa-building", types: ["association_verification", "association_approved", "association_rejected", "association_deactivation_request"] },
  { id: "documenti", label: "Documenti", icon: "fa-file-pdf", types: ["pdf_generated"] }
];

const CATEGORY_BY_TYPE = new Map(CATEGORIES.flatMap((c) => (c.types || []).map((t) => [t, c])));
const PAGE_SIZES = [25, 50, 100];

const ref = collection(db, "activities");
const els = {
  tabs: document.getElementById("activityTabs"),
  from: document.getElementById("filterFrom"),
  to: document.getElementById("filterTo"),
  size: document.getElementById("filterSize"),
  reset: document.getElementById("filterReset"),
  list: document.getElementById("activitiesList"),
  prev: document.getElementById("pagePrev"),
  next: document.getElementById("pageNext"),
  info: document.getElementById("pageInfo")
};

const state = {
  category: "all",
  from: "",
  to: "",
  size: 25,
  page: 0,
  total: 0,
  cursors: [null],
  loading: false,
  token: 0,
  generation: 0
};

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

function readUrl() {
  const p = new URLSearchParams(location.search);
  if (CATEGORIES.some((c) => c.id === p.get("cat"))) state.category = p.get("cat");
  if (/^\d{4}-\d{2}-\d{2}$/.test(p.get("dal") || "")) state.from = p.get("dal");
  if (/^\d{4}-\d{2}-\d{2}$/.test(p.get("al") || "")) state.to = p.get("al");
  if (PAGE_SIZES.includes(Number(p.get("n")))) state.size = Number(p.get("n"));
}

function writeUrl() {
  const p = new URLSearchParams();
  if (state.category !== "all") p.set("cat", state.category);
  if (state.from) p.set("dal", state.from);
  if (state.to) p.set("al", state.to);
  if (state.size !== 25) p.set("n", String(state.size));
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

function renderTabs() {
  els.tabs.replaceChildren(...CATEGORIES.map((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tab" + (c.id === state.category ? " active" : "");
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(c.id === state.category));
    if (c.icon) {
      const i = document.createElement("i");
      i.className = `${c.brand ? "fa-brands" : "fa-solid"} ${c.icon}`;
      i.setAttribute("aria-hidden", "true");
      b.append(i);
    }
    b.append(c.label);
    b.addEventListener("click", () => {
      if (state.category === c.id) return;
      state.category = c.id;
      renderTabs();
      applyFilters();
    });
    return b;
  }));
}

function filters() {
  const out = [];
  const cat = CATEGORIES.find((c) => c.id === state.category);
  if (cat?.types) out.push(where("type", "in", cat.types));
  if (state.from) out.push(where("timestamp", ">=", Timestamp.fromDate(new Date(`${state.from}T00:00:00`))));
  if (state.to) {
    const end = new Date(`${state.to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    out.push(where("timestamp", "<", Timestamp.fromDate(end)));
  }
  return out;
}

function totalPages() {
  return Math.max(1, Math.ceil(state.total / state.size));
}

function renderPager() {
  const pages = totalPages();
  els.prev.disabled = state.loading || state.page === 0;
  els.next.disabled = state.loading || state.page >= pages - 1 || !state.cursors[state.page + 1];
  els.info.textContent = state.total
    ? `Pagina ${state.page + 1} di ${pages} · ${state.total} attività`
    : "";
}

function emptyRow(text) {
  const li = document.createElement("li");
  li.className = "activity-empty";
  li.textContent = text;
  return li;
}

async function renderRow(docSnap) {
  const activity = docSnap.data();
  const cat = CATEGORY_BY_TYPE.get(activity.type);
  const date = activity.timestamp?.toDate?.().toLocaleString("it-IT") || "data sconosciuta";

  const li = document.createElement("li");
  li.className = "activity-row";

  const chip = document.createElement("span");
  chip.className = "chip chip--plain activity-chip";
  chip.textContent = cat ? cat.label : "Altro";

  const text = document.createElement("span");
  text.className = "activity-text";
  text.innerHTML = await parseActivity(activity, date);

  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn btn--ghost btn--sm activity-del";
  del.setAttribute("aria-label", "Elimina attività");
  del.title = "Elimina attività";
  del.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
  del.addEventListener("click", async () => {
    if (!confirm("Vuoi eliminare questa attività?")) return;
    del.disabled = true;
    try {
      await deleteDoc(doc(db, "activities", docSnap.id));
      li.remove();
      state.total = Math.max(0, state.total - 1);
      renderPager();
      if (!els.list.children.length) loadPage(Math.min(state.page, totalPages() - 1));
      setStatus("Attività eliminata!", "success");
    } catch (err) {
      del.disabled = false;
      console.error("Errore eliminazione:", err);
      setStatus("Errore durante l'eliminazione.", "error");
    }
  });

  li.append(chip, text, del);
  return li;
}

async function loadPage(page) {
  const token = ++state.token;
  state.loading = true;
  renderPager();
  els.list.setAttribute("aria-busy", "true");

  try {
    const constraints = [...filters(), orderBy("timestamp", "desc")];
    const cursor = state.cursors[page];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(state.size));

    const snap = await getDocs(query(ref, ...constraints));
    if (token !== state.token) return;

    const rows = await Promise.all(snap.docs.map(renderRow));
    if (token !== state.token) return;

    state.page = page;
    if (snap.docs.length === state.size) state.cursors[page + 1] = snap.docs[snap.docs.length - 1];
    else state.cursors.length = page + 1;

    els.list.replaceChildren(...(rows.length ? rows : [emptyRow("Nessuna attività con questi filtri.")]));
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    if (token !== state.token) return;
    console.error("Errore caricamento attività:", err);
    els.list.replaceChildren(emptyRow("Errore nel caricamento delle attività."));
  } finally {
    if (token === state.token) {
      state.loading = false;
      els.list.removeAttribute("aria-busy");
      renderPager();
    }
  }
}

async function applyFilters() {
  if (state.from && state.to && state.from > state.to) {
    setStatus("La data iniziale è successiva a quella finale.", "error");
    return;
  }
  writeUrl();
  state.page = 0;
  state.cursors = [null];
  state.total = 0;
  els.list.replaceChildren(emptyRow("Caricamento..."));

  const generation = ++state.generation;
  getCountFromServer(query(ref, ...filters()))
    .then((res) => {
      if (state.generation !== generation) return;
      state.total = res.data().count;
      renderPager();
    })
    .catch((err) => console.error("Errore conteggio attività:", err));

  await loadPage(0);
}

function bindFilters() {
  els.from.value = state.from;
  els.to.value = state.to;
  els.size.value = String(state.size);

  els.from.addEventListener("change", () => { state.from = els.from.value; applyFilters(); });
  els.to.addEventListener("change", () => { state.to = els.to.value; applyFilters(); });
  els.size.addEventListener("change", () => { state.size = Number(els.size.value) || 25; applyFilters(); });
  els.reset.addEventListener("click", () => {
    state.category = "all";
    state.from = state.to = "";
    state.size = 25;
    els.from.value = els.to.value = "";
    els.size.value = "25";
    renderTabs();
    applyFilters();
  });
  els.prev.addEventListener("click", () => { if (state.page > 0) loadPage(state.page - 1); });
  els.next.addEventListener("click", () => { if (state.cursors[state.page + 1]) loadPage(state.page + 1); });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "/login");

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const userData = userSnap.exists() ? userSnap.data() : null;

  if (!userData || !STAFF_ROLES.includes(userData.role)) {
    setStatus("Accesso negato: non sei staff!", "error");
    return (window.location.href = "/dashboard");
  }

  initBottomNav(userData, user, "staff");

  readUrl();
  renderTabs();
  bindFilters();
  applyFilters();
});
