import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const photosTableBody = document.getElementById("photosTableBody");
const statusMsg = document.getElementById("statusMsg");
const logoutBtn = document.getElementById("logoutBtn");

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

// Auth + controllo ruolo
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
    loadPendingPhotos();
  } catch (err) {
    console.error("Errore verifica staff:", err);
    setStatus("Errore verifica permessi", "error");
  }
});

// Mappa UID -> username
async function loadUsersMap() {
  const snap = await getDocs(collection(db, "users"));
  snap.forEach(docSnap => {
    usersMap[docSnap.id] = docSnap.data().username || "Sconosciuto";
  });
}

// Carica foto da moderare
async function loadPendingPhotos() {
  try {
    setStatus("⏳ Caricamento foto...");

    const q = query(
      collection(db, "photos"),
      where("status", "==", "Foto in attesa di approvazione ⌛")
    );

    const snapshot = await getDocs(q);
    photosTableBody.innerHTML = "";

    if (snapshot.empty) {
      setStatus("✅ Nessuna foto da moderare");
      return;
    }

    snapshot.forEach((docSnap) => {
      const photo = docSnap.data();

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${photo.url}" class="preview" /></td>
        <td>${photo.name || "-"}</td>
        <td>${photo.title || "-"}</td>
        <td>${photo.description || "-"}</td>
        <td>${usersMap[photo.userId] || "Sconosciuto"}</td>
        <td>${photo.createdAt?.toDate().toLocaleString() || "-"}</td>
        <td>
          <button class="approve" data-id="${docSnap.id}">✅ Approva</button>
          <button class="reject" data-id="${docSnap.id}">❌ Rifiuta</button>
        </td>
      `;
      photosTableBody.appendChild(tr);
    });

    document.querySelectorAll(".approve").forEach(btn => {
      addDoc(collection(db, "activities"), {
        type: "photo_approval",
        approvalStaffer: auth.currentUser.email || "-",
        photoTitle: photo.title || "-",
        timestamp: serverTimestamp()
      });
      btn.addEventListener("click", () => {
        updatePhotoStatus(btn.dataset.id, "Approvata ✅");
      });
    });

    document.querySelectorAll(".reject").forEach(btn => {
      addDoc(collection(db, "activities"), {
        type: "photo_rejection",
        rejectionStaffer: auth.currentUser.email || "-",
        photoTitle: photo.title || "-",
        timestamp: serverTimestamp()
      });
      btn.addEventListener("click", () => {
        updatePhotoStatus(btn.dataset.id, "Rifiutata ❌");
      });
    });

    setStatus(`📸 Caricate ${snapshot.size} foto`);
  } catch (err) {
    console.error("Errore caricamento foto:", err);
    setStatus("Errore caricamento foto", "error");
  }
}

// Approva / Rifiuta + LOG staff
async function updatePhotoStatus(photoId, status) {
  try {
    setStatus("⏳ Aggiornamento...");

    await updateDoc(doc(db, "photos", photoId), {
      status: status,
      reviewedAt: serverTimestamp()
    });

    setStatus(`✅ Foto ${status}`);
    loadPendingPhotos();
  } catch (err) {
    console.error("Errore aggiornamento:", err);
    setStatus("Errore aggiornamento", "error");
  }
}