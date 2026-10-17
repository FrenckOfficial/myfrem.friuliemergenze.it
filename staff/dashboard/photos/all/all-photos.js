import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, getDocs, doc, getDoc, addDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getUserName } from "/helpers/getUserName.js";
import { firebaseConfig } from "/helpers/configFirebase.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { createPager } from "/staff/dashboard/helpers/pager.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const photosTableBody = document.getElementById("photosTbody");
const logoutBtn = document.getElementById("logoutBtn");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

const votesModal = document.getElementById("votesModal");
const votesTitle = document.getElementById("votesModalTitle");
const votesCount = document.getElementById("votesCount");
const votesTableBody = document.getElementById("votesTableBody");
const closeVotesModalBtn = document.getElementById("closeVotesModal");

const TABLE_COLUMNS = 12;
const ALLOWED_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

const SERVICE_LABELS = {
  "ordine-pubblico": "Ordine Pubblico",
  "carabinieri": "Carabinieri",
  "polizia-locale": "Polizia Locale / Municipale",
  "polizia-di-stato": "Polizia di Stato",
  "soccorso-alpino": "Soccorso Alpino e Speleologico",
  "corpo-forestale-regionale": "Corpo Forestale Regionale",
  "guardia-di-finanza": "Guardia di Finanza",
  "emergenza-sanitaria": "Soccorso Sanitario",
  "pompieri": "Vigili del Fuoco",
  "soccorso-tecnico-urgente": "Vigili del Fuoco",
  "guardia-costiera": "Guardia Costiera",
  "protezione-civile": "Protezione Civile",
  "ausiliari": "Soccorso Stradale / Autostradale"
};

const STATUS_STYLES = [
  { match: "Approvata", label: "Approvata", color: "green" },
  { match: "Rifiutata", label: "Rifiutata", color: "red" },
  { match: "Foto in attesa di approvazione", label: "Foto in attesa di approvazione", color: "orange" }
];
const STATUS_UNKNOWN = { label: "Sconosciuto", color: "blue" };

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(timestamp, fallback = "-") {
  const date = timestamp?.toDate?.();
  return date ? date.toLocaleString("it-IT") : fallback;
}

function toMillis(timestamp) {
  return timestamp?.toMillis?.() ?? 0;
}

function resolveStatus(photo) {
  return STATUS_STYLES.find(s => photo.status?.includes(s.match)) ?? STATUS_UNKNOWN;
}

const userNameCache = new Map();

function getCachedUserName(userId) {
  if (!userId) return Promise.resolve("Sconosciuto");

  if (!userNameCache.has(userId)) {
    userNameCache.set(
      userId,
      Promise.resolve(getUserName(userId))
        .then(name => name || "Sconosciuto")
        .catch(() => "Sconosciuto")
    );
  }
  return userNameCache.get(userId);
}

function showContent() {
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
}

async function fetchVotes(photoId) {
  const snapshot = await getDocs(collection(db, "photos", photoId, "votes"));
  return snapshot.docs.map(d => ({ ...d.data(), userId: d.id }));
}

function countVotes(votes) {
  let likes = 0;
  let dislikes = 0;

  for (const vote of votes) {
    if (vote.voteType === "like") likes++;
    else if (vote.voteType === "dislike") dislikes++;
  }
  return { likes, dislikes };
}

let votesRequestId = 0;

async function openVotesModal(photoId) {
  const requestId = ++votesRequestId;

  votesTitle.textContent = "Voti foto: " + photoId;
  votesCount.textContent = "Caricamento...";
  votesTableBody.replaceChildren();
  votesModal.classList.add("active");

  try {
    const votes = await fetchVotes(photoId);
    votes.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    const userNames = await Promise.all(votes.map(v => getCachedUserName(v.userId)));

    if (requestId !== votesRequestId) return;

    const { likes, dislikes } = countVotes(votes);
    votesCount.textContent = "Voti totali: " + (likes + dislikes);

    if (votes.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.textContent = "Nessun voto";
      tr.appendChild(td);
      votesTableBody.appendChild(tr);
      return;
    }

    const fragment = document.createDocumentFragment();

    votes.forEach((vote, i) => {
      const voteLabel =
        vote.voteType === "like" ? "Like" :
        vote.voteType === "dislike" ? "Dislike" : "-";

      const tr = document.createElement("tr");
      [userNames[i], voteLabel, formatDate(vote.createdAt, "Non disponibile")].forEach(text => {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });
      fragment.appendChild(tr);
    });

    votesTableBody.appendChild(fragment);
  } catch (err) {
    console.error("Errore caricamento voti:", err);
    if (requestId === votesRequestId) {
      votesCount.textContent = "Errore nel caricamento dei voti";
    }
  }
}

function closeVotesModal() {
  votesRequestId++;
  votesModal.classList.remove("active");
}

closeVotesModalBtn.addEventListener("click", closeVotesModal);
votesModal.querySelector(".modal-overlay")?.addEventListener("click", closeVotesModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && votesModal.classList.contains("active")) {
    closeVotesModal();
  }
});

function buildRow({ id, photo, userName, votes }) {
  const status = resolveStatus(photo);
  const serviceType = SERVICE_LABELS[photo.serviceType] ?? "Non inserito";
  const { likes, dislikes } = countVotes(votes);

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><span class="status-indicator" style="color: ${status.color};"></span> <b style="color: ${status.color};">${escapeHtml(status.label)}</b></td>
    <td><img src="${escapeHtml(photo.url)}" class="preview" alt="Preview della foto caricata tramite i sistemi Friuli Emergenze" loading="lazy" /></td>
    <td><b>${escapeHtml(photo.vehicleModel || "Non inserito")}</b></td>
    <td><b>${escapeHtml(photo.sponsor || "Non inserito")}</b></td>
    <td><b>${escapeHtml(photo.licensePlate || "Non inserita")}</b></td>
    <td><b>${escapeHtml(serviceType)}</b></td>
    <td><b>${escapeHtml(photo.location || "Non inserita")}</b></td>
    <td><b>${escapeHtml(userName)}</b></td>
    <td><b>${escapeHtml(formatDate(photo.createdAt))}</b></td>
    <td><b>${escapeHtml(photo.notes || "Non inserite")}</b></td>
    <td class="votes-cell">
      <div class="votes-wrapper">
        <span class="vote-badge like-badge" title="Mi piace">
          <i class="fas fa-thumbs-up"></i> ${likes}
        </span>
        <span class="vote-badge dislike-badge" title="Non mi piace">
          <i class="fas fa-thumbs-down"></i> ${dislikes}
        </span>
      </div>
    </td>
    <td>
      <button class="delete-btn" type="button">Elimina foto <img src="/assets/icons/trash-solid-full.svg" alt="Elimina" loading="lazy" /></button>
    </td>
  `;

  const previewImg = tr.querySelector("img.preview");
  previewImg.style.cursor = "pointer";
  previewImg.addEventListener("click", () => {
    window.openLightbox?.(previewImg, photo.vehicleModel || "Foto");
  });

  tr.querySelector(".votes-cell").addEventListener("click", () => openVotesModal(id));
  tr.querySelector(".delete-btn").addEventListener("click", () => deletePhoto(id, tr));

  return tr;
}

function showEmptyRow() {
  photosTableBody.innerHTML = `<tr><td colspan="${TABLE_COLUMNS}">Nessuna foto trovata</td></tr>`;
}

const pager = createPager({
  ref: collection(db, "photos"),
  field: "createdAt",
  pageSize: 50,
  list: photosTableBody,
  anchor: photosTableBody.closest(".table-scroll") || photosTableBody.closest("table") || photosTableBody,
  moreLabel: "Carica altre foto",
  renderEmpty: () => {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = TABLE_COLUMNS;
    td.textContent = "Nessuna foto trovata";
    tr.append(td);
    return tr;
  },
  renderItem: async (docSnap) => {
    const photo = docSnap.data();
    const id = docSnap.id;
    const [votes, userName] = await Promise.all([
      fetchVotes(id).catch((err) => {
        console.error("Errore caricamento voti foto " + id + ":", err);
        return [];
      }),
      getCachedUserName(photo.userId)
    ]);
    return buildRow({ id, photo, userName, votes });
  }
});

async function loadAllPhotos() {
  try {
    await pager.load(true);
  } catch (err) {
    console.error("Errore caricamento foto:", err);
    photosTableBody.innerHTML = `<tr><td colspan="${TABLE_COLUMNS}">Errore nel caricamento delle foto</td></tr>`;
    setStatus("Errore caricamento foto", "error");
  }
}

async function deletePhoto(photoId, rowElement) {
  if (!confirm("Sei sicuro di voler eliminare questa foto? Questa azione è irreversibile.")) {
    return;
  }

  try {
    await deleteDoc(doc(db, "photos", photoId));
  } catch (err) {
    console.error("Errore eliminazione foto:", err);
    setStatus("Errore eliminazione foto", "error");
    return;
  }

  try {
    await addDoc(collection(db, "activities"), {
      type: "photo_delete",
      photoId,
      editStaffer: auth.currentUser?.email || "-",
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Errore registrazione attività:", err);
  }

  rowElement.remove();
  if (photosTableBody.children.length === 0) showEmptyRow();

  setStatus("Foto eliminata con successo", "success");
}

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Errore logout:", err);
  } finally {
    window.location.href = "/login";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  let isStaff = false;

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    initBottomNav(userSnap.data(), user, "staff");
    isStaff = userSnap.exists() && ALLOWED_ROLES.includes(userSnap.data().role);
  } catch (err) {
    console.error("Errore verifica ruolo:", err);
  }

  if (!isStaff) {
    window.location.href = "/dashboard";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("Timeout caricamento, forzo visualizzazione");
    showContent();
  }, 7000);

  try {
    await loadAllPhotos();
  } finally {
    clearTimeout(timeoutId);
    showContent();
  }
});