import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc, serverTimestamp, query, where, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const userSearchInput = document.getElementById("userSearch");
const usersListEl = document.getElementById("usersList");
const badgesContentEl = document.getElementById("badgesContent");
const earnedBadgesContainerEl = document.getElementById("earnedBadgesContainer");
const earnedBadgesListEl = document.getElementById("earnedBadgesList");
const availableBadgesContainerEl = document.getElementById("availableBadgesContainer");
const availableBadgesListEl = document.getElementById("availableBadgesList");
const statusMsg = document.getElementById("statusMsg");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");
const logoutBtn = document.getElementById("logoutBtn");

let currentSelectedUser = null;
let allBadges = {};

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login/";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const userDocSnap = await getDoc(doc(db, "users", user.uid));

  if (!userDocSnap.exists()) {
    setStatus("Errore: utente non trovato", "error");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    return;
  }

  const userData = userDocSnap.data();
  const allowedRoles = ["advstaffplus", "superadmin"];

  if (!allowedRoles.includes(userData.role)) {
    setStatus("Accesso negato: non hai permessi per gestire i badge", "error");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    return;
  }

  const timeoutId = setTimeout(() => {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  await loadBadges();
  setupSearch();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

async function loadBadges() {
  try {
    const badgesSnap = await getDocs(collection(db, "badges"));
    badgesSnap.forEach(doc => {
      allBadges[doc.id] = doc.data();
    });
  } catch (err) {
    console.error("Errore caricamento badge:", err);
  }
}

function setupSearch() {
  userSearchInput.addEventListener("keyup", async (e) => {
    const searchTerm = e.target.value.toLowerCase();

    if (searchTerm.length < 2) {
      usersListEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: 2rem;">Digita almeno 2 caratteri...</div>';
      return;
    }

    try {
      usersListEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: 2rem;">Ricerca in corso...</div>';

      const q = query(collection(db, "users"), where("role", "=", "user"));
      const usersSnap = await getDocs(q);

      const results = [];

      usersSnap.forEach(doc => {
        const userData = doc.data();
        const fullName = `${userData.name || ""} ${userData.surname || ""}`.toUpperCase();
        const email = (userData.email || "").toLowerCase();
        const username = (userData.username || "").toLowerCase();

        if (fullName.includes(searchTerm) || email.includes(searchTerm) || username.includes(searchTerm)) {
          results.push({
            id: doc.id,
            name: fullName.trim() || "Senza nome",
            email: userData.email || "N/D",
            username: userData.username || "N/D"
          });
        }
      });

      if (results.length === 0) {
        usersListEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: 2rem;">Nessun utente trovato</div>';
        return;
      }

      usersListEl.innerHTML = "";
      results.forEach(user => {
        const userItem = document.createElement("div");
        userItem.className = `user-item ${currentSelectedUser?.id === user.id ? 'active' : ''}`;
        userItem.innerHTML = `
          <div class="user-info">
            <div class="user-name">${user.name}</div>
            <div class="user-email">${user.email}</div>
          </div>
        `;
        userItem.addEventListener("click", () => selectUser(user));
        usersListEl.appendChild(userItem);
      });

    } catch (err) {
      console.error("Errore ricerca utenti:", err);
      setStatus("Errore durante la ricerca", "error");
    }
  });
}

async function selectUser(user) {
  currentSelectedUser = user;

  document.querySelectorAll(".user-item").forEach(el => el.classList.remove("active"));
  event.currentTarget.classList.add("active");

  badgesContentEl.style.display = "none";
  earnedBadgesContainerEl.style.display = "block";
  availableBadgesContainerEl.style.display = "block";

  await loadUserBadges(user.id);
}

async function loadUserBadges(userId) {
  try {
    earnedBadgesListEl.innerHTML = "";
    availableBadgesListEl.innerHTML = "";

    const userBadgesSnap = await getDocs(collection(db, "users", userId, "badges"));
    const earnedBadgeIds = new Set();

    userBadgesSnap.forEach(doc => {
      earnedBadgeIds.add(doc.id);
      const badgeId = doc.id;
      const badgeData = doc.data();
      const badgeMeta = allBadges[badgeId];

      if (!badgeMeta) return;

      const badgeEl = createBadgeCard(badgeMeta, badgeId, badgeData, true);
      earnedBadgesListEl.appendChild(badgeEl);
    });

    if (earnedBadgeIds.size === 0) {
      earnedBadgesListEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: 1rem; grid-column: 1 / -1;">Nessun badge ancora</div>';
    }

    for (const [badgeId, badgeMeta] of Object.entries(allBadges)) {
      if (badgeMeta.enabled !== false && !earnedBadgeIds.has(badgeId)) {
        const badgeEl = createBadgeCard(badgeMeta, badgeId, null, false);
        availableBadgesListEl.appendChild(badgeEl);
      }
    }

    if (availableBadgesListEl.children.length === 0) {
      availableBadgesListEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: 1rem; grid-column: 1 / -1;">Tutti i badge sono stati assegnati</div>';
    }

  } catch (err) {
    console.error("Errore caricamento badge utente:", err);
    setStatus("Errore nel caricamento dei badge", "error");
  }
}

function createBadgeCard(badgeMeta, badgeId, badgeData, isEarned) {
  const card = document.createElement("div");
  card.className = "badge-item";

  const earnedDate = badgeData?.earnedAt?.toDate?.();
  const earnedDateStr = earnedDate ? earnedDate.toLocaleDateString("it-IT") : "";

  card.innerHTML = `
    <div class="badge-info">
      <img src="${badgeMeta.icon || '/assets/badges/default.svg'}" alt="${badgeMeta.name}" class="badge-icon">
      <div class="badge-details">
        <div class="badge-name">${badgeMeta.name}</div>
        ${isEarned ? `<div class="badge-earned">📅 ${earnedDateStr}</div>` : `<div class="badge-earned">${badgeMeta.description || ""}</div>`}
      </div>
    </div>
    <button class="btn-${isEarned ? 'remove' : 'add'}">${isEarned ? '❌ Rimuovi' : '✅ Aggiungi'}</button>
  `;

  const button = card.querySelector("button");
  button.addEventListener("click", async () => {
    if (isEarned) {
      await removeBadge(currentSelectedUser.id, badgeId, badgeMeta.name);
    } else {
      await addBadge(currentSelectedUser.id, badgeId, badgeMeta.name);
    }
  });

  return card;
}

async function addBadge(userId, badgeId, badgeName) {
  try {
    const badgeDocRef = doc(db, "users", userId, "badges", badgeId);
    await updateDoc(badgeDocRef, {
      earnedAt: serverTimestamp(),
      notificationSent: false
    }).catch(async (err) => {
      if (err.code === "not-found") {
        await updateDoc(doc(db, "users", userId, "badges", badgeId), {
          earnedAt: serverTimestamp(),
          notificationSent: false
        });
      }
    });

    await addDoc(collection(db, "users", userId, "badges"), {
      badgeId: badgeId,
      earnedAt: serverTimestamp(),
      notificationSent: false
    }).catch(() => {
      
    });

    const badgeRef = doc(db, "users", userId, "badges", badgeId);
    const badgeSnap = await getDoc(badgeRef);
    if (!badgeSnap.exists()) {
      await setDoc(badgeRef, {
        earnedAt: serverTimestamp(),
        notificationSent: false
      });
    } else {
      await updateDoc(badgeRef, {
        earnedAt: serverTimestamp()
      });
    }

    await addDoc(collection(db, "activities"), {
      userId: userId,
      badgeId: badgeId,
      type: "badge_added",
      staffUserId: auth.currentUser.uid,
      timestamp: serverTimestamp()
    });

    setStatus(`✅ Badge "${badgeName}" assegnato con successo`, "success");
    await loadUserBadges(userId);

  } catch (err) {
    console.error("Errore aggiunta badge:", err);
    setStatus(`❌ Errore nell'assegnazione del badge: ${err.message}`, "error");
  }
}

async function removeBadge(userId, badgeId, badgeName) {
  if (!confirm(`Sei sicuro di voler rimuovere il badge "${badgeName}" a questo utente?`)) {
    return;
  }

  try {
    await deleteDoc(doc(db, "users", userId, "badges", badgeId));

    await addDoc(collection(db, "activities"), {
      userId: userId,
      badgeId: badgeId,
      type: "badge_removed",
      staffUserId: auth.currentUser.uid,
      timestamp: serverTimestamp()
    });

    setStatus(`✅ Badge "${badgeName}" rimosso con successo`, "success");
    await loadUserBadges(userId);

  } catch (err) {
    console.error("Errore rimozione badge:", err);
    setStatus(`❌ Errore nella rimozione del badge: ${err.message}`, "error");
  }
}

function setStatus(message, type = "info") {
  const classNameBox = document.querySelector(".statusBox");
  statusMsg.textContent = message;
  classNameBox.className = `${"statusBox" + " " + type}`;
  classNameBox.style.display = "block";
  const closeBtn = document.getElementById("closeSMsg");
  closeBtn.onclick = () => {
    classNameBox.style.display = "none";
  }
}