import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, getDocs, getDoc, doc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/helpers/configFirebase.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { addStaffLink } from "/helpers/loadNavbar.js";
import { photoCard, photoStatus, serviceLabel, formatDate, filled, emptyState } from "/dashboard/photos.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];
const FILTERS = ["all", "pending", "approved", "rejected"];

const photosContainer = document.getElementById("photosContainer");
const statusTabs = document.getElementById("statusTabs");
const searchInput = document.getElementById("searchInput");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

const requested = new URLSearchParams(window.location.search).get("stato");
let filter = FILTERS.includes(requested) ? requested : "all";
let photos = [];

function showContent() {
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const timeoutId = setTimeout(showContent, 5000);

  addDoc(collection(db, "viewedPages"), {
    type: "page_view",
    timestamp: serverTimestamp(),
    userId: user.uid,
    page: window.location.pathname
  }).catch((error) => console.error("Errore viewedPages:", error));

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      setStatus("Errore: utente non trovato.", "error");
      return;
    }

    const userData = userDoc.data();

    if (userData.role === "testacc") {
      document.body.classList.add("read-only-mode");
      document.getElementById("readOnlyNotice").hidden = false;
    }

    if (STAFF_ROLES.includes(userData.role)) addStaffLink();

    initBottomNav(userData, user, "user");
    await loadPhotos(user.uid);
  } catch (err) {
    console.error("Errore:", err);
    setStatus("Errore nel caricamento.", "error");
  } finally {
    clearTimeout(timeoutId);
    showContent();
  }
});

async function getVoteCounts(photoId) {
  try {
    const snapshot = await getDocs(collection(db, "photos", photoId, "votes"));
    let likes = 0;
    let dislikes = 0;

    snapshot.forEach((voteDoc) => {
      const { voteType } = voteDoc.data();
      if (voteType === "like") likes++;
      else if (voteType === "dislike") dislikes++;
    });

    return { likes, dislikes };
  } catch (err) {
    console.error("Errore caricamento conteggio voti:", err);
    return { likes: 0, dislikes: 0 };
  }
}

function cardFooter(photo, votes) {
  const box = document.createElement("div");
  box.className = "pcard__info";

  const lines = [];
  const uploaded = formatDate(photo.createdAt);
  if (uploaded) lines.push(`Caricata il ${uploaded}`);

  const reviewer = filled(photo.updater);
  const reviewed = formatDate(photo.updatedAt) || formatDate(photo.reviewedAt);
  if (reviewer) lines.push(`Revisionata da ${reviewer}${reviewed ? ` il ${reviewed}` : ""}`);

  lines.forEach((text) => {
    const line = document.createElement("span");
    line.textContent = text;
    box.append(line);
  });

  if (votes) {
    const stats = document.createElement("span");
    stats.className = "pcard__votes";
    stats.innerHTML = '<i class="fa-solid fa-thumbs-up" aria-hidden="true"></i> <b></b> &nbsp; <i class="fa-solid fa-thumbs-down" aria-hidden="true"></i> <b></b>';
    const [likes, dislikes] = stats.querySelectorAll("b");
    likes.textContent = votes.likes;
    dislikes.textContent = votes.dislikes;
    box.append(stats);
  }

  return box;
}

function searchText(photo) {
  return [photo.vehicleModel, photo.licensePlate, photo.sponsor, photo.location, photo.notes, serviceLabel(photo.serviceType)]
    .map(filled)
    .join(" ")
    .toLowerCase();
}

function render() {
  const q = searchInput.value.trim().toLowerCase();
  const shown = photos.filter((p) => (filter === "all" || p.status === filter) && (!q || p.text.includes(q)));

  statusTabs.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.status === filter;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  statusTabs.querySelectorAll("[data-count]").forEach((badge) => {
    const key = badge.dataset.count;
    badge.textContent = key === "all" ? photos.length : photos.filter((p) => p.status === key).length;
  });

  if (photos.length === 0) {
    photosContainer.replaceChildren(emptyState("fa-camera", "Non hai ancora caricato foto", "Carica la tua prima foto di un mezzo di soccorso: lo staff la revisionerà prima di pubblicarla.", { label: "Carica una foto", href: "/dashboard/upload" }));
    return;
  }

  if (shown.length === 0) {
    photosContainer.replaceChildren(emptyState("fa-filter", "Nessuna foto qui", q ? "Nessun risultato per questa ricerca." : "Non ci sono foto con questo stato."));
    return;
  }

  photosContainer.replaceChildren(...shown.map((p) => p.card));
}

async function loadPhotos(userId) {
  const snapshot = await getDocs(query(
    collection(db, "photos"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  ));

  photos = await Promise.all(snapshot.docs.map(async (docSnap) => {
    const data = docSnap.data();
    const status = photoStatus(data);
    const votes = status === "approved" ? await getVoteCounts(docSnap.id) : null;

    return {
      status,
      text: searchText(data),
      card: photoCard(data, { showStatus: true, footer: cardFooter(data, votes) })
    };
  }));

  render();
}

statusTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  filter = tab.dataset.status;
  render();
});

searchInput.addEventListener("input", render);
