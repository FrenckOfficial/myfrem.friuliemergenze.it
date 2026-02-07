import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 📌 Leggi l'ID dall’URL
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("id");

const userDataDiv = document.getElementById("userData");

if (!userId) {
  userDataDiv.innerHTML = "<p>❌ Nessun ID utente fornito.</p>";
} else {
  loadUser();
}

async function loadUser() {
  const ref = doc(db, "users_whatsapp", userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    userDataDiv.innerHTML = "<p>❌ Utente non trovato.</p>";
    return;
  }

  const data = snap.data();

  userDataDiv.innerHTML = `
    <div class="user-card">
      <p><strong>Nome:</strong> ${data.name}</p>
      <p><strong>Numero:</strong> ${data.phone ?? "N/D"}</p>
      <p><strong>Data entrata:</strong> ${data.date}</p>
      <p><strong>Ruolo:</strong> ${data.role}</p>
      <p><strong>Status:</strong> ${data.status}</p>
      <p><strong>Note:</strong> ${data.notes ?? "Nessuna nota fornita"}</p>
      <p><strong>Tag:</strong> ${data.tags ?? "Nessun tag fornito"}</p>
      <p><strong>Linked MyFrEM:</strong> ${data.linkedMyFremUser ? data.linkedMyFremUser.name : "Nessun account fornito"}</p>
      <p><strong>Linked MyFrEM Account ID:</strong> ${data.linkedMyFremUser ? data.linkedMyFremUser.id : "Nessun ID account disponibile in quanto account non fornito"}</p>
      <button id="backBtn" class="user-btn btn-back">🔙 Torna alla lista</button>
      <button id="editBtn" class="user-btn btn-edit">✏️ Modifica utente</button>
    </div>
  `;
  // Torna al link di provenienza
  document.getElementById("backBtn").addEventListener("click", () => {
    window.history.back();
  });
  // Vai alla pagina di modifica
  document.getElementById("editBtn").addEventListener("click", () => {
    window.location.href = `/staff/dashboard/management/users-whatsapp/edit/?id=${userId.valueOf()}`;
  })
}