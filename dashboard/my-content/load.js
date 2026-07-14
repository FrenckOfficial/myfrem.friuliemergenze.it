import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const photosContainer = document.getElementById("photosContainer");
const eventsList = document.getElementById("eventsList");
const statusMsg = document.getElementById("statusMsg");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");
const logoutBtn = document.getElementById("logoutBtn");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    tabContents.forEach(tc => tc.classList.remove("active"));
    
    btn.classList.add("active");
    const target = btn.getAttribute("data-tab");
    document.getElementById(target).classList.add("active");
  });
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

onAuthStateChanged(auth, async (user) => {
  const timeoutId = setTimeout(() => {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 5000);

  try {
    if (!user) {
      clearTimeout(timeoutId);
      window.location.href = "/login";
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      setStatus("❌ Errore: utente non trovato.", "error");
      clearTimeout(timeoutId);
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
      return;
    }

    const userData = userDoc.data();
    
    if (userData.role === "testacc") {
      document.body.classList.add("read-only-mode");
      const banner = document.createElement("div");
      banner.style.cssText = "background-color: #fff3cd; color: #856404; padding: 10px; margin-bottom: 10px; border-radius: 4px; text-align: center;";
      banner.textContent = "📖 Modalità sola lettura";
      document.querySelector(".content").insertBefore(banner, document.querySelector(".content").firstChild);
    }

    await loadPhotos(user.uid);
    await loadEvents(userData.name, userData.surname);

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  } catch (err) {
    console.error("❌ Errore:", err);
    setStatus("❌ Errore nel caricamento.", "error");
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }
});

async function loadPhotos(userId) {
  try {
    console.log("⏳ Caricamento foto...");
    photosContainer.innerHTML = "";

    const photosQuery = query(
      collection(db, "photos"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(photosQuery);

    if (snapshot.empty) {
      photosContainer.innerHTML = "<p>Nessuna foto caricata.</p>";
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const card = document.createElement("div");
      card.className = "photo-card";

      const status = data.status === "Approvata ✅" ? "approved" :
                     data.status === "Rifiutata ❌" ? "rejected" :
                     "pending";

      const service = getServiceLabel(data.serviceType);

      card.innerHTML = `
        <div class="photo-info">
          <img src="${data.url}" alt="Foto utente" class="photo-img" />
          <h4>${data.vehicleModel || data.fileName || "Foto"}</h4>
          <p><strong>Targa:</strong> ${data.licensePlate || "–"}</p>
          <p><strong>Posizione:</strong> ${data.location || "–"}</p>
          <p><strong>Servizio:</strong> ${service || "–"}</p>
          <p><strong>Note:</strong> ${data.notes || "–"}</p>
          <p>
            <strong>Stato:</strong>
            <span class="status ${status}">${data.status || "In attesa"}</span>
          </p>
          <p>
            <strong>Caricata:</strong>
            ${data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString("it-IT") : "–"}
          </p>
          ${data.reviewedAt?.toDate ? `<p><strong>Revisionata:</strong> ${data.reviewedAt.toDate().toLocaleString("it-IT")}</p>` : ""}
          ${data.vehicleLink ? `<a href="${data.vehicleLink}" target="_blank" class="gallery-link">🔗 Vai al mezzo in galleria</a>` : ""}
        </div>
      `;

      photosContainer.appendChild(card);
    });

    console.log(`📸 Caricate ${snapshot.size} foto`);
  } catch (err) {
    console.error("❌ Errore caricamento foto:", err);
    setStatus("Errore caricamento foto", "error");
  }
}

async function loadEvents(firstName, lastName) {
  try {
    console.log("⏳ Caricamento eventi...");
    eventsList.innerHTML = "";

    const eventsQuery = query(
      collection(db, "events"),
      where("userId", "==", firstName + " " + lastName)
    );

    const snapshot = await getDocs(eventsQuery);

    if (snapshot.empty) {
      eventsList.innerHTML = "<p>Non hai ancora creato nessun evento.</p>";
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const div = document.createElement("div");
      div.className = "photo-card";

      let statusText = "In revisione...";
      if (data.status === "In approvazione") statusText = "In approvazione.";
      else if (data.status === "Organizzato") statusText = "Organizzato.";
      else if (data.status === "Rifiutato") statusText = "L'organizzazione dell'evento è stata rifiutata.";

      div.innerHTML = `
        <div class="photo-info">
          <h3>${data.title}</h3>
          <p><strong>📍 Luogo:</strong> ${data.location}</p>
          <p><strong>📝 Descrizione:</strong> ${data.description.length > 150 ? data.description.slice(0, 150) + "..." : data.description}</p>
          <span class="status ${data.status || 'pending'}">${statusText}</span>
        </div>
        <a href="/events/detail/?id=${docSnap.id}" target="_blank" class="btn-view">Visualizza Evento</a>
      `;

      eventsList.appendChild(div);
    });

    console.log(`📅 Caricati ${snapshot.size} eventi`);
  } catch (err) {
    console.error("❌ Errore caricamento eventi:", err);
    setStatus("Errore caricamento eventi", "error");
  }
}

function getServiceLabel(service) {
  const services = {
    "emergenza-sanitaria": "Emergenza Sanitaria Territoriale",
    "soccorso-tecnico-urgente": "Soccorso Tecnico Urgente",
    "pompieri": "Soccorso Tecnico Urgente",
    "protezione-civile": "Protezione Civile",
    "soccorso-alpino": "Soccorso Alpino",
    "guardia-costiera": "Guardia Costiera",
    "ordine-pubblico": "Ordine Pubblico"
  };
  return services[service] || service || "N/A";
}

function setStatus(message, type = "info") {
  const classNameBox = document.querySelector(".statusBox");
  statusMsg.textContent = message;
  classNameBox.className = `statusBox ${type}`;
  classNameBox.style.display = "block";
  const closeBtn = document.getElementById("closeSMsg");
  if (closeBtn) {
    closeBtn.onclick = () => {
      classNameBox.style.display = "none";
    };
  }
}