import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const photosContainer = document.getElementById("photosContainer");
const statusMsg = document.getElementById("statusMsg");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login/";
  } else {
    loadAllPhotos(user.uid);
  }
});

async function loadAllPhotos(userId) {
  try {
    statusMsg.textContent = "⏳ Caricamento foto...";
    photosContainer.innerHTML = "";

    const photosQuery = query(
      collection(db, "photos"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(photosQuery);

    if (snapshot.empty) {
      photosContainer.innerHTML = "<p>Nessuna foto caricata.</p>";
      statusMsg.textContent = "";
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      const card = document.createElement("div");
      card.className = "photo-card";

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
            <span class="status ${data.status}">
              ${data.status || "In attesa"}
            </span>
          </p>

          <p>
            <strong>Caricata:</strong>
            ${
              data.createdAt?.toDate
                ? data.createdAt.toDate().toLocaleString("it-IT")
                : "–"
            }
          </p>

          ${
            data.reviewedAt?.toDate
              ? `
                <p>
                  <strong>Revisionata:</strong>
                  ${data.reviewedAt.toDate().toLocaleString("it-IT")}
                </p>
              `
              : ""
          }

          ${
            data.vehicleLink
              ? `
                <a href="${data.vehicleLink}" target="_blank" class="gallery-link">
                  🔗 Vai al mezzo in galleria
                </a>
              `
              : ""
          }
        </div>
      `;

      photosContainer.appendChild(card);
    });

    statusMsg.textContent = "";
  } catch (err) {
    console.error("❌ Errore caricamento foto:", err);
    statusMsg.textContent = "Errore durante il caricamento delle foto.";
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  console.log("🚪 Logout in corso...");
  await auth.signOut();
  console.log("✅ Logout completato, redirect...");
  window.location.href = "/login/";
});

function getServiceLabel(service) {
  switch (service) {
    case "emergenza-sanitaria":
      return "Emergenza Sanitaria Territoriale";

    case "soccorso-tecnico-urgente":
      return "Soccorso Tecnico Urgente";

    case "pompieri":
      return "Soccorso Tecnico Urgente";

    case "protezione_civile":
      return "Protezione Civile";

    case "soccorso_alpino":
      return "Soccorso Alpino";

    case "guardia_costiera":
      return "Guardia Costiera";

    case "ordine-pubblico":
      return "Ordine Pubblico";

    default:
      return service || "N/A";
  }
}