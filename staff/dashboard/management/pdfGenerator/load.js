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

import { firebaseConfig } from "https://myfrem.friuliemergenze.it/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const tableBody = document.getElementById("documentsTableBody");
const messageBox = document.getElementById("messageBox");

console.log("📄 Loading generated documents...");

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

async function loadDocuments() {
  try {
    tableBody.innerHTML = `<tr><td colspan="5">Caricamento...</td></tr>`;

    const q = query(
      collection(db, "generatedDocuments"),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      tableBody.innerHTML = `<tr><td colspan="5">Nessun documento trovato</td></tr>`;
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
        <td>${data.title || "-"}</td>
        <td>${data.type || "-"}</td>
        <td>${date}</td>
        <td>${data.authorName || data.authorId || "-"}</td>
        <td>
          <a href="${data.pdfUrl || '#'}" target="_blank">
            📥 Download
          </a>

          <button class="deleteBtn" data-id="${docSnap.id}">
            ❌ Elimina
          </button>
        </td>
      `;

      tableBody.appendChild(row);
    });

    console.log("✅ Documenti caricati:", snap.size);

  } catch (err) {
    console.error("❌ Errore caricamento documenti:", err);
    messageBox.textContent = "Errore nel caricamento documenti";
  }
}

document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("deleteBtn")) {

    const id = e.target.dataset.id;

    if (!confirm("Vuoi eliminare questo documento?")) return;

    try {
      await deleteDoc(doc(db, "generatedDocuments", id));

      console.log("🗑️ Documento eliminato:", id);

      loadDocuments();

    } catch (err) {
      console.error("❌ Errore eliminazione:", err);
    }
  }
});

loadDocuments();