import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const loginTable = document.getElementById("usersTableBody");

loadUsers();

async function loadUsers() {
  const ref = collection(db, "logins");
  const q = query(ref, orderBy("timestamp", "desc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    loginTable.innerHTML = "<p>❌ Nessun login trovato.</p>";
    return;
  }

  loginTable.innerHTML = "";

  snap.forEach(doc => {
    const data = doc.data();

    let timestamp = "—";
    if (data.timestamp?.toDate) {
      timestamp = data.timestamp.toDate().toLocaleString();
    }

    loginTable.innerHTML += `
      <tr>
        <td>${data.email ?? "—"}</td>
        <td>${timestamp}</td>
        <td>${data.userId ?? "—"}</td>
        <td><a href="mailto:${data.email}" class="btn btn-sm btn-outline-primary">Contatta</a></td>
      </tr>
    `;
  });
}