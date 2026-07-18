import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, deleteDoc, doc, onSnapshot, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const loginTable = document.getElementById("usersTableBody");
const statusMsg = document.getElementById("statusMsg");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

document.getElementById("logoutBtn").addEventListener("click", () => {
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

  await loadUsers();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

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
      <td>${data.ipAddress ?? "—"}</td>
      <td>${data.userAgent ?? "—"}</td>
    `;

    row.addEventListener("click", () => {
      deleteDB(docSnap.id);
    });

    loginTable.appendChild(row);
  });
}

async function deleteDB(userId) {
  if (confirm("Sei sicuro di voler eliminare definitivamente questo login dal database? Questa azione è irreversibile.")) {
    await deleteDoc(doc(db, "logins", userId));
    setStatus("Login eliminato.", "success");
    window.location.reload();
  }
}

function setStatus(message, type = "info") {
  const classNameBox = document.querySelector(".statusBox");
  statusMsg.textContent = message;
  classNameBox.className = `${"statusBox" + " " + type}`;
  classNameBox.style.display = "block";
  const closeBtn = document.getElementById("closeSMsg");
  closeBtn.onclick = () => {
    classNameBox.style.display = "none";
  }
}