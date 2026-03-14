import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js"
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js"
import { getFirestore, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
import { firebaseConfig } from "../../../configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, user => {
    if (!user) window.location.href = "/login";
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login"
});

const reportsList = document.getElementById("listaRiunioni");

async function loadReports() {
    const reportsRef = collection(db, "reunionsReports");
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
                <td>${data.startDate} - ${data.endDate}</td>
                <td>${data.order}</td>
                <td>${data.opener}</td>
                <td><a href="/riunione-staff/?rid=${reportId}" target="_blank">${reportId}</a></td>
            `
            reportsList.appendChild(row);
        })
    })
}

loadReports();