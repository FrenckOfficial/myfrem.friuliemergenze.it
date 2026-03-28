import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "../../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get("event_id");

const titleEvent = document.getElementById("titleEvent");
const eventsList = document.getElementById("eventsList");
const eventIdPage = document.getElementById("eventId");

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "/login";
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

        <h4><b>🕜 Ora evento:</b></h4>
        <input type="time" id="eventTime" value="${event.time || ""}">

        <button id="confirmBtn" class="btn-close_window">Conferma</button>
    `;

    eventsList.appendChild(div);

    document.getElementById("confirmBtn").addEventListener("click", confirmOrg);
}

async function confirmOrg() {
    const placeEl = document.getElementById("eventPlace").value;
    const dateEl = document.getElementById("eventDate").value;
    const timeEl = document.getElementById("eventTime").value;

    if (confirm("Conferma organizzazione evento con questi dati?")) {
        await updateDoc(doc(db, "events", eventId), {
            date: dateEl,
            time: timeEl,
            location: placeEl,
            status: "Organizzato",
        });

        alert("Organizzazione confermata.");
        window.history.back();
    }
}

loadEventPage();