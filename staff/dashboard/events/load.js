import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, updateDoc, addDoc, doc, query, orderBy, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "https://myfrem.friuliemergenze.it/configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.getElementById("logoutBtn").onclick = () => signOut(auth);

const eventsList = document.getElementById("eventsList");
const statusMsg = document.getElementById("statusMsg");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

const EVENT_STATUSES = {
  REVIEW: "In revisione...",
  APPROVED: "Approvato",
  ORGANIZED: "Organizzato",
  REJECTED: "Rifiutato"
};

const ACTIVITY_TYPES = {
  ORGANIZED: "event_organized",
  APPROVAL: "event_approval",
  REJECTION: "event_rejection",
  HIDDEN: "event_hidden_from_dashboard"
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }
  
  const q = query(collection(db, "users"), where("__name__", "==", user.uid));
  const userDoc = await getDocs(q);
  
  const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];
  
  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    setStatus("Accesso negato: non sei staff!", "error");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 2000);
    return;
  }
  
  const timeoutId = setTimeout(() => {
    console.warn("⏱️ Timeout caricamento (7s), forzando visualizzazione");
    showContent();
  }, 7000);

  try {
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      eventsList.innerHTML = "<p class='info'>Non ci sono richieste di eventi al momento.</p>";
      showContent();
      clearTimeout(timeoutId);
      return;
    }

    eventsList.innerHTML = "";

    snap.forEach(docSnap => {
      const e = docSnap.data();
      const eventId = docSnap.id;
      const div = document.createElement("article");
      div.className = "event-card";
      div.setAttribute("data-event-id", eventId);
      div.setAttribute("role", "region");
      div.setAttribute("aria-label", `Evento: ${e.title}`);

      const statusClass = getStatusClass(e.status);

      div.innerHTML = `
        <h3>${escapeHtml(e.title)}</h3>
        <p><b>📍 Luogo:</b> ${escapeHtml(e.location)}</p>
        <p class="description">${escapeHtml(e.description.length > 150 ? e.description.slice(0, 150) + "..." : e.description)}</p>
        <span class="status ${statusClass}" aria-live="polite">
          ${e.status}
        </span>
        <div class="actions" role="group" aria-label="Azioni evento">
          <button class="btn-action btn-organized" aria-label="Contrassegna come Organizzato">Contrassegna come Organizzato</button>
          <button class="btn-action btn-approve" aria-label="Approva evento">Approva</button>
          <button class="btn-action btn-reject" aria-label="Rifiuta evento">Rifiuta</button>
          <button class="btn-action btn-view" aria-label="Visualizza dettagli evento">Visualizza Evento</button>
          <button class="btn-action btn-view1" aria-label="Nascondi dalla dashboard utente">Non mostrare in dashboard</button>
        </div>
      `;

      updateButtonStates(div, e.status, e.showInDash);

      div.querySelector(".btn-organized").addEventListener("click", () => handleOrganized(eventId, e.title, div));
      div.querySelector(".btn-approve").addEventListener("click", () => handleApprove(eventId, e.title, div));
      div.querySelector(".btn-reject").addEventListener("click", () => handleReject(eventId, e.title, div));
      div.querySelector(".btn-view").addEventListener("click", () => {
        window.open(`/events/detail/?id=${encodeURIComponent(eventId)}`, '_blank');
      });
      div.querySelector(".btn-view1").addEventListener("click", () => handleHideFromDash(eventId, div));

      eventsList.appendChild(div);
    });

    showContent();
    clearTimeout(timeoutId);

  } catch (err) {
    console.error("Errore nel caricamento degli eventi:", err);
    statusMsg.textContent = "❌ Errore nel caricamento degli eventi.";
    showContent();
    clearTimeout(timeoutId);
  }
});

function updateButtonStates(cardElement, status, showInDash) {
  const btnOrganized = cardElement.querySelector(".btn-organized");
  const btnApprove = cardElement.querySelector(".btn-approve");
  const btnReject = cardElement.querySelector(".btn-reject");
  const btnHide = cardElement.querySelector(".btn-view1");

  [btnOrganized, btnApprove, btnReject, btnHide].forEach(btn => {
    btn.disabled = false;
    btn.classList.remove("disabled");
  });

  switch (status) {
    case EVENT_STATUSES.ORGANIZED:
      btnOrganized.disabled = true;
      btnApprove.disabled = true;
      btnReject.disabled = true;
      btnHide.disabled = false;
      break;

    case EVENT_STATUSES.APPROVED:
      btnApprove.disabled = true;
      btnReject.disabled = true;
      btnOrganized.disabled = false;
      break;

    case EVENT_STATUSES.REJECTED:
      btnApprove.disabled = true;
      btnReject.disabled = true;
      btnOrganized.disabled = true;
      break;

    case EVENT_STATUSES.REVIEW:
      break;
  }

  if (showInDash === false) {
    btnHide.disabled = true;
  }

  [btnOrganized, btnApprove, btnReject, btnHide].forEach(btn => {
    if (btn.disabled) {
      btn.classList.add("disabled");
    }
  });
}

function getStatusClass(status) {
  switch (status) {
    case EVENT_STATUSES.REVIEW:
      return "revision";
    case EVENT_STATUSES.APPROVED:
      return "approved";
    case EVENT_STATUSES.ORGANIZED:
      return "organized";
    case EVENT_STATUSES.REJECTED:
      return "rejected";
    default:
      return "revision";
  }
}

async function handleOrganized(eventId, title, cardElement) {
  try {
    const eventRef = doc(db, "events", eventId);
    
    const btn = cardElement.querySelector(".btn-organized");
    btn.disabled = true;

    await Promise.all([
      updateDoc(eventRef, { status: EVENT_STATUSES.ORGANIZED }),
      addDoc(collection(db, "activities"), {
        organizationStaffer: auth.currentUser.email || "-",
        eventTitle: title,
        timestamp: serverTimestamp(),
        type: ACTIVITY_TYPES.ORGANIZED,
      })
    ]);

    const statusEl = cardElement.querySelector(".status");
    statusEl.textContent = EVENT_STATUSES.ORGANIZED;
    statusEl.className = "status organized";
    
    updateButtonStates(cardElement, EVENT_STATUSES.ORGANIZED, true);
    setStatus("✅ Evento contrassegnato come Organizzato", "success");

  } catch (err) {
    console.error("Errore nel contrassegnare come organizzato:", err);
    setStatus("❌ Errore: impossibile aggiornare l'evento", "error");
    cardElement.querySelector(".btn-organized").disabled = false;
  }
}

async function handleApprove(eventId, title, cardElement) {
  try {
    const eventRef = doc(db, "events", eventId);
    const btn = cardElement.querySelector(".btn-approve");
    btn.disabled = true;

    await Promise.all([
      updateDoc(eventRef, { status: EVENT_STATUSES.APPROVED }),
      addDoc(collection(db, "activities"), {
        approvalStaffer: auth.currentUser.email || "-",
        eventTitle: title,
        timestamp: serverTimestamp(),
        type: ACTIVITY_TYPES.APPROVAL,
      })
    ]);

    const statusEl = cardElement.querySelector(".status");
    statusEl.textContent = EVENT_STATUSES.APPROVED;
    statusEl.className = "status approved";
    
    updateButtonStates(cardElement, EVENT_STATUSES.APPROVED, true);
    setStatus("✅ Evento approvato", "success");

  } catch (err) {
    console.error("Errore nell'approvazione:", err);
    setStatus("❌ Errore: impossibile approvare l'evento", "error");
    cardElement.querySelector(".btn-approve").disabled = false;
  }
}

async function handleReject(eventId, title, cardElement) {
  try {
    const eventRef = doc(db, "events", eventId);
    const btn = cardElement.querySelector(".btn-reject");
    btn.disabled = true;

    await Promise.all([
      updateDoc(eventRef, { status: EVENT_STATUSES.REJECTED }),
      addDoc(collection(db, "activities"), {
        rejectionStaffer: auth.currentUser.email || "-",
        eventTitle: title,
        timestamp: serverTimestamp(),
        type: ACTIVITY_TYPES.REJECTION,
      })
    ]);

    const statusEl = cardElement.querySelector(".status");
    statusEl.textContent = EVENT_STATUSES.REJECTED;
    statusEl.className = "status rejected";
    
    updateButtonStates(cardElement, EVENT_STATUSES.REJECTED, true);
    setStatus("✅ Evento rifiutato", "success");

  } catch (err) {
    console.error("Errore nel rifiuto:", err);
    setStatus("❌ Errore: impossibile rifiutare l'evento", "error");
    cardElement.querySelector(".btn-reject").disabled = false;
  }
}

async function handleHideFromDash(eventId, cardElement) {
  try {
    const eventRef = doc(db, "events", eventId);
    const btn = cardElement.querySelector(".btn-view1");
    btn.disabled = true;

    await Promise.all([
      updateDoc(eventRef, { showInDash: false }),
      addDoc(collection(db, "activities"), {
        staffer: auth.currentUser.email || "-",
        eventId: eventId,
        timestamp: serverTimestamp(),
        type: ACTIVITY_TYPES.HIDDEN,
      })
    ]);

    setStatus("✅ Evento nascosto dalla dashboard utente", "success");

  } catch (err) {
    console.error("Errore nel nascondere l'evento:", err);
    setStatus("❌ Errore: impossibile nascondere l'evento", "error");
    cardElement.querySelector(".btn-view1").disabled = false;
  }
}

function showContent() {
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
}

function setStatus(message, type = "info") {
  const classNameBox = document.querySelector(".statusBox");
  statusMsg.textContent = message;
  classNameBox.className = `statusBox ${type}`;
  classNameBox.style.display = "block";
  
  const closeBtn = document.getElementById("closeSMsg");
  closeBtn.onclick = () => {
    classNameBox.style.display = "none";
  };

  setTimeout(() => {
    if (classNameBox.style.display === "block") {
      classNameBox.style.display = "none";
    }
  }, 5000);
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}