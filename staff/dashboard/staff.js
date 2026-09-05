import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js"
import { parseActivity } from "/staff/dashboard/helpers/activityParsers.js";
import { parseViewedPage } from "/staff/dashboard/helpers/parseViewedPage.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "../../helpers/modals.js";
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
const staffStatsModalList = document.getElementById("staffStatsModalList");
const closeStaffStatsModal = document.getElementById("closeStaffStatsModal");
const closeStaffStatsModalBtn = document.getElementById("closeStaffStatsModalBtn");
const staffStatsOverlay = staffStatsModal ? staffStatsModal.querySelector(".modal-overlay") : null;

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

function getReadableStatus(photo) {
  if (photo.status === "Approvata ✅" || photo.status === "Approvata") {
    return "Approvata";
  } else if (photo.status === "Foto in attesa di approvazione" || photo.status === "Foto in attesa di approvazione ⌛") {
    return "In attesa";
  } else if (photo.status === "Rifiutata ❌" || photo.status === "Rifiutata") {
    return "Rifiutata";
  }
  return photo.status || "Sconosciuto";
}

async function getCachedUserName(userId) {
  if (!userId) return "utente sconosciuto";

  if (userNameCache.has(userId)) {
    return userNameCache.get(userId);
  }

  try {
    const name = await getUserName(userId);
    userNameCache.set(userId, name || "utente sconosciuto");
    return name || "utente sconosciuto";
  } catch (error) {
    console.error("Errore nel recupero del nome utente:", error);
    userNameCache.set(userId, "utente sconosciuto");
    return "utente sconosciuto";
  }
}

async function renderPhotoLine(photo) {
  const userName = await getCachedUserName(photo.userId);
  return `
    <p><b>${photo.vehicleModel || "Foto"}</b><br>
    Caricata da <em>${userName}</em> il <em>${photo.createdAt?.toDate().toLocaleString() || "data sconosciuta"}</em><br>
    Revisionata il <em>${photo.reviewedAt?.toDate().toLocaleString() || "non ancora revisionata"}</em><br>
    Stato: <em>${getReadableStatus(photo)}</em></p>
  `;
}

async function renderStaffStatsList(filter) {
  let dataset;
  let renderItem;

  if (filter === "pending") {
    dataset = pendingPhotosData;
    renderItem = renderPhotoLine;
  } else if (filter === "approved") {
    dataset = approvedPhotosData;
    renderItem = renderPhotoLine;
  } else if (filter === "rejected") {
    dataset = rejectedPhotosData;
    renderItem = renderPhotoLine;
  } else {
    dataset = [];
    renderItem = async () => "";
  }

  if (dataset.length === 0) {
    staffStatsModalList.innerHTML = "<li>Nessun elemento da mostrare.</li>";
    return;
  }

  staffStatsModalList.innerHTML = "<li>Caricamento...</li>";

  const items = [];
  for (const item of dataset) {
    const html = await renderItem(item);
    items.push(html);
  }

  staffStatsModalList.innerHTML = "";
  items.forEach((html) => {
    const li = document.createElement("li");
    li.innerHTML = html;
    staffStatsModalList.appendChild(li);
  });
}

async function openStaffStatsModal(filter) {
  staffStatsModalTitle.textContent = staffFilterLabels[filter] || "Dettagli";
  staffStatsModal.classList.add("active");
  await renderStaffStatsList(filter);
}

function closeStaffStatsModalFn() {
  staffStatsModal.classList.remove("active");
}

if (staffStatsModal) {
  document.querySelectorAll(".stat-box-clickable").forEach((box) => {
    box.addEventListener("click", () => {
      openStaffStatsModal(box.dataset.filter);
    });
  });

  closeStaffStatsModal?.addEventListener("click", closeStaffStatsModalFn);
  closeStaffStatsModalBtn?.addEventListener("click", closeStaffStatsModalFn);
  staffStatsOverlay?.addEventListener("click", closeStaffStatsModalFn);
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

  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    setStatus("Accesso negato: non sei staff!", "error");
    window.location.href = "/dashboard";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("⏱️ Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  await loadStats();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

async function loadStats() {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    totalUsersEl.textContent = usersSnap.size;
    allUsersData = usersSnap.docs.map((doc) => doc.data());

    const currentUser = auth.currentUser;
    const currentUserDoc = await getDocs(
      query(collection(db, "users"), where("__name__", "==", currentUser.uid))
    );
    const currentUserData = currentUserDoc.docs[0].data();
    userNameEl.textContent = `${currentUserData.name} ${currentUserData.surname}`;

    const photosSnap = await getDocs(collection(db, "photos"));
    totalPhotosEl.textContent = photosSnap.size;

    const pendingSnap = await getDocs(
      query(collection(db, "photos"), where("status", "in", ["Foto in attesa di approvazione ⌛", "Foto in attesa di approvazione"]))
    );
    pendingPhotosEl.textContent = pendingSnap.size;
    pendingPhotosData = pendingSnap.docs
      .map((doc) => doc.data())
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

    const approvedSnap = await getDocs(
      query(collection(db, "photos"), where("status", "in", ["Approvata ✅", "Approvata"]))
    );
    approvedPhotosEl.textContent = approvedSnap.size;
    approvedPhotosData = approvedSnap.docs
      .map((doc) => doc.data())
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

    const rejectedSnap = await getDocs(
      query(collection(db, "photos"), where("status", "in", ["Rifiutata", "Rifiutata ❌"]))
    );
    rejectedPhotosEl.textContent = rejectedSnap.size;
    rejectedPhotosData = rejectedSnap.docs
      .map((doc) => doc.data())
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

    const activitiesSnap = await getDocs(collection(db, "activities"));
    recentActivityListEl.innerHTML = "";

    const sortedActivities = activitiesSnap.docs
      .sort((a, b) => b.data().timestamp.toMillis() - a.data().timestamp.toMillis())
      .slice(0, 5);

    for (const docSnap of sortedActivities) {
      const activity = docSnap.data();
      const li = document.createElement("li");
      const date = activity.timestamp.toDate().toLocaleString();

      const text = await parseActivity(activity, date);
      li.innerHTML = text;

      recentActivityListEl.appendChild(li);
    }

    if (recentActivityListEl.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nessuna attività recente.";
      recentActivityListEl.appendChild(li);
    }

    if (recentActivityListEl.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nessuna attività recente.";
      recentActivityListEl.appendChild(li);
    }

    const loginsSnap = await getDocs(collection(db, "logins"));
    recentLoginsListEl.innerHTML = "";

    const sortedLogins = loginsSnap.docs
      .sort((a, b) => b.data().timestamp.toMillis() - a.data().timestamp.toMillis())
      .slice(0, 5);

    for (const docSnap of sortedLogins) {
      const activity = docSnap.data();
      const li = document.createElement("li");
      const date = activity.timestamp.toDate().toLocaleString();
      const email = activity.email;

      li.innerHTML = `Accesso di <a mailto:${email}>${email}</a> in data ${date} (${activity.ipAddress ?? "IP sconosciuto"} - ${activity.userAgent ?? "Browser sconosciuto"})`;

      recentLoginsListEl.appendChild(li);
    }

    if (recentLoginsListEl.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nessuna attività recente.";
      recentLoginsListEl.appendChild(li);
    }

    const pageViewedSnap = await getDocs(collection(db, "viewedPages"));
    recentPageViewedListEl.innerHTML = "";

    const sortedPageViewed = pageViewedSnap.docs
      .sort((a, b) => b.data().timestamp.toMillis() - a.data().timestamp.toMillis())
      .slice(0, 5);
    
    for (const docSnap of sortedPageViewed) {
      const activity = docSnap.data();
      const li = document.createElement("li");
      const date = activity.timestamp.toDate().toLocaleString();

      const text = await parseViewedPage(activity, date);
      li.innerHTML = text;

      recentPageViewedListEl.appendChild(li);
    }

    if (recentPageViewedListEl.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nessuna pagina visualizzata di recente.";
      recentPageViewedListEl.appendChild(li);
    }

  } catch (err) {
    console.error("❌ Errore caricamento statistiche:", err);
    setStatus("❌ Errore caricamento statistiche", "error");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }
}