import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../../configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const usersTableBody = document.querySelector("#usersTable tbody");
const logoutBtn = document.getElementById("logoutBtn");

// Logout
logoutBtn.addEventListener("click", async () => {
  console.log("🚪 Logout in corso...");
  await auth.signOut();
  console.log("✅ Logout completato, redirect...");
  window.location.href = "/login/";
});

// Verifica login e ruolo staff
onAuthStateChanged(auth, async user => {
  if (user.uid !== "J1eRe4W2edgovr1sgUw8fqJv76E2") {
    alert("Accesso negato: solo Francesco può accedere a questa pagina.");
    window.location.href = "/staff/dashboard/";
    auth.keptSignIn = true;
    return;
  }

  if (!user) {
    window.location.href = "/login/";
    return;
  }

  const userDocRef = doc(db, "users", user.uid);
  const userDocSnap = await getDoc(userDocRef);
  const userData = userDocSnap.data();

  const allowedRoles = ["staff", "simpleadmin", "modstaff", "advstaff"];

  if (!userData || !allowedRoles.includes(userData.role)) {
    alert("Accesso negato: solo staff");
    window.location.href = "/login/";
    return;
  }

  loadUsers();
});

async function loadUsers() {
  usersTableBody.innerHTML = "";
  const usersSnap = await getDocs(collection(db, "users"));

  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    const tr = document.createElement("tr");

    if (!u) return;

    if (u.role === "staff") return;

    tr.innerHTML = `
      <td>${u.name || ""}</td>
      <td>${u.surname || ""}</td>
      <td>${u.email || ""}</td>
      <td>${u.username || ""}</td>
      <td>${u.role || "Ruolo utente non disponibile."}</td>
      <td>${u.status || "Status utente non disponibile."}</td>
      <td>
        <button class="promote">Promuovi</button>
        <button class="suspend">Sospendi/Riattiva</button>
        <button class="delete">Elimina</button>
      </td>
    `;

    // Eventi pulsanti
    tr.querySelector(".promote").addEventListener("click", () => updateRole(docSnap.id, u.role));
    tr.querySelector(".suspend").addEventListener("click", () => updateStatus(docSnap.id, u.status));
    tr.querySelector(".delete").addEventListener("click", () => deleteUser(docSnap.id));

    usersTableBody.appendChild(tr);
  });
}

async function updateRole(userId, currentRole) {
  const newRole = currentRole === "staff" ? "user" : "staff";
  await addDoc(collection(db, "activities"), {
    type: "user_role_change",
    userName: auth.currentUser.name,
    newRole: newRole,
    changeStaffer: auth.currentUser.email,
    timestamp: new Date()
  })
  await updateDoc(doc(db, "users", userId), { role: newRole });
  loadUsers();
}

async function updateStatus(userId, currentStatus) {
  const newStatus = currentStatus === "attivo" ? "sospeso" : "attivo";
  await updateDoc(doc(db, "users", userId), { status: newStatus });
  loadUsers();
}

async function deleteUser(userId) {
  if (confirm("Sei sicuro di voler eliminare questo utente?")) {
    await addDoc(collection(db, "activities"), {
      type: "user_deletion",
      userName: userId,
      timestamp: new Date()
    });
    await updateDoc(doc(db, "users", userId), { status: "eliminato" });
    loadUsers();
    setTimeout(async () => {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.data();
      if (userData && userData.status === "eliminato") {
        await deleteDoc(collection(db, "users", userId));
      } 
    }, 60 * 24 * 60 * 60 * 1000);
  }
}