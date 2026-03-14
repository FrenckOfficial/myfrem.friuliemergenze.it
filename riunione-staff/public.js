import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const reportId = urlParams.get('rid');
const reportBox = document.getElementById("publicReportBox");
const titleReport = document.getElementById("titleReport")

async function loadPublicReport() {
  if (!reportId) {
    reportBox.innerHTML = "<p>❌ Inserisci un id report valido.</p>";
    return;
  }

  titleReport.innerHTML = `Report ${reportId} | MyFrEM - La migliore piattaforma in Friuli-Venezia Giulia nel caricamento foto inerenti l'emergenza`

  // Prendi il report
  const docRef = doc(db, "reunionReports", reportId);
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
    <h2>📄 Esito riunione ${reportId}</h2>
    <h3>Staffer che ha aperto:</h3>
    <p>${data.opener}</p>

    <h3>Data inizio:</h3>
    <p>${data.startDate}</p>

    <h3>Data fine:</h3>
    <p>${data.endDate}</p>

    <h3>Ordine del giorno:</h3>
    <p>${data.order || "Ordine del giorno non specificato"}</p>

    <h3>Esito finale:</h3>
    <p>${data.description || "Esito non specificato"}</p>

    <h3>Data creazione report:</h3>
    <p>${data.createdAt?.toDate().toLocaleString() || "—"}</p>
  `;
}

loadPublicReport();