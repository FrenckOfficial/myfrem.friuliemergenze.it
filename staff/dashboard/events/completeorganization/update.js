import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "https://myfrem.friuliemergenze.it/configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get("event_id");
const statusMsg = document.getElementById("statusMsg");
const titleEvent = document.getElementById("titleEvent");
const eventsList = document.getElementById("eventsList");
const eventIdPage = document.getElementById("eventId");

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  const allowedRoles = ["advstaffplus", "superadmin"];

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

  await loadEventPage();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

async function loadEventPage() {
    const ref = doc(db, "events", eventId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        eventsList.innerHTML = "<p class='info'>❌ Questo ID evento non esiste nel database.</p>";
        return;
    }

    const event = snap.data();

    eventIdPage.textContent = `📅 Evento: ${event.title}`;
    titleEvent.textContent = `Completa organizzazione evento ${event.title} - Registro Eventi | MyFrEM - La migliore in Friuli-Venezia Giulia nel caricamento foto inerenti l'emergenza`;

    const div = document.createElement("div");
    div.className = "event-card";

    div.innerHTML = `
        <h3>Completa organizzazione evento</h3>
        <h3>Evento ${eventId}</h3>

        <h4><b>📍 Luogo evento:</b></h4>
        <input type="text" id="eventPlace" value="${event.location || ""}">

        <h4><b>📅 Data evento:</b></h4>
        <input type="date" id="eventDate" value="${event.date || ""}">

        <h4><b>🕜 Ora inizio evento:</b></h4>
        <input type="time" id="eventTimeStart" value="${event.time || ""}">

        <button id="confirmBtn" class="btn-close_window">Conferma</button>
    `;

    eventsList.appendChild(div);

    document.getElementById("confirmBtn").addEventListener("click", confirmOrg);
}

async function confirmOrg() {
    const placeEl = document.getElementById("eventPlace").value;
    const dateEl = document.getElementById("eventDate").value;
    const startTimeEl = document.getElementById("eventTimeStart").value;

    if (confirm("Conferma organizzazione evento con questi dati?")) {
        await updateDoc(doc(db, "events", eventId), {
            date: dateEl,
            startTime: startTimeEl,
            location: placeEl,
            status: "Organizzato",
            showInDash: true
        });

        setStatus("Organizzazione confermata.", "success");
        window.history.back();
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