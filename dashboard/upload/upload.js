import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─── DOM ─────────────────────────────────────────────────────
const fileInput   = document.getElementById("inp-upl");
const uploadBtn   = document.getElementById("btn-upl");
const statusMsg   = document.getElementById("statusMsg");
const fileNameSpan= document.getElementById("file-name");
const titleInput  = document.getElementById("title");
const descInput   = document.getElementById("description");

// fallback se non esistono in HTML
const progressBar = document.getElementById("progressBar") || { style:{}, value:0 };
const progressText= document.getElementById("progressText") || { textContent:"" };

let currentUser = null;

// ─── Stato login ─────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    console.log("✅ Utente loggato:", user.uid);
  } else {
    console.log("❌ Nessun utente loggato");
    setStatus("⚠️ Devi essere loggato");
  }
});

// ─── UI helpers ──────────────────────────────────────────────
function setStatus(msg) {
  console.log("STATUS:", msg);
  statusMsg.textContent = msg;
}

fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    fileNameSpan.textContent = `✅ ${fileInput.files[0].name}`;
  } else {
    fileNameSpan.textContent = "Nessun file";
  }
});

// ─── Upload click ────────────────────────────────────────────
uploadBtn.addEventListener("click", (e) => {
  e.preventDefault();
  console.log("📤 Click su upload");

  if (!currentUser) {
    setStatus("❌ Devi essere loggato");
    return;
  }

  const file = fileInput.files[0];

  if (!file) {
    setStatus("❌ Seleziona una foto");
    return;
  }

  const path = `uploads/${currentUser.uid}/${Date.now()}-${file.name}`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", path);

  setStatus("⏳ Upload in corso...");

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload", true);

  // progress
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable && progressBar.style) {
      const percent = Math.round((event.loaded / event.total) * 100);
      progressBar.value = percent;
      progressText.textContent = percent + "%";
    }
  };

  // ✅ RISPOSTA DAL SERVER
  xhr.onload = async () => {
    console.log("✅ onload chiamato");
    console.log("HTTP Status:", xhr.status);
    console.log("Raw response:", xhr.responseText);

    try {
      const data = JSON.parse(xhr.responseText);
      console.log("Parsed JSON:", data);

      if (!data.url) {
        throw new Error(data.error || "URL non ricevuto");
      }

      console.log("🔥 Salvataggio Firestore in corso...");

      const activityRef = await addDoc(collection(db, "activities"), {
        userName: currentUser.uid,
        photoTitle: titleInput.value || "-",
        timestamp: serverTimestamp(),
        type: "photo_submission",
      });

      const docRef = await addDoc(collection(db, "photos"), {
        userId: currentUser.uid,
        title: titleInput.value || "",
        description: descInput.value || "",
        name: file.name,
        url: data.url,
        status: "Foto in attesa di approvazione ⌛",
        createdAt: serverTimestamp()
      });

      console.log("✅ Salvato in Firebase con ID:", docRef.id + "e attività ID:", activityRef.id);

      setStatus("✅ Foto caricata e salvata!");
      fileInput.value = "";
      fileNameSpan.textContent = "Nessun file";
      progressText.textContent = "Completato ✅";

    } catch (err) {
      console.error("❌ Errore interno:", err);
      setStatus("❌ Errore: " + err.message);
    }
  };

  // ❌ ERRORI DI RETE
  xhr.onerror = () => {
    console.error("❌ xhr.onerror chiamato");
    setStatus("❌ Errore di rete");
  };

  xhr.send(formData);
});

// --- Logout ---
document.getElementById("logoutBtn").addEventListener("click", async () => {
  console.log("🚪 Logout in corso...");
  await auth.signOut();
  console.log("✅ Logout completato, redirect...");
  window.location.href = "/login/";
});