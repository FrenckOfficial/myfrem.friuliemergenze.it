import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, getDoc, getDocs, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

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

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

const reportsList = document.getElementById("kickReportsList");

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

loadKickReports();