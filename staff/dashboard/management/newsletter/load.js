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
const messageBox = document.getElementById("statusMsg");

console.log("📡 Loading sent newsletters...");

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

async function loadNewsletters() {
  try {
    tableBody.innerHTML = `<tr><td colspan="8">Caricamento...</td></tr>`;

    const q = query(
      collection(db, "newsletterSent"),
      orderBy("sentAt", "desc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      tableBody.innerHTML = `<tr><td colspan="8">Nessuna newsletter trovata</td></tr>`;
      return;
    }

    tableBody.innerHTML = "";

    snap.forEach((docSnap) => {
      const data = docSnap.data();

      const sentAt = data.sentAt?.toDate
        ? data.sentAt.toDate().toLocaleString("it-IT")
        : "N/A";

      const hasImage = data.image && data.image.trim() !== "";
      const hasLink = data.link && data.link.trim() !== "";

      const row = document.createElement("tr");

      row.innerHTML = `
        <td style="max-width:200px; word-break:break-word;">${data.title || "-"}</td>
        <td>
          <span class="badge-type">${data.type || "-"}</span>
        </td>
        <td>
          ${hasImage
            ? `<span class="has-image" title="${data.image}">✅ Sì</span>`
            : `<span class="no-image">❌ No</span>`
          }
        </td>
        <td class="link-cell">
          ${hasLink
            ? `<a href="${data.link}" target="_blank" rel="noopener">🔗 Apri</a>`
            : `<span style="color:#aaa; font-size:13px;">—</span>`
          }
        </td>
        <td class="recipients-count">${data.recipients ?? "-"}</td>
        <td>${sentAt}</td>
        <td>
          <button class="deleteBtn" data-id="${docSnap.id}">
            ❌ Elimina
          </button>
        </td>
      `;

      tableBody.appendChild(row);
    });

    console.log("✅ Newsletter caricate:", snap.size);

  } catch (err) {
    console.error("❌ Errore caricamento newsletter:", err);
    messageBox.textContent = "Errore nel caricamento delle newsletter";
  }
}

document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("deleteBtn")) {
    const id = e.target.dataset.id;

    if (!confirm("Vuoi eliminare questa newsletter dallo storico?")) return;

    await deleteDoc(doc(db, "newsletterSent", id));

    console.log("🗑️ Eliminata:", id);

    loadNewsletters();
  }
});

loadNewsletters();