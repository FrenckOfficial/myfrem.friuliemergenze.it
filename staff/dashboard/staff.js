import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, query, where, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";
import { parseActivity } from "/staff/dashboard/helpers/activityParsers.js";
import { parseViewedPage } from "/staff/dashboard/helpers/parseViewedPage.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { getUserName } from "../../helpers/getUserName.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const userNameEl = document.getElementById("userName");
const totalUsersEl = document.getElementById("totalUsers");
const totalPhotosEl = document.getElementById("totalPhotos");
const pendingPhotosEl = document.getElementById("pendingPhotos");
const approvedPhotosEl = document.getElementById("approvedPhotos");
const rejectedPhotosEl = document.getElementById("rejectedPhotos");
const recentActivityListEl = document.getElementById("recentActivityList");
const recentLoginsListEl = document.getElementById("recentLoginsList");
const recentPageViewedListEl = document.getElementById("recentViewedPagesList");
const logoutBtn = document.getElementById("logoutBtn");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

const staffStatsModal = document.getElementById("staffStatsModal");
const staffStatsModalTitle = document.getElementById("staffStatsModalTitle");
const staffStatsModalCount = document.getElementById("staffStatsModalCount");
const staffStatsModalList = document.getElementById("staffStatsModalList");
const closeStaffStatsModalBtn = document.getElementById("closeStaffStatsModalBtn");
const staffStatsOverlay = document.getElementById("staffStatsOverlay");

let allUsersData = [];
let pendingPhotosData = [];
let approvedPhotosData = [];
let rejectedPhotosData = [];

const userNameCache = new Map();

const staffFilterLabels = {
  users: "Utenti registrati",
  pending: "Foto in attesa",
  approved: "Foto approvate",
  rejected: "Foto rifiutate",
};

const PENDING_STATUSES = ["Foto in attesa di approvazione ⌛", "Foto in attesa di approvazione"];
const APPROVED_STATUSES = ["Approvata ✅", "Approvata"];
const REJECTED_STATUSES = ["Rifiutata", "Rifiutata ❌"];
const ALLOWED_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function formatDate(ts, fallback = "data sconosciuta") {
  return ts?.toDate
    ? ts.toDate().toLocaleString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : fallback;
}

function byCreatedAtDesc(a, b) {
  return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
}

function byTimestampDesc(a, b) {
  return (b.data().timestamp?.toMillis?.() || 0) - (a.data().timestamp?.toMillis?.() || 0);
}

function getStatusInfo(photo) {
  const s = photo.status || "";
  if (s.startsWith("Approvata")) return { label: "Approvata", cls: "is-approved" };
  if (s.startsWith("Foto in attesa")) return { label: "In attesa", cls: "is-pending" };
  if (s.startsWith("Rifiutata")) return { label: "Rifiutata", cls: "is-rejected" };
  return { label: s || "Sconosciuto", cls: "" };
}

function showDashboard() {
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
}

async function getCachedUserName(userId) {
  if (!userId) return "utente sconosciuto";
  if (userNameCache.has(userId)) return userNameCache.get(userId);

  try {
    const name = (await getUserName(userId)) || "utente sconosciuto";
    userNameCache.set(userId, name);
    return name;
  } catch (error) {
    console.error("Errore nel recupero del nome utente:", error);
    userNameCache.set(userId, "utente sconosciuto");
    return "utente sconosciuto";
  }
}

function appendEmptyItem(listEl, text) {
  const li = document.createElement("li");
  li.textContent = text;
  listEl.appendChild(li);
}

async function renderPhotoLine(photo) {
  const userName = await getCachedUserName(photo.userId);
  const status = getStatusInfo(photo);

  return `
    <div class="photo-card ${status.cls}">
      <div class="photo-card-top">
        <span class="photo-card-title">${escapeHtml(photo.vehicleModel || "Foto")}</span>
        <span class="status-pill">${escapeHtml(status.label)}</span>
      </div>
      <dl class="photo-card-meta">
        <dt>Caricata da</dt><dd>${escapeHtml(userName)}</dd>
        <dt>Il</dt><dd>${formatDate(photo.createdAt)}</dd>
        <dt>Revisionata</dt><dd>${formatDate(photo.reviewedAt, "non ancora revisionata")}</dd>
      </dl>
    </div>`;
}

async function renderUserLine(user) {
  const fullName = [user.name, user.surname].filter(Boolean).join(" ") || "Senza nome";

  return `
    <div class="photo-card">
      <div class="photo-card-top">
        <span class="photo-card-title">${escapeHtml(fullName)}</span>
        <span class="status-pill">${escapeHtml(user.role || "utente")}</span>
      </div>
      <dl class="photo-card-meta">
        <dt>Email</dt><dd>${escapeHtml(user.email || "non disponibile")}</dd>
        <dt>Registrato</dt><dd>${formatDate(user.createdAt, "data sconosciuta")}</dd>
      </dl>
    </div>`;
}

async function renderStaffStatsList(filter) {
  const sources = {
    users: { dataset: allUsersData, renderItem: renderUserLine },
    pending: { dataset: pendingPhotosData, renderItem: renderPhotoLine },
    approved: { dataset: approvedPhotosData, renderItem: renderPhotoLine },
    rejected: { dataset: rejectedPhotosData, renderItem: renderPhotoLine },
  };

  const { dataset = [], renderItem } = sources[filter] || {};

  staffStatsModalCount.textContent = dataset.length;

  if (dataset.length === 0) {
    staffStatsModalList.innerHTML = '<li class="staff-empty">Nessun elemento da mostrare</li>';
    return;
  }

  staffStatsModalList.innerHTML = '<li class="staff-empty">Caricamento…</li>';

  const items = await Promise.all(dataset.map(renderItem));

  staffStatsModalList.innerHTML = "";
  items.forEach((html) => {
    const li = document.createElement("li");
    li.innerHTML = html;
    staffStatsModalList.appendChild(li);
  });
}

async function openStaffStatsModal(filter) {
  staffStatsModalTitle.textContent = staffFilterLabels[filter] || "Dettagli";
  staffStatsModalCount.textContent = "";
  staffStatsModal.classList.add("active");
  document.body.style.overflow = "hidden";
  await renderStaffStatsList(filter);
}

function closeStaffStatsModalFn() {
  staffStatsModal.classList.remove("active");
  document.body.style.overflow = "";
}

if (staffStatsModal) {
  document.querySelectorAll(".stat-box-clickable").forEach((box) => {
    box.addEventListener("click", () => openStaffStatsModal(box.dataset.filter));
  });

  closeStaffStatsModalBtn?.addEventListener("click", closeStaffStatsModalFn);
  staffStatsOverlay?.addEventListener("click", closeStaffStatsModalFn);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && staffStatsModal.classList.contains("active")) {
      closeStaffStatsModalFn();
    }
  });
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const userData = userSnap.exists() ? userSnap.data() : null;

  initBottomNav(userData, user, "staff");

  if (!userData || !ALLOWED_ROLES.includes(userData.role)) {
    showDashboard();
    setStatus("Accesso negato: non sei staff!", "error");
    window.location.href = "/dashboard";
    return;
  }

  await updateDoc(doc(db, "users", user.uid), {
    lastDashSelected: "admin",
  });

  const timeoutId = setTimeout(() => {
    console.warn("Timeout caricamento, forzo visualizzazione");
    showDashboard();
  }, 7000);

  await loadStats(userData);

  clearTimeout(timeoutId);
  showDashboard();
});

async function loadPhotoStats() {
  const photosRef = collection(db, "photos");

  const [photosSnap, pendingSnap, approvedSnap, rejectedSnap] = await Promise.all([
    getDocs(photosRef),
    getDocs(query(photosRef, where("status", "in", PENDING_STATUSES))),
    getDocs(query(photosRef, where("status", "in", APPROVED_STATUSES))),
    getDocs(query(photosRef, where("status", "in", REJECTED_STATUSES))),
  ]);

  totalPhotosEl.textContent = photosSnap.size;
  pendingPhotosEl.textContent = pendingSnap.size;
  approvedPhotosEl.textContent = approvedSnap.size;
  rejectedPhotosEl.textContent = rejectedSnap.size;

  pendingPhotosData = pendingSnap.docs.map((d) => d.data()).sort(byCreatedAtDesc);
  approvedPhotosData = approvedSnap.docs.map((d) => d.data()).sort(byCreatedAtDesc);
  rejectedPhotosData = rejectedSnap.docs.map((d) => d.data()).sort(byCreatedAtDesc);
}

async function renderRecentActivities() {
  const snap = await getDocs(collection(db, "activities"));
  recentActivityListEl.innerHTML = "";

  const latest = snap.docs.sort(byTimestampDesc).slice(0, 5);

  const rows = await Promise.all(
    latest.map((docSnap) => {
      const activity = docSnap.data();
      const date = activity.timestamp.toDate().toLocaleString("it-IT");
      return parseActivity(activity, date);
    })
  );

  rows.forEach((html) => {
    const li = document.createElement("li");
    li.innerHTML = html;
    recentActivityListEl.appendChild(li);
  });

  if (rows.length === 0) appendEmptyItem(recentActivityListEl, "Nessuna attività recente.");
}

async function renderRecentLogins() {
  const snap = await getDocs(collection(db, "logins"));
  recentLoginsListEl.innerHTML = "";

  const latest = snap.docs.sort(byTimestampDesc).slice(0, 5);

  latest.forEach((docSnap) => {
    const login = docSnap.data();
    const email = escapeHtml(login.email);
    const date = login.timestamp.toDate().toLocaleString("it-IT");
    const ip = escapeHtml(login.ipAddress ?? "IP sconosciuto");
    const ua = escapeHtml(login.userAgent ?? "Browser sconosciuto");

    const li = document.createElement("li");
    li.innerHTML = `Accesso di <a href="mailto:${email}">${email}</a> in data ${date} (${ip} - ${ua})`;
    recentLoginsListEl.appendChild(li);
  });

  if (latest.length === 0) appendEmptyItem(recentLoginsListEl, "Nessuna attività recente.");
}

async function renderRecentViewedPages() {
  const snap = await getDocs(collection(db, "viewedPages"));
  recentPageViewedListEl.innerHTML = "";

  const latest = snap.docs.sort(byTimestampDesc).slice(0, 5);

  const rows = await Promise.all(
    latest.map((docSnap) => {
      const activity = docSnap.data();
      const date = activity.timestamp.toDate().toLocaleString("it-IT");
      return parseViewedPage(activity, date);
    })
  );

  rows.forEach((html) => {
    const li = document.createElement("li");
    li.innerHTML = html;
    recentPageViewedListEl.appendChild(li);
  });

  if (rows.length === 0) appendEmptyItem(recentPageViewedListEl, "Nessuna pagina visualizzata di recente.");
}

async function loadStats(currentUserData) {
  try {
    userNameEl.textContent = `${currentUserData.name ?? ""} ${currentUserData.surname ?? ""}`.trim();

    const usersSnap = await getDocs(collection(db, "users"));
    totalUsersEl.textContent = usersSnap.size;
    allUsersData = usersSnap.docs.map((d) => d.data());

    await Promise.all([
      loadPhotoStats(),
      renderRecentActivities(),
      renderRecentLogins(),
      renderRecentViewedPages(),
    ]);
  } catch (err) {
    console.error("Errore caricamento statistiche:", err);
    setStatus("Errore caricamento statistiche", "error");
    showDashboard();
  }
}