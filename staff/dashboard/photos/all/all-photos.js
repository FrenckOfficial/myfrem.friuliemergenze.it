import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "../../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const photosTableBody = document.getElementById("photosTbody");
const statusMsg = document.getElementById("statusMsg");
const logoutBtn = document.getElementById("logoutBtn");
const messageBox = document.getElementById("messageBox");

let usersMap = {};

// Logout
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

// Helper messaggi
function setStatus(message, type = "info") {
  if (!statusMsg) return;
  statusMsg.textContent = message;
  statusMsg.className = type;
}

// Auth + check staff
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    const allowedRoles = ["staff", "simpleadmin", "modstaff", "advstaff"];

    if (!userSnap.exists() || !allowedRoles.includes(userSnap.data().role)) {
      window.location.href = "/dashboard";
      return;
    }

    await loadUsersMap();
    loadAllPhotos();
  } catch (err) {
    console.error("Errore verifica staff:", err);
    setStatus("Errore verifica permessi", "error");
  }
});

// Mappa utenti
async function loadUsersMap() {
  const snap = await getDocs(collection(db, "users"));
  snap.forEach(docSnap => {
    usersMap[docSnap.id] = docSnap.data().username || "Sconosciuto";
  });
}

// Carica tutte le foto
async function loadAllPhotos() {
  try {
    setStatus("⏳ Caricamento tutte le foto...");

    const q = query(
      collection(db, "photos"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    photosTableBody.innerHTML = "";

    if (snapshot.empty) {
      setStatus("Nessuna foto trovata");
      return;
    }

    snapshot.forEach((docSnap) => {
      const photo = docSnap.data();
      const id = docSnap.id;

      const statusColor =
        photo.status?.includes("Approvata") ? "green" :
        photo.status?.includes("Rifiutata") ? "red" : "orange";

      let linkBox = "-";

      if (photo.status?.includes("Approvata")) {

        const hasLink = photo.vehicleLink && photo.vehicleLink.length > 0;

        linkBox = `
          <div class="photo-link-box" id="box-${id}">

            <!-- Link cliccabile -->
            <a
              href="${hasLink ? photo.vehicleLink : "#"}"
              target="_blank"
              id="link-view-${id}"
              style="text-decoration: underline; font-size: 1em;"
              class="photo-link-static ${hasLink ? "" : "hidden"}"
            >
              ${hasLink ? photo.vehicleLink : ""}
            </a>

            <!-- Input nascosto -->
            <input
              type="text"
              id="link-input-${id}"
              class="photo-link-input ${hasLink ? "hidden" : ""}"
              placeholder="Inserisci link mezzo..."
              value="${hasLink ? photo.vehicleLink : ""}"
            />

            <!-- Pulsanti -->
            <button class="edit-link-btn" onclick="editLink('${id}')">✏️</button>
            <button class="edit-link-btn ${hasLink ? "hidden" : ""}" id="save-${id}" onclick="saveVehicleLink('${id}')">💾</button>

          </div>
        `;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${photo.url}" class="preview"/></td>
        <td>${photo.title || "-"}</td>
        <td>${usersMap[photo.userId] || "Sconosciuto"}</td>
        <td style="color:${statusColor}">${photo.status}</td>
        <td>${photo.createdAt?.toDate().toLocaleString() || "-"}</td>
        <td>${linkBox}</td>
      `;

      photosTableBody.appendChild(tr);
    });

    setStatus(`📸 Totale foto: ${snapshot.size}`);
  } catch (err) {
    console.error("Errore caricamento:", err);
    setStatus("Errore caricamento foto", "error");
  }
}

// ✅ Save link mezzo (senza log per ora)
window.saveVehicleLink = async (photoId) => {
  const input = document.getElementById(`link-${photoId}`);
  const link = input.value.trim();

  if (!link) {
    alert("Inserisci un link valido");
    return;
  }

  try {
    await addDoc(doc(db, "activities"), {
      type: "photo_edit",
      editStaffer: auth.currentUser.email || "-",
      photoTitle: photo.title || "-",
      timestamp: serverTimestamp()
    });
    await updateDoc(doc(db, "photos", photoId), {
      vehicleLink: link
    });

    alert("✅ Link salvato");
  } catch (err) {
    console.error("Errore salvataggio:", err);
    alert("Errore salvataggio");
  }
};

// ✏️ Abilita modifica
window.editLink = (photoId) => {
  const view = document.getElementById(`link-view-${photoId}`);
  const input = document.getElementById(`link-input-${photoId}`);
  const saveBtn = document.getElementById(`save-${photoId}`);

  view.classList.add("hidden");
  input.classList.remove("hidden");
  saveBtn.classList.remove("hidden");
};

// 💾 Salva link
window.saveVehicleLink = async (photoId) => {
  const input = document.getElementById(`link-input-${photoId}`);
  const link = input.value.trim();

  if (!link) {
    alert("Inserisci un link valido");
    return;
  }

  try {
    await updateDoc(doc(db, "photos", photoId), {
      vehicleLink: link
    });

    // Aggiorna UI
    const view = document.getElementById(`link-view-${photoId}`);
    const saveBtn = document.getElementById(`save-${photoId}`);

    view.href = link;
    view.textContent = link;
    view.classList.remove("hidden");

    input.classList.add("hidden");
    saveBtn.classList.add("hidden");

    alert("✅ Link salvato");

  } catch (err) {
    console.error("Errore salvataggio:", err);
    alert("Errore salvataggio");
  }
};