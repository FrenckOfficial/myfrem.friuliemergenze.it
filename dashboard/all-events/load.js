import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
  window.location.href = "/login";
};

const eventsList = document.getElementById("eventsList");
const statusMsg = document.getElementById("statusMsg");
const logoutBtn = document.getElementById("logoutBtn");

logoutBtn.onclick = async () => {
  await signOut(auth);
  window.location.href = "/login";
};

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

onAuthStateChanged(auth, async (user) => {
  const timeoutId = setTimeout(() => {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }, 5000);

  try {
    if (!user) {
      clearTimeout(timeoutId);
      window.location.href = "/login";
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      statusMsg.textContent = "❌ Errore: utente non trovato.";
      statusMsg.className = "error";
      clearTimeout(timeoutId);
      loadingEl.style.display = "none";
      contentEl.style.display = "block";;
      return;
    }

    // 🔒 Controlla il ruolo
    const userData = userDoc.data();
    if (userData.role === "testacc") {
      document.body.classList.add("read-only-mode");
      statusMsg.textContent = "📖 Modalità sola lettura";
      statusMsg.className = "warning";
    }

    const q = query(
      collection(db, "events"),
      where("userId", "==", userData.name + " " + userData.surname),
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      eventsList.innerHTML = "<p class='info' style='margin-top=\"200px\"'>Non hai ancora creato nessun evento.</p>";
      clearTimeout(timeoutId);
      loadingEl.style.display = "none";
      contentEl.style.display = "block";;
      return;
    }

    eventsList.innerHTML = "";

    snap.forEach(doc => {
      const e = doc.data();

      const div = document.createElement("div");
      div.className = "photo-card";

      let statusText = "In revisione...";
      if (e.status === "In approvazione") statusText = "In approvazione.";
      else if (e.status === "Organizzato") statusText = "Organizzato.";
      else if (e.status === "Rifiutato") statusText = "L'organizzazione dell'evento è stata rifiutata.";

      div.innerHTML = `
        <div class="photo-info">
          <h3>${e.title}</h3>
          <p><strong>📍 Luogo:</strong> ${e.location}</p>
          <p><strong>📝 Descrizione:</strong> ${e.description.length > 150 ? e.description.slice(0, 150) + "..." : e.description}</p>
          <span class="status ${e.status || 'pending'}">${statusText}</span>
        </div>
        <a href="/events/detail/?id=${doc.id}" target="_blank" class="btn-view">Visualizza Evento</a>
      `;

      eventsList.appendChild(div);
    });

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;

  } catch (err) {
    console.error("❌ Errore caricamento eventi:", err);
    statusMsg.textContent = "❌ Errore nel caricamento degli eventi.";
    statusMsg.className = "error";
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }
});