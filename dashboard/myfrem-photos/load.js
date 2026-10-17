import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, getDocs, getDoc, doc, setDoc, deleteDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/helpers/configFirebase.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { addStaffLink } from "/helpers/loadNavbar.js";
import { photoCard, photoStatus, serviceLabel, filled, emptyState } from "/dashboard/photos.js";
import { shouldTrackPageView } from "/helpers/pageViews.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

const photosContainer = document.getElementById("photosContainer");
const searchInput = document.getElementById("searchInput");
const serviceFilter = document.getElementById("serviceFilter");
const resultsCount = document.getElementById("resultsCount");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

let currentUserId = null;
let isReadOnly = false;
let photos = [];
const userNames = new Map();

function showContent() {
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login/";
    return;
  }

  const timeoutId = setTimeout(showContent, 5000);
  currentUserId = user.uid;

  if (shouldTrackPageView(user.uid)) {
    addDoc(collection(db, "viewedPages"), {
      type: "page_view",
      timestamp: serverTimestamp(),
      userId: user.uid,
      page: window.location.pathname
    }).catch((error) => console.error("Errore viewedPages:", error));
  }

  try {
    await checkUserRole(user);
    await loadAllPhotos();
  } catch (err) {
    console.error("Errore:", err);
    setStatus("Errore nel caricamento delle foto.", "error");
  } finally {
    clearTimeout(timeoutId);
    showContent();
  }
});

async function checkUserRole(user) {
  try {
    const userDocSnap = await getDoc(doc(db, "users", user.uid));
    if (!userDocSnap.exists()) return;

    const userData = userDocSnap.data();

    if (userData.role === "testacc") {
      isReadOnly = true;
      document.body.classList.add("read-only-mode");
      document.getElementById("readOnlyNotice").hidden = false;
    }

    if (STAFF_ROLES.includes(userData.role)) addStaffLink();

    initBottomNav(userData, user, "user");
  } catch (err) {
    console.error("Errore verifica ruolo:", err);
  }
}

async function authorName(userId) {
  if (!userId) return "";
  if (userNames.has(userId)) return userNames.get(userId);

  const pending = getDoc(doc(db, "publicProfiles", userId))
    .then((snap) => {
      const u = snap.exists() ? snap.data() : {};
      return `${u.name || ""} ${u.surname || ""}`.trim() || "Utente";
    })
    .catch(() => "Utente");

  userNames.set(userId, pending);
  return pending;
}

async function getVotes(photoId) {
  try {
    const snapshot = await getDocs(collection(db, "photos", photoId, "votes"));
    let likes = 0;
    let dislikes = 0;
    let mine = null;

    snapshot.forEach((voteDoc) => {
      const { voteType } = voteDoc.data();
      if (voteType === "like") likes++;
      else if (voteType === "dislike") dislikes++;
      if (voteDoc.id === currentUserId) mine = voteType;
    });

    return { likes, dislikes, mine };
  } catch (err) {
    console.error("Errore caricamento voti:", err);
    return { likes: 0, dislikes: 0, mine: null };
  }
}

function voteButton(type, count) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `vote-btn ${type}-btn`;
  btn.dataset.voteType = type;
  btn.setAttribute("aria-label", type === "like" ? "Mi piace" : "Non mi piace");

  const icon = document.createElement("i");
  icon.className = `fa-solid ${type === "like" ? "fa-thumbs-up" : "fa-thumbs-down"}`;
  icon.setAttribute("aria-hidden", "true");

  const value = document.createElement("span");
  value.className = "vote-count";
  value.textContent = count;

  btn.append(icon, value);
  return btn;
}

function paintVotes(state) {
  state.like.classList.toggle("voted", state.mine === "like");
  state.dislike.classList.toggle("voted", state.mine === "dislike");
  state.like.setAttribute("aria-pressed", String(state.mine === "like"));
  state.dislike.setAttribute("aria-pressed", String(state.mine === "dislike"));
  state.like.querySelector(".vote-count").textContent = state.likes;
  state.dislike.querySelector(".vote-count").textContent = state.dislikes;
}

function cardFooter(photoId, data, author, votes) {
  const box = document.createElement("div");
  box.className = "pcard__info pcard__info--row";

  const by = document.createElement("span");
  by.append("Pubblicata da ");
  const link = document.createElement("a");
  link.href = `https://account.friuliemergenze.it/?usp=${encodeURIComponent(data.userId || "")}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = author;
  by.append(link);
  box.append(by);

  const votesBox = document.createElement("div");
  votesBox.className = "vote-container";

  if (data.userId === currentUserId) {
    votesBox.classList.add("disabled");
    const note = document.createElement("span");
    note.className = "own-photo-notice";
    note.textContent = "La tua foto";
    votesBox.append(note);
  } else {
    const state = { photoId, ...votes, like: voteButton("like", votes.likes), dislike: voteButton("dislike", votes.dislikes), busy: false };
    votesBox.append(state.like, state.dislike);
    paintVotes(state);

    [state.like, state.dislike].forEach((btn) => btn.addEventListener("click", () => handleVote(state, btn.dataset.voteType)));
  }

  box.append(votesBox);
  return box;
}

async function handleVote(state, voteType) {
  if (state.busy) return;
  if (isReadOnly) {
    setStatus("Non puoi votare in modalità sola lettura.", "warning");
    return;
  }

  state.busy = true;
  const voteRef = doc(db, "photos", state.photoId, "votes", currentUserId);

  try {
    if (state.mine === voteType) {
      await deleteDoc(voteRef);
    } else {
      await setDoc(voteRef, { voteType, createdAt: serverTimestamp() });
    }

    const fresh = await getVotes(state.photoId);
    Object.assign(state, fresh);
    paintVotes(state);
  } catch (err) {
    console.error("Errore durante il voto:", err);
    setStatus("Errore durante il voto", "error");
  } finally {
    state.busy = false;
  }
}

function render() {
  const q = searchInput.value.trim().toLowerCase();
  const service = serviceFilter.value;
  const shown = photos.filter((p) => (!service || p.service === service) && (!q || p.text.includes(q)));

  resultsCount.textContent = photos.length
    ? `${shown.length} foto su ${photos.length}`
    : "";

  if (photos.length === 0) {
    photosContainer.replaceChildren(emptyState("fa-images", "Ancora nessuna foto pubblicata", "Le foto compaiono qui dopo l'approvazione dello staff."));
    return;
  }

  if (shown.length === 0) {
    photosContainer.replaceChildren(emptyState("fa-magnifying-glass", "Nessun risultato", "Prova a cambiare la ricerca o il filtro del servizio."));
    return;
  }

  photosContainer.replaceChildren(...shown.map((p) => p.card));
}

function fillServiceFilter() {
  const labels = [...new Set(photos.map((p) => p.service).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));
  labels.forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    serviceFilter.append(option);
  });
  serviceFilter.hidden = labels.length < 2;
}

async function loadAllPhotos() {
  const snapshot = await getDocs(query(collection(db, "photos"), orderBy("createdAt", "desc")));

  const published = snapshot.docs.filter((d) => {
    const data = d.data();
    return photoStatus(data) === "approved" && data.published === true;
  });

  photos = await Promise.all(published.map(async (d) => {
    const data = d.data();
    const [author, votes] = await Promise.all([authorName(data.userId), getVotes(d.id)]);
    const service = serviceLabel(data.serviceType);

    return {
      service,
      text: [data.vehicleModel, data.licensePlate, data.location, data.notes, service, author].map(filled).join(" ").toLowerCase(),
      card: photoCard(data, { footer: cardFooter(d.id, data, author, votes) })
    };
  }));

  fillServiceFilter();
  render();
}

searchInput.addEventListener("input", render);
serviceFilter.addEventListener("change", render);

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "/login/";
});
