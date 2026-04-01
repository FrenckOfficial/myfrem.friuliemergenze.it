import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Controllo autenticazione
onAuthStateChanged(auth, user => {
  if (!user) window.location.href = "/login";
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

// Riferimento alla tabella
const reportsList = document.getElementById("kickReportsList");

// Carica i report
async function loadKickReports() {
  const reportsRef = collection(db, "expulsionReports");
  const q = query(reportsRef, orderBy("createdAt", "desc"));

  onSnapshot(q, snapshot => {
    reportsList.innerHTML = "";

    if (snapshot.empty) {
      reportsList.innerHTML = `
        <tr>
          <td colspan="7" class="empty">Nessun report presente.</td>
        </tr>`;
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const reportId = doc.id;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>#${reportId}</td>
        <td>${data.userName || "—"}</td>
        <td>${data.reportedBy}</td>
        <td>Vedi <a href="/staff/dashboard/kick-reports/view/?id=${reportId}" id="viewKickReport">Report di espulsione</a></td>
        <td>${data.notes || "Non specificate"}</td>
        <td>${data.expulsionDate || "-"}</td>
        <td>
          <a href="/staff/dashboard/kick-reports/view/?id=${reportId}" class="btn-small">👁️ Staff</a>
          <p></p>
          <a href="/kick-reports/?id=${reportId}" class="btn-small" style="margin-top: 10px;">🌐 Pubblico</a>
        </td>`;
      reportsList.appendChild(row);
    });
  });
}

// Avvia caricamento dati
loadKickReports();