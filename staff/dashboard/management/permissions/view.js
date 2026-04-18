import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const permissionsTableBody = document.querySelector("#permissionTable tbody");
const logoutBtn = document.getElementById("logoutBtn");
const totalPermissionsCountEl = document.getElementById("totalPermissionsCount");

logoutBtn.addEventListener("click", async () => {
  console.log("🚪 Logout in corso...");
  await auth.signOut();
  console.log("✅ Logout completato, redirect...");
  window.location.href = "/login/";
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "/login/";
    return;
  }

  const userDocRef = doc(db, "users", user.uid);
  const userDocSnap = await getDoc(userDocRef);
  const userData = userDocSnap.data();

  const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

  if (!userData || !allowedRoles.includes(userData.role)) {
    alert("Accesso negato: solo staff");
    window.location.href = "/login/";
    return;
  }

  loadPermissions();
});

async function loadPermissions() {
  permissionsTableBody.innerHTML = `<tr><td colspan="5">Caricamento...</td></tr>`;

  const permissionsSnap = await getDocs(collection(db, "groupPermissions"));
  totalPermissionsCountEl.textContent = permissionsSnap.size;

  if (permissionsSnap.empty) {
    permissionsTableBody.innerHTML = `<tr><td colspan="5">Nessun permesso trovato.</td></tr>`;
    return;
  }

  let permissions = [];

  permissionsSnap.forEach(docSnap => {
    const u = docSnap.data();
    if (!u) return;

    permissions.push({
      id: docSnap.id,
      ...u
    });
  });

  permissions.forEach(u => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${u.name || "N/A"}</td>
      <td>${u.phone || "N/A"}</td>
      <td>${u.type || "N/A"}</td>
      <td>${u.status || "N/A"}</td>
      <td>
        <button class="delete">Elimina</button>
      </td>
    `;

    permissionsTableBody.appendChild(tr);
  });
};

async function deleteFromDatabase(userId) {
  if (confirm("Sei sicuro di voler eliminare definitivamente questo permesso dal database? Questa azione è irreversibile.")) {
    await deleteDoc(doc(db, "groupPermissions", userId));
    loadPermissions();
  }
};