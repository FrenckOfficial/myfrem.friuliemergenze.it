import { firebaseConfig } from "../configFirebase.js";

// --- Init Firebase ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

console.log("👉 Inizializzo Firebase...");

// --- Elementi UI ---
const userNameEl = document.getElementById("userName");
const totalPhotosEl = document.getElementById("totalPhotos");
const approvedPhotosEl = document.getElementById("approvedPhotos");
const pendingPhotosEl = document.getElementById("pendingPhotos");
const rejectedPhotosEl = document.getElementById("rejectedPhotos");
const eventsListEl = document.getElementById("eventsList");
const activityListEl = document.getElementById("activityList");
const totalEventsEl = document.getElementById("totalEvents");
const approvedEventsEl = document.getElementById("approvedEvents");
const pendingEventsEl = document.getElementById("pendingEvents");
const rejectedEventsEl = document.getElementById("rejectedEvents");
const organizedEventsEl = document.getElementById("organizedEvents");

// --- Controllo autenticazione ---
auth.onAuthStateChanged(async (user) => {
  console.log("👀 onAuthStateChanged triggered, user:", user);

  // PRIMA cosa: controlla se user esiste
  if (!user) {
    console.warn("⚠️ Nessun utente loggato, redirect al login...");
    window.location.href = "/login/";
    return;
  }

  try {
    // Recupera dati Firestore dell’utente
    const userDoc = await db.collection("users").doc(user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    // Verifica ruolo SOLO se userData esiste
    if (userData?.role === "staff") {
      alert("Accesso negato: solo utenti normali possono accedere a questa pagina. Utilizza il tuo account personale.");
      window.location.href = "/staff/dashboard/";
      return;
    }

    // Mostra nome utente
    if (userData) {
      userNameEl.textContent = `${userData.name} (${userData.username})`;
    } else {
      userNameEl.textContent = "Utente";
    }

    // --- FOTO ---
    const photosSnap = await db.collection("photos")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    let total = 0, approved = 0, pending = 0, rejected = 0;
    activityListEl.innerHTML = "";

    photosSnap.forEach(doc => {
      const photo = doc.data();
      total++;

      if (photo.status === "Approvata ✅") approved++;
      if (photo.status === "Foto in attesa di approvazione ⌛") pending++;
      if (photo.status === "Rifiutata ❌") rejected++;

      const li = document.createElement("li");
      li.innerHTML = `
        <p>📸 Foto caricata il ${
          photo.createdAt?.toDate().toLocaleString() || "data sconosciuta"
        } - Stato: <b>${photo.status}</b></p>
      `;
      activityListEl.appendChild(li);
    });

    totalPhotosEl.textContent = total;
    approvedPhotosEl.textContent = approved;
    pendingPhotosEl.textContent = pending;
    rejectedPhotosEl.textContent = rejected;

    if (total === 0) {
      activityListEl.innerHTML = "<li>Nessuna attività recente.</li>";
    }

    // --- EVENTI ---
    eventsListEl.innerHTML = "<p>Nessun evento disponibile per l'iscrizione.</p>";
    const eventsSnap = await db.collection("events")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    
    eventsSnap.forEach(doc => {
      const event = doc.data();
      if (event.status === "Organizzato") {
        eventsListEl.innerHTML += `
          <div class="event-card">
            <h3>${event.title}</h3>
            <p>Data e ora: ${event.date || "Data e/o ora sconosciute"}  ${event.time || ""}</p>
            <p>Luogo: ${event.location || "Luogo sconosciuto"}</p>
            <a href="/events/join/?event=${doc.id}" class="btn" target="_blank">Iscriviti</a>
          </div>
        `;
      }
    });

  } catch (err) {
    console.error("[FOTO] ❌ Errore durante il recupero dati Firestore:", err);
  }

  // --- EVENTI ---
  try {
    const userDoc = await db.collection("users").doc(user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    const eventsSnap = await db.collection("events")
      .where("userId", "==", userData.name + " " + userData.surname)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    let totalE = 0, approvedE = 0, pendingE = 0, rejectedE = 0, organizedE = 0;

    eventsSnap.forEach(doc => {
      const event = doc.data();
      totalE++;

      if (event.status === "Approvato") approvedE++;
      if (event.status === "In revisione...") pendingE++;
      if (event.status === "Rifiutato") rejectedE++;
      if (event.status === "Organizzato") organizedE++;
    });

    totalEventsEl.textContent = totalE;
    approvedEventsEl.textContent = approvedE;
    pendingEventsEl.textContent = pendingE;
    rejectedEventsEl.textContent = rejectedE;
    organizedEventsEl.textContent = organizedE;

  } catch (err) {
    console.error("[EVENTI] ❌ Errore durante il recupero dati Firestore:", err);
  }
});

// --- Logout ---
document.getElementById("logoutBtn").addEventListener("click", async () => {
  console.log("🚪 Logout in corso...");
  await auth.signOut();
  console.log("✅ Logout completato, redirect...");
  window.location.href = "/login/";
});