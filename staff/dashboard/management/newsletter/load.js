import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import { firebaseConfig } from "https://myfrem.friuliemergenze.it/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const tableBody = document.getElementById("usersTableBody");
const messageBox = document.getElementById("messageBox");

console.log("📡 Loading newsletter users...");

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

async function loadUsers() {
  try {
    tableBody.innerHTML = `<tr><td colspan="5">Caricamento...</td></tr>`;

    const q = query(
      collection(db, "newsletterSubs"),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      tableBody.innerHTML = `<tr><td colspan="5">Nessun utente trovato</td></tr>`;
      return;
    }

    tableBody.innerHTML = "";

    snap.forEach((docSnap) => {
      const data = docSnap.data();

      const date = data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleString("it-IT")
        : "N/A";

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${data.name || "-"}</td>
        <td>${data.email}</td>
        <td>${date}</td>
        <td style="font-size:12px; word-break:break-all;">
          ${data.token || "-"}
        </td>
        <td>
          <button class="deleteBtn" data-id="${docSnap.id}">
            ❌ Rimuovi
          </button>
        </td>
      `;

      tableBody.appendChild(row);
    });

    console.log("✅ Utenti caricati:", snap.size);

  } catch (err) {
    console.error("❌ Errore caricamento utenti:", err);
    messageBox.textContent = "Errore nel caricamento utenti";
  }
}

document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("deleteBtn")) {
    const id = e.target.dataset.id;

    if (!confirm("Vuoi eliminare questo utente?")) return;

    await deleteDoc(doc(db, "newsletterSubs", id));

    console.log("🗑️ Eliminato:", id);

    loadUsers();
  }
});

loadUsers();