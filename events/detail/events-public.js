import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js"

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const eventsList = document.getElementById("eventsList");
const statusMsg = document.getElementById("statusMsg");
const titleEvent = document.getElementById("titleEvent");
const eventIdh = document.getElementById("eventId");

const idParam = new URLSearchParams(window.location.search);
const eventId = idParam.get('id');

if (!eventId) {
    eventsList.innerHTML = "<p class='error'>❌ Nessun ID evento fornito nell'URL.</p>";
    throw new Error("Missing event ID");
}

async function loadPublicEvent() {
  try {
    const ref = doc(db, "events", eventId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      eventsList.innerHTML = "<p class='info'>❌ Questo ID evento non esiste nel database.</p>";
      return;
    }

    const e = snap.data();
    eventsList.innerHTML = "";

    eventIdh.textContent = `📅 Evento: ${e.title}`;
    titleEvent.textContent = `${e.title} - Registro Eventi | MyFrEM - La migliore in Friuli-Venezia Giulia nel caricamento foto inerenti l'emergenza`;

    const div = document.createElement("div");
    div.className = "event-card";

    div.innerHTML = `
        <h3>${e.title}</h3>

        <h4><b>🆔 ID Evento:</b></h4>
        <p>${eventId}</p>

        <h4><b>📍 Luogo:</b></h4>
        <p>${e.location || "Non specificato."}</p>

        <h4><b>📝 Descrizione:</b></h4>
        <p>${e.description || "Non specificata."}</p>

        <h4><b>Data e ora:</b></h4>
        <p>${e.date || "N/D"} alle ${e.time || "N/D"}</p>

        <h4><b>📲 Stato di revisione staff:</b></h4>
        <p class="status null">${e.status || "Non trovato."}</p>

        <h4><b>📅 Data creazione richiesta:</b></h4>
        <p>${e.createdAt?.toDate().toLocaleString() || "Non trovata."}</p>

        <h4><b>😁 Promulgato da:</b></h4>
        <p>${e.userId || "Friuli Emergenze"}</p>

        <button onclick="window.close()" class="btn-close_window">❌ Chiudi finestra</button>
    `;

    eventsList.appendChild(div);

  } catch (err) {
    console.error(err);
    statusMsg.textContent = "❌ Errore nel caricamento dell'evento.";
  }
}

loadPublicEvent();