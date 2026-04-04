import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(photosQuery);

    if (snapshot.empty) {
      photosContainer.innerHTML = "<p>Nessuna foto caricata.</p>";
      statusMsg.textContent = "";
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const card = document.createElement("div");
      card.className = "photo-card";

      card.innerHTML = `
        <div class="photo-info">
          <img src="${data.url}" alt="Foto utente" class="photo-img" />
          <h4>${data.title || ""}</h4>
          <p>Descrizione: ${data.description || "–"}</p>
          <p>Stato: <span class="status ${data.status}">${data.status}</span></p>
          <p>Caricata: ${data.createdAt?.toDate().toLocaleString() || "–"}</p>

          ${
            data.vehicleLink
              ? `<a href="${data.vehicleLink}" target="_blank" class="gallery-link">
                   🔗 Vai al mezzo in galleria
                 </a>`
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