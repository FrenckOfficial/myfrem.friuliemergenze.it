import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

  let role = "Ruolo non disponibile";
  let status = "N/A";
  let date = "Data non disponibile";

  if (data.role === "admin") {
    role = "Amministratore";
  } else if (data.role === "user") {
    role = "Utente";
  } else role;

  if (data.status === "active") {
    status = "Attivo";
  } else if (data.status === "suspended") {
    status = "Sospeso";
  } else if (data.status === "espulso") {
    status = "Espulso";
  } else status;

  if (data.date) {
    date = new Date(data.date).toLocaleDateString("it-IT");
  }

  userDataDiv.innerHTML = `
    <div class="user-card">
      <p><strong>Nome:</strong> ${data.name}</p>
      <p><strong>Numero:</strong> ${data.phone ?? "N/D"}</p>
      <p><strong>Data entrata:</strong> ${date}</p>
      <p><strong>Ruolo:</strong> ${role}</p>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Note:</strong> ${data.notes ? data.notes : "Nessuna nota fornita"}</p>
      <p><strong>Tag:</strong> ${data.tags ? data.tags.join(", ") : "Nessun tag fornito"}</p>
      <p><strong>Linked MyFrEM:</strong> ${data.linkedMyFremUser ? data.linkedMyFremUser.name : "Nessun account fornito"}</p>
      <p><strong>Linked MyFrEM Account ID:</strong> ${data.linkedMyFremUser ? data.linkedMyFremUser.id : "Nessun ID account disponibile in quanto account non fornito"}</p>
      <button id="backBtn" class="user-btn btn-back">🔙 Torna alla lista</button>
      <button id="editBtn" class="user-btn btn-edit">✏️ Modifica utente</button>
    </div>
  `;
  document.getElementById("backBtn").addEventListener("click", () => {
    window.history.back();
  });
  
  document.getElementById("editBtn").addEventListener("click", () => {
    window.location.href = `/staff/dashboard/management/users-whatsapp/edit/?id=${userId.valueOf()}`;
  })
}