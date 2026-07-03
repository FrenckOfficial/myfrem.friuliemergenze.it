import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const usersTableBody = document.querySelector("#usersTable tbody");
const logoutBtn = document.getElementById("logoutBtn");
const statusMsg = document.getElementById("statusMsg");

logoutBtn.addEventListener("click", async () => {
  console.log("🚪 Logout in corso...");
  await signOut(auth);
  console.log("✅ Logout completato, redirect...");
  window.location.href = "/login/";
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "/login/";
    return;
  }

  const userID = user.uid;

  const userDocRef = doc(db, "users", user.uid);
  const userDocSnap = await getDoc(userDocRef);
  
  if (!userDocSnap.exists()) {
    setStatus("Profilo utente non trovato.", "error");
    await signOut(auth);
    window.location.href = "/login/";
    return;
  }

  const userData = userDocSnap.data();
  const allowedRoles = ["advstaffplus", "superadmin"];

  if (!allowedRoles.includes(userData.role)) {
      setStatus("Accesso negato: solo staff autorizzato.", "error");
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
    superadmin: 1,
    advstaffplus: 2,
    advstaff: 3,
    modstaff: 4,
    simplestaff: 5,
    user: 6
  };

  const getAlphabetKey = (str) => (str.username || str.name || str.surname || "").toString().toLowerCase();

  users.sort((a, b) => {
    const roleA = rolePriority[a.role] || 999;
    const roleB = rolePriority[b.role] || 999;

    if (roleA !== roleB) return roleA - roleB;

    if (a.role === "user" && b.role === "user") {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    }

    return 0;
  });

  users.forEach(u => {
    const tr = document.createElement("tr");
    const emailVerified = u.emailVerified ? "Sì" : "No"

    tr.innerHTML = `
      <td>${emailVerified}</td>
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
        <button class="view" onclick="window.open('/profile/?userid=${u.id}', '_blank')">Visualizza profilo</button>
      </td>
    `;

    tr.querySelector(".promote").addEventListener("click", () => updateRole(u.id, u.role));
    tr.querySelector(".suspend").addEventListener("click", () => updateStatus(u.id, u.status));
    tr.querySelector(".delete").addEventListener("click", () => deleteUser(u.id));

    usersTableBody.appendChild(tr);
  });
}

async function updateRole(userId, currentRole) {
  try {
    const roleHierarchy = ["user", "simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];
    const currentIndex = roleHierarchy.indexOf(currentRole);
    const newIndex = (currentIndex + 1) % roleHierarchy.length;
    const newRole = roleHierarchy[newIndex];

    const currentUserEmail = auth.currentUser.email;
    const currentUserName = auth.currentUser.displayName || "Staff";

    await addDoc(collection(db, "activities"), {
      type: "user_role_change",
      userName: currentUserName,
      userId: userId,
      newRole: newRole,
      changeStaffer: currentUserEmail,
      timestamp: serverTimestamp()
    });

    await updateDoc(doc(db, "users", userId), { role: newRole });
    loadUsers();
  } catch (error) {
    console.error("Errore nel cambio ruolo:", error);
    setStatus("Errore nel cambio ruolo.", "error");
  }
}

async function updateStatus(userId, currentStatus) {
  try {
    const newStatus = currentStatus === "attivo" ? "sospeso" : "attivo";
    await updateDoc(doc(db, "users", userId), { status: newStatus });
    loadUsers();
  } catch (error) {
    console.error("Errore nell'aggiornamento status:", error);
    setStatus("Errore nell'aggiornamento dello status.", "success");
  }
}

async function deleteUser(userId) {
  if (confirm("Sei sicuro di voler eliminare questo utente? L'account sarà permanentemente eliminato dopo 30 giorni.")) {
    try {
      await addDoc(collection(db, "activities"), {
        type: "user_deletion",
        userId: userId,
        deletedBy: auth.currentUser.email,
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, "users", userId), { status: "eliminato" });
      loadUsers();

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      
      setTimeout(async () => {
        try {
          const userDocRef = doc(db, "users", userId);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists() && userDocSnap.data().status === "eliminato") {
            await deleteDoc(userDocRef);
            console.log(`✅ Utente ${userId} eliminato permanentemente.`);
          }
        } catch (error) {
          console.error("Errore nella cancellazione permanente:", error);
        }
      }, thirtyDaysMs);

    } catch (error) {
      console.error("Errore nell'eliminazione:", error);
      setStatus("Errore nell'eliminazione dell'utente.", "error");
    }
  }
}

function setStatus(message, type = "info") {
  statusMsg.textContent = message;
  statusMsg.className = `${"statusBox" + " " + type}`;
  statusMsg.style.display = "block";
  const closeBtn = document.getElementById("closeSMsg");
  closeBtn.onclick = () => {
    statusMsg.style.display = "none";
  }
}