import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const badgeForm = document.getElementById("badgeForm");
const badgesListEl = document.getElementById("badgesList");
const badgeNameInput = document.getElementById("badgeName");
const badgeDescriptionInput = document.getElementById("badgeDescription");
const badgeIconInput = document.getElementById("badgeIcon");
const badgeColorInput = document.getElementById("badgeColor");
const badgeColorHexInput = document.getElementById("badgeColorHex");
const criteriaTypeInput = document.getElementById("criteriaType");
const criteriaThresholdInput = document.getElementById("criteriaThreshold");
const badgeEnabledInput = document.getElementById("badgeEnabled");
const thresholdHint = document.getElementById("thresholdHint");
const statusMsg = document.getElementById("statusMsg");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");
const logoutBtn = document.getElementById("logoutBtn");
const iconPreview = document.getElementById("iconPreview");
const previewImg = document.getElementById("previewImg");

const criteriaHints = {
  photos: "Numero di foto approvate",
  events: "Numero di eventi creati",
  surveys: "Numero di survey completati",
  exploration: "Numero di servizi diversi fotografati",
  time: "Numero di giorni da membro",
  manual: "Assegnato manualmente da staff (ignora soglia)"
};

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
  setupFormHandlers();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

function setupFormHandlers() {
  badgeIconInput.addEventListener("change", () => {
    if (badgeIconInput.value) {
      previewImg.src = badgeIconInput.value;
      iconPreview.style.display = "block";
    }
  });

  badgeColorInput.addEventListener("change", (e) => {
    badgeColorHexInput.value = e.target.value;
  });

  badgeColorHexInput.addEventListener("change", (e) => {
    if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
      badgeColorInput.value = e.target.value;
    } else {
      setStatus("Colore hex non valido (es. #ff7b00)", "error");
    }
  });

  criteriaTypeInput.addEventListener("change", (e) => {
    thresholdHint.textContent = criteriaHints[e.target.value] || "";
  });

  badgeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await createBadge();
  });
}

async function createBadge() {
  const badgeId = badgeNameInput.value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const badgeData = {
    id: badgeId,
    name: badgeNameInput.value,
    description: badgeDescriptionInput.value,
    icon: badgeIconInput.value,
    color: badgeColorInput.value,
    criteria: {
      type: criteriaTypeInput.value,
      threshold: parseInt(criteriaThresholdInput.value) || 0
    },
    enabled: badgeEnabledInput.checked,
    createdAt: serverTimestamp()
  };

  if (!badgeData.name || !badgeData.description || !badgeData.icon || !badgeData.criteria.type) {
    setStatus("❌ Compila tutti i campi obbligatori", "error");
    return;
  }

  try {
    await setDoc(doc(db, "badges", badgeId), badgeData);
    setStatus(`✅ Badge "${badgeData.name}" creato con successo!`, "success");
    badgeForm.reset();
    badgeColorInput.value = "#ff7b00";
    badgeColorHexInput.value = "#ff7b00";
    iconPreview.style.display = "none";
    await loadBadges();
  } catch (err) {
    console.error("Errore creazione badge:", err);
    setStatus(`❌ Errore: ${err.message}`, "error");
  }
}

async function loadBadges() {
  try {
    const badgesSnap = await getDocs(collection(db, "badges"));
    badgesListEl.innerHTML = "";

    if (badgesSnap.empty) {
      badgesListEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: 2rem; grid-column: 1 / -1;">Nessun badge nel sistema</div>';
      return;
    }

    badgesSnap.forEach(doc => {
      const badge = doc.data();
      const badgeEl = createBadgeCard(badge, doc.id);
      badgesListEl.appendChild(badgeEl);
    });

  } catch (err) {
    console.error("Errore caricamento badge:", err);
    setStatus("Errore nel caricamento dei badge", "error");
  }
}

function createBadgeCard(badge, badgeId) {
  const card = document.createElement("div");
  card.className = "badge-card";

  const statusClass = badge.enabled ? "enabled" : "disabled";

  card.innerHTML = `
    <div class="badge-card-header">
      <img src="${badge.icon}" alt="${badge.name}" class="badge-card-icon">
      <div class="badge-card-info">
        <div class="badge-card-name">${badge.name}</div>
        <div class="badge-card-desc">${badge.description}</div>
      </div>
      <div class="badge-card-status ${statusClass}">${badge.enabled ? "🟢 Attivo" : "🔴 Inattivo"}</div>
    </div>

    <div class="badge-card-details">
      <div class="detail-row">
        <span class="detail-label">Criterio:</span>
        <span class="detail-value">${badge.criteria.type}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Soglia:</span>
        <span class="detail-value">${badge.criteria.threshold}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Colore:</span>
        <span class="detail-value">
          <div class="color-dot" style="background: ${badge.color}; width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--border); display: inline-block;"></div>
          ${badge.color}
        </span>
      </div>
    </div>

    <div class="badge-card-actions">
      <button class="btn-edit" data-badge-id="${badgeId}">✏️ Modifica</button>
      <button class="btn-delete" data-badge-id="${badgeId}">🗑️ Elimina</button>
      <button class="btn-toggle" data-badge-id="${badgeId}">${badge.enabled ? '⏸️ Disattiva' : '▶️ Attiva'}</button>
    </div>
  `;

  const btnEdit = card.querySelector(".btn-edit");
  const btnDelete = card.querySelector(".btn-delete");
  const btnToggle = card.querySelector(".btn-toggle");

  btnEdit.addEventListener("click", () => editBadge(badgeId, badge));
  btnDelete.addEventListener("click", () => deleteBadge(badgeId, badge.name));
  btnToggle.addEventListener("click", () => toggleBadge(badgeId, badge.enabled));

  return card;
}

function editBadge(badgeId, badge) {
  badgeNameInput.value = badge.name;
  badgeDescriptionInput.value = badge.description;
  badgeIconInput.value = badge.icon;
  badgeColorInput.value = badge.color;
  badgeColorHexInput.value = badge.color;
  criteriaTypeInput.value = badge.criteria.type;
  criteriaThresholdInput.value = badge.criteria.threshold;
  badgeEnabledInput.checked = badge.enabled;
  
  previewImg.src = badge.icon;
  iconPreview.style.display = "block";
  thresholdHint.textContent = criteriaHints[badge.criteria.type] || "";

  const submitBtn = badgeForm.querySelector("button[type='submit']");
  submitBtn.textContent = "💾 Aggiorna Badge";

  badgeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await updateBadge(badgeId);
  }, { once: true });

  document.querySelector(".create-badge-section").scrollIntoView({ behavior: "smooth" });
}

async function updateBadge(badgeId) {
  const badgeData = {
    name: badgeNameInput.value,
    description: badgeDescriptionInput.value,
    icon: badgeIconInput.value,
    color: badgeColorInput.value,
    criteria: {
      type: criteriaTypeInput.value,
      threshold: parseInt(criteriaThresholdInput.value) || 0
    },
    enabled: badgeEnabledInput.checked
  };

  try {
    await updateDoc(doc(db, "badges", badgeId), badgeData);
    setStatus(`✅ Badge aggiornato con successo!`, "success");
    badgeForm.reset();
    badgeColorInput.value = "#ff7b00";
    badgeColorHexInput.value = "#ff7b00";
    iconPreview.style.display = "none";
    const submitBtn = badgeForm.querySelector("button[type='submit']");
    submitBtn.textContent = "✅ Crea Badge";
    await loadBadges();
  } catch (err) {
    console.error("Errore aggiornamento:", err);
    setStatus(`❌ Errore: ${err.message}`, "error");
  }
}

async function deleteBadge(badgeId, badgeName) {
  if (!confirm(`Sei sicuro di voler eliminare il badge "${badgeName}"? Questa azione è irreversibile.`)) {
    return;
  }

  try {
    await deleteDoc(doc(db, "badges", badgeId));
    setStatus(`✅ Badge eliminato con successo`, "success");
    await loadBadges();
  } catch (err) {
    console.error("Errore eliminazione:", err);
    setStatus(`❌ Errore: ${err.message}`, "error");
  }
}

async function toggleBadge(badgeId, currentEnabled) {
  try {
    await updateDoc(doc(db, "badges", badgeId), {
      enabled: !currentEnabled
    });
    setStatus(`✅ Badge ${!currentEnabled ? 'attivato' : 'disattivato'} con successo`, "success");
    await loadBadges();
  } catch (err) {
    console.error("Errore toggle:", err);
    setStatus(`❌ Errore: ${err.message}`, "error");
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