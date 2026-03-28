import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const loginTable = document.getElementById("usersTableBody");

document.getElementById("logoutBtn").addEventListener("click", () => {
  window.location.href = "/login";
});

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

  snap.forEach(docSnap => {
    const data = docSnap.data();

    let timestamp = "—";
    if (data.timestamp?.toDate) {
      timestamp = data.timestamp.toDate().toLocaleString();
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${data.email ?? "—"}</td>
      <td>${timestamp}</td>
      <td>${data.userId ?? "—"}</td>
      <td>
        <a href="mailto:${data.email}" class="btn btn-sm btn-outline-primary">Contatta</a>
        <a class="btn btn-sm btn-danger dbdelete">Elimina login da DB</a>
      </td>
    `;

    // 🔥 Usa il bottone appena creato (non querySelector su tutta la tabella)
    row.querySelector(".dbdelete").addEventListener("click", () => {
      deleteDB(docSnap.id);
    });

    loginTable.appendChild(row);
  });
}

async function deleteDB(userId) {
  if (confirm("Sei sicuro di voler eliminare definitivamente questo login dal database? Questa azione è irreversibile.")) {
    await deleteDoc(doc(db, "logins", userId));
    loadUsers();
    alert("Login eliminato.")
  }
}