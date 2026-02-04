// ✅ Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 🔑 Controllo autenticazione
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/login";
  }
});

// 🚪 Logout
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

// 📄 Form
const expulsionForm = document.getElementById("expulsionReportForm");
const statusMsg = document.getElementById("statusMsg");

expulsionForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userName = document.getElementById("userSelect").value.trim();
  const userNumber = document.getElementById("userNumber").value.trim();
  const expulsionDate = document.getElementById("expulsionDate").value;
  const notes = document.getElementById("notes").value.trim();

  if (!userName || !expulsionDate) {
    statusMsg.textContent = "❌ Compila tutti i campi obbligatori!";
    statusMsg.className = "error";
    return;
  }

  try {
    // Salvataggio Firestore
    await addDoc(collection(db, "users_whatsapp"), {
      name: userName,
      phone: userNumber || null,
      date: expulsionDate,
      notes: notes || null,
      role: "user",
      status: "active",
      createdAt: serverTimestamp()
    });

    await addDoc(collection(db, "activities"), {
      type: "user_creation_whatsapp",
      addStaffer: auth.currentUser?.email || "unknown",
      userName,
      timestamp: serverTimestamp()
    });

    statusMsg.textContent = "✅ Creazione avvenuta con successo!";
    statusMsg.className = "success";
    expulsionForm.reset();
    window.location.href = "/staff/dashboard/management/users-whatsapp/";

  } catch (err) {
    console.error("Errore creazione utente:", err);
    statusMsg.textContent = "❌ Errore nella creazione dell'utente. Riprovare.";
    statusMsg.className = "error";
  }
});