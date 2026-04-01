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
  const userDocRef = doc(db, "users", user.uid);
  const userDocSnap = await getDoc(userDocRef);
  const userData = userDocSnap.data();
  if (userData.role !== "advstaffplus") {
    alert("Accesso negato: non disponi delle autorizzazioni necessarie.");
    window.location.href = "/staff/dashboard/management";
    auth.keptSignIn = true;
    return;
  }


  if (!user) {
    window.location.href = "/login/";
    return;
  }

  const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus"];

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

  let users = [];

  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    if (!u) return;
    users.push({ id: docSnap.id, ...u });
  });

  const rolePriority = {
    advstaffplus: 1,
    advstaff: 2,
    modstaff: 3,
    simplestaff: 4,
    user: 5
  };

  const getAlphabetKey = (str) => (str.username || str.name || str.surname || "").toString().toLowerCase();

  // 🔥 Ordinamento utenti
  users.sort((a, b) => {
    const roleA = rolePriority[a.role] || 999;
    const roleB = rolePriority[b.role] || 999;

    if (roleA !== roleB) return roleA - roleB;

    if (a.role === "user" && b.role === "user") {
      const nameA = getAlphabetKey(a);
      const nameB = getAlphabetKey(b);
      return nameA.localeCompare(nameB);
    }

    return 0;
  });

  users.forEach(u => {
    const tr = document.createElement("tr");

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
        <button class="view">Visualizza ID</button>
      </td>
    `;

    tr.querySelector(".promote").addEventListener("click", () => updateRole(u.id, u.role));
    tr.querySelector(".suspend").addEventListener("click", () => updateStatus(u.id, u.status));
    tr.querySelector(".delete").addEventListener("click", () => deleteUser(u.id));
    tr.querySelector(".view").addEventListener("click", () => {
      alert(`ID Utente: ${u.id}`);
    });

    usersTableBody.appendChild(tr);
  });
}

async function updateRole(userId, currentRole) {
  const roleHierarchy = ["user", "simplestaff", "modstaff", "advstaff", "advstaffplus"];
  const currentIndex = roleHierarchy.indexOf(currentRole);
  const newIndex = (currentIndex + 1) % roleHierarchy.length;
  const newRole = roleHierarchy[newIndex];
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