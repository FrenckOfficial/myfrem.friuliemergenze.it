import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

onAuthStateChanged(auth, user => {
  if (!user) window.location.href = "/login";
});

const reportDetails = document.getElementById("reportDetails");

const params = new URLSearchParams(window.location.search);
const reportId = params.get("id");

if (!reportId) {
  reportDetails.innerHTML = "<p class='error'>❌ ID report non specificato.</p>";
} else {
  loadReport(reportId);
}

async function loadReport(id) {
  const docRef = doc(db, "expulsionReports", id);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    reportDetails.innerHTML = "<p class='error'>❌ Report non trovato.</p>";
    return;
  }

  const data = snapshot.data();

  reportDetails.innerHTML = `
    <a href="/staff/dashboard/kick-reports/edit/?id=${reportId}" target="_blank" class="btn-tertiary">Modifica report</a>
    <h3>Utente Espulso:</h3>
    <p>${data.userName || "—"}</p>

    <h3>Numero Utente:</h3>
    <p>${data.userNumber || "—"}</p>

    <h3>Staff che ha segnalato:</h3>
    <p><a href="mailto:${data.staffMail}">${data.staffMail}</a></p>

    <h3>Motivo:</h3>
    <p>${data.reason || "—"}</p>

    <h3>Note aggiuntive:</h3>
    <p>${data.notes || "Nessuna"}</p>

    <h3>Data espulsione:</h3>
    <p>${data.expulsionDate || "—"}</p>

    <h3>Data creazione report:</h3>
    <p>${data.createdAt?.toDate().toLocaleString() || "—"}</p>

    <a href="/assets/kickReports/Report_Espulsione_${data.userName}.pdf" download="Report_Espulsione_${data.userName}.pdf" class="btn-secondary">Scarica PDF</a>
  `;

}