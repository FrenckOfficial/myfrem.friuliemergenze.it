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
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const photosContainer = document.getElementById("photosContainer");
const statusMsg = document.getElementById("statusMsg");

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

onAuthStateChanged(auth, async (user) => {
  const timeoutId = setTimeout(() => {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 5000);

  try {
    if (!user) {
      clearTimeout(timeoutId);
      window.location.href = "/login/";
      return;
    }

    await checkUserRole(user.uid);
    await loadAllPhotos(user.uid);

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  } catch (err) {
    console.error("❌ Errore:", err);
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }
});

async function checkUserRole(uid) {
  try {
    const userDocSnap = await getDoc(doc(db, "users", uid));
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (userData.role === "testacc") {
        document.body.classList.add("read-only-mode");
        // Opzionale: mostra un banner
        const banner = document.createElement("div");
        banner.style.cssText = "background-color: #fff3cd; color: #856404; padding: 10px; margin-bottom: 10px; border-radius: 4px; text-align: center;";
        banner.textContent = "📖 Modalità sola lettura";
        photosContainer.parentElement.insertBefore(banner, photosContainer);
      }
    }
  } catch (err) {
    console.error("Errore verifica ruolo:", err);
  }
}

async function loadAllPhotos(userId) {
  try {
    setStatus("⏳ Caricamento foto...", "info");
    photosContainer.innerHTML = "";

    const photosQuery = query(
      collection(db, "photos"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(photosQuery);

    if (snapshot.empty) {
      photosContainer.innerHTML = "<p>Nessuna foto caricata.</p>";
      setStatus("", "");
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
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
            <span class="status ${status}">
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

    setStatus(`📸 Caricate ${snapshot.size} foto`, "success");
  } catch (err) {
    console.error("❌ Errore caricamento foto:", err);
    setStatus("Errore caricamento foto", "error");
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