import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../../configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const usersTableBody = document.querySelector("#usersTable tbody");
const logoutBtn = document.getElementById("logoutBtn");
const totalUsersCountEl = document.getElementById("totalUsersCount");

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

  loadUsers();
});

async function loadUsers() {
  usersTableBody.innerHTML = "";
  const usersSnap = await getDocs(collection(db, "users_whatsapp"));
  totalUsersCountEl.textContent = usersSnap.size;

  let users = [];

  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    if (!u) return;

    users.push({
      id: docSnap.id,
      ...u,
      joinedAt: u.joinedAt ? new Date(u.joinedAt) : new Date(0)
    });
  });

  const roleOrder = { admin: 1, moderator: 2, user: 3 };

  users.sort((a, b) => {
    const roleA = roleOrder[a.role] || 999;
    const roleB = roleOrder[b.role] || 999;

    if (roleA !== roleB) return roleA - roleB;

    return a.joinedAt - b.joinedAt;
  });

  users.forEach(u => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${u.name || ""}</td>
      <td>${u.phone || ""}</td>
      <td>${u.role || "Ruolo non disponibile"}</td>
      <td>${u.status || "N/A"}</td>
      <td>
        <button class="promote">Promuovi</button>
        <button class="delete">Espulsione</button>
        <button class="delete2">Elimina dal database</button>
        <button class="view">Visualizza</button>
        <button class="modify">Modifica</button>
      </td>
    `;

    tr.querySelector(".promote").addEventListener("click", () => updateRole(u.id, u.role));
    tr.querySelector(".delete").addEventListener("click", () => deleteUser(u.id));
    tr.querySelector(".delete2").addEventListener("click", () => deleteFromDatabase(u.id));
    tr.querySelector(".modify").addEventListener("click", () => {
      window.location.href = `/staff/dashboard/management/users-whatsapp/edit/?id=${u.id}`;
    });
    tr.querySelector(".view").addEventListener("click", () => {
      window.location.href = `/staff/dashboard/management/users-whatsapp/user/?id=${u.id}`;
    });

    usersTableBody.appendChild(tr);
  });
}

async function updateRole(userId, currentRole) {
  const roleHierarchy = ["user", "moderator", "admin"];
  const currentIndex = roleHierarchy.indexOf(currentRole);
  const newIndex = (currentIndex + 1) % roleHierarchy.length;
  const newRole = roleHierarchy[newIndex];

  await updateDoc(doc(db, "users_whatsapp", userId), { role: newRole });
  await addDoc(collection(db, "activities"), {
    type: "user_role_change_whatsapp",
    userName: userId,
    newRole,
    timestamp: new Date()
  });
  loadUsers();
}

async function deleteUser(userId) {
  if (confirm("Sei sicuro di voler segnalare come espulso questo utente?")) {
    await addDoc(collection(db, "activities"), {
      type: "user_deletion_whatsapp",
      userName: userId,
      timestamp: new Date()
    });
    await updateDoc(doc(db, "users_whatsapp", userId), { status: "espulso" });
    loadUsers();
    setTimeout(async () => {
      const userDocRef = doc(db, "users_whatsapp", userId);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.data();
      if (userData && userData.status === "espulso") {
        await deleteDoc(collection(db, "users_whatsapp", userId));
      } 
    }, 60 * 24 * 60 * 60 * 1000);
  }

  if (confirm("Vuoi compilare il report di espulsione per questo utente ora?")) {
    window.location.href = `/staff/dashboard/kick-reports/new/`;
  }
}

async function deleteFromDatabase(userId) {
  if (confirm("Sei sicuro di voler eliminare definitivamente questo utente dal database? Questa azione è irreversibile.")) {
    await addDoc(collection(db, "activities"), {
      type: "user_permanent_deletion_whatsapp",
      userName: userId,
      timestamp: new Date()
    });
    await deleteDoc(doc(db, "users_whatsapp", userId));
    loadUsers();
  }
}