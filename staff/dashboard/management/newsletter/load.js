import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import { firebaseConfig } from "https://myfrem.friuliemergenze.it/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const tableBody = document.getElementById("usersTableBody");
const messageBox = document.getElementById("statusMsg");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

console.log("📡 Loading sent newsletters...");

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  const allowedRoles = ["advstaffplus", "superadmin"];

  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    setStatus("Accesso negato: non sei staff!", "error");
    window.location.href = "/dashboard";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("⏱️ Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  await loadNewsletters();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
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