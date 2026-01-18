import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const reportId = urlParams.get('id');
const reportBox = document.getElementById("publicReportBox");
const titleReport = document.getElementById("titleReport")

async function loadPublicReport() {
  if (!reportId) {
    reportBox.innerHTML = "<p>❌ Inserisci un id report valido.</p>";
    return;
  }

  titleReport.innerHTML = `Report ${reportId} | MyFrEM - La migliore piattaforma in Friuli-Venezia Giulia nel caricamento foto inerenti l'emergenza`

  // Prendi il report
  const docRef = doc(db, "expulsionReports", reportId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    reportBox.innerHTML = "<p>❌ Report inesistente.</p>";
    return;
  }

  const data = docSnap.data();

  // Prendi l'email dello staffer usando l'ID
  let staffEmail = "-";
  let staffName = "-"
  if (data.reportedBy) {
    const userRef = doc(db, "users", data.reportedBy);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      staffEmail = userData.email || "-";
      staffName = userData.name || "-"
    }
  }

  reportBox.innerHTML = `
    <h2>📄 Report di Espulsione ${reportId}</h2>
    <h3>Utente Espulso:</h3>
    <p>${data.userName || "—"}</p>

    <h3>Numero di contatto utente:</h3>
    <p>Dato redatto per privacy</p>

    <h3>Staff che ha segnalato:</h3>
    <p>${staffName} - ${staffEmail !== "-" ? `<a href="mailto:${staffEmail}">${staffEmail}</a>` : "-"}</p>

    <h3>Motivo:</h3>
    <p>${data.reason || "—"}</p>

    <h3>Note aggiuntive:</h3>
    <p>${data.notes || "Nessuna"}</p>

    <h3>Data espulsione:</h3>
    <p>${data.expulsionDate || "—"}</p>

    <h3>Data creazione report:</h3>
    <p>${data.createdAt?.toDate().toLocaleString() || "—"}</p>
  `;
}

loadPublicReport();