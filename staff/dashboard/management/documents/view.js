import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const docsTableBody = document.getElementById("docsTableBody");
const totalDocsCount = document.getElementById("totalDocsCount");
const statusMsg = document.getElementById("statusMsg");
const logoutBtn = document.getElementById("logoutBtn");

let usersMap = {};

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

function setStatus(message, type = "info") {
  if (!statusMsg) return;
  statusMsg.textContent = message;
  statusMsg.className = type;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

    if (!userSnap.exists() || !allowedRoles.includes(userSnap.data().role)) {
      window.location.href = "/dashboard";
      return;
    }

    await loadUsersMap();
    await loadAllFiles();
  } catch (err) {
    console.error("Errore verifica staff:", err);
    setStatus("Errore verifica permessi", "error");
  }
});

async function loadUsersMap() {
  const snap = await getDocs(collection(db, "users"));
  snap.forEach(docSnap => {
    usersMap[docSnap.id] = docSnap.data().name + " " + docSnap.data().surname || "Sconosciuto";
  });
}

async function loadAllFiles() {
  try {
    setStatus("⏳ Caricamento di tutti i file...");

    const q = query(
      collection(db, "staffDocUploads"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    docsTableBody.innerHTML = "";
    totalDocsCount.textContent = snapshot.size;

    if (snapshot.empty) {
      docsTableBody.innerHTML = "Nessun file trovato.";
      return;
    }

    snapshot.forEach((docSnap) => {
      const file = docSnap.data();

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><a href="${file.url}" target="_blank">${file.name}</a></td>
        <td>${usersMap[file.userId] || "Sconosciuto"}</td>
        <td>${file.title || "-"}</td>
        <td>${file.description || "-"}</td>
        <td><a href="${file.url}" target="_blank" download>Vedi</a></td>
        <td>${file.createdAt?.toDate().toLocaleString() || "-"}</td>
      `;

      docsTableBody.appendChild(tr);
    });

    setStatus(`📸 Totale file: ${snapshot.size}`);
  } catch (err) {
    console.error("Errore caricamento:", err);
    setStatus("Errore caricamento files", "error");
  }
}