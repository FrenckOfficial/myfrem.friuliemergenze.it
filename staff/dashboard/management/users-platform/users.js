import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc, serverTimestamp, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { getUserName } from "/helpers/getUserName.js";

import { firebaseConfig } from "/configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "europe-west1");
const adminResetPassword = httpsCallable(functions, "adminResetPassword");

const usersTableBody = document.querySelector("#usersTable tbody");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const filterRole = document.getElementById("filterRole");
const filterStatus = document.getElementById("filterStatus");
const filterVerified = document.getElementById("filterVerified");
const filterViewed = document.getElementById("filterViewed");
const resetFilters = document.getElementById("resetFilters");
const totalUsersCountEl = document.getElementById("totalUsersCount");
const searchResultsCount = document.getElementById("searchResultsCount");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

const modal = document.getElementById("userModal");
const modalClose = document.getElementById("modalClose");
const modalOverlay = document.getElementById("modalOverlay");

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login/";
});

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);

function closeModal() {
  modal.style.display = "none";
  modalOverlay.style.display = "none";
}

async function openModal(user) {
  const loginRef = collection(db, "logins");
  const userLoginDocs = query(loginRef, where("userId", "==", user.id), orderBy("timestamp", "desc"), limit(1));
  const lastLoginSnap = await getDocs(userLoginDocs);
  const lastLogin = lastLoginSnap.docs[0]?.data().timestamp ? lastLoginSnap.docs[0].data().timestamp.toDate().toLocaleString() : "N/A";

  let type;
  let role;
  let status;

  if (user.role === "user") {
    role = "Utente Standard"
  } else if (user.role === "simplestaff") {
    role = "Nuovo Amministratore"
  } else if (user.role === "modstaff") {
    role = "Moderatore"
  } else if (user.role === "advstaff") {
    role = "Amministratore"
  } else if (user.role === "advstaffplus") {
    role = "Amministratore Avanzato"
  } else if (user.role === "superadmin") {
    role = "Super Amministratore"
  } else if (user.role === "association") {
    role = "Account Associazione"
  } else if (user.role === "testacc") {
    role = "Account di Test"
  } else {
    role = "Ruolo non riconosciuto";
  }

  if (user.status === "attivo") {
    status = "Attivo"
  } else if (user.status === "inattivo") {
    status = "Inattivo"
  } else if (user.status === "sospeso") {
    status = "Sospeso"
  } else if (user.status === "eliminato") {
    status = "Eliminato"
  } else {
    status = "Status non riconosciuto";
  }

  if (user.privateProfile) {
    type = "Profilo Privato";
  } else {
    type = "Profilo Pubblico";
  }

  document.getElementById("modalUserId").textContent = user.id || "N/A";
  document.getElementById("modalUserName").textContent = `${user.name || ""} ${user.surname || ""}`;
  document.getElementById("modalEmail").textContent = user.email || "";
  document.getElementById("modalUsername").textContent = user.username || "";
  document.getElementById("modalPhone").textContent = user.phone || "Non fornito";
  document.getElementById("modalProfileType").textContent = type || "Non disponibile";
  document.getElementById("modalRegisterDate").textContent = user.createdAt.toDate().toLocaleString("it-IT") || "N/A";
  document.getElementById("modalRole").textContent = role || "N/A";
  document.getElementById("modalStatus").textContent = status || "N/A";
  document.getElementById("modalLastLogin").textContent = lastLogin || "N/A";
  document.getElementById("modalVerified").textContent = user.emailVerified ? "Sì" : "No";
  document.getElementById("modalWhatsNewViewed").textContent = user.whatsNewViewed ? "Visto" : "Non visto";
  
  const prefs = [];
  if (user.newsSubbed) prefs.push("Newsletter");
  if (user.emailNotifications) prefs.push("Notifiche email");
  if (user.privateProfile) prefs.push("Profilo privato");
  document.getElementById("modalPreferences").textContent = prefs.length ? prefs.join(", ") : "Nessuna";

  const userName = getUserName(user.id);

  document.getElementById("modalPromote").onclick = () => updateRole(user.id, user.role);
  document.getElementById("modalResetPassword").onclick = () => resetPassword(user);
  document.getElementById("modalDelete").onclick = () => deleteUser(user.id, userName);
  document.getElementById("modalViewProfile").onclick = () => window.open(`/profile/?userid=${user.id}`, "_blank");

  modal.style.display = "block";
  modalOverlay.style.display = "block";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  initBottomNav(userDoc.docs[0].data(), user, "staff");

  const allowedRoles = ["advstaffplus", "superadmin"];

  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    setStatus("Accesso negato: non sei staff!", "error");
    window.location.href = "/dashboard";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  await loadUsers();
  applyFilters();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

function applyFilters() {
  const textFilter = searchInput.value.toLowerCase();
  const roleFilter = filterRole.value;
  const statusFilter = filterStatus.value;
  const verifiedFilter = filterVerified.value;
  const viewedFilter = filterViewed.value;

  const rows = usersTableBody.querySelectorAll("tr");
  let visibleCount = 0;

  rows.forEach(row => {
    const matchesText = row.textContent.toLowerCase().includes(textFilter);
    const matchesRole = !roleFilter || row.dataset.role === roleFilter;
    const matchesStatus = !statusFilter || row.dataset.status === statusFilter;
    const matchesVerified = !verifiedFilter || row.dataset.verified === verifiedFilter;
    const matchesViewed = !viewedFilter || row.dataset.whatsNewViewed === viewedFilter;

    const visible = matchesText && matchesRole && matchesStatus && matchesVerified && matchesViewed;
    row.style.display = visible ? "" : "none";

    if (visible) visibleCount++;
  });

  searchResultsCount.textContent = visibleCount;
}

searchInput.addEventListener("keyup", applyFilters);
filterRole.addEventListener("change", applyFilters);
filterStatus.addEventListener("change", applyFilters);
filterVerified.addEventListener("change", applyFilters);
filterViewed.addEventListener("change", applyFilters);

resetFilters.addEventListener("click", () => {
  searchInput.value = "";
  filterRole.value = "";
  filterStatus.value = "";
  filterVerified.value = "";
  filterViewed.value = "";
  applyFilters();
});

async function loadUsers() {
  usersTableBody.innerHTML = "";
  const usersSnap = await getDocs(collection(db, "users"));
  totalUsersCountEl.textContent = usersSnap.size;

  let users = [];
  let role;
  let status;

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
    if (u.role === "user") {
      role = "Utente Standard"
    } else if (u.role === "simplestaff") {
      role = "Nuovo Amministratore"
    } else if (u.role === "modstaff") {
      role = "Moderatore"
    } else if (u.role === "advstaff") {
      role = "Amministratore"
    } else if (u.role === "advstaffplus") {
      role = "Amministratore Avanzato"
    } else if (u.role === "superadmin") {
      role = "Super Amministratore"
    } else if (u.role === "association") {
      role = "Account Associazione"
    } else if (u.role === "testacc") {
      role = "Account di Test"
    } else {
      role = "Ruolo non riconosciuto";
    }

    if (u.status === "attivo") {
      status = "Attivo"
    } else if (u.status === "inattivo") {
      status = "Inattivo"
    } else if (u.status === "sospeso") {
      status = "Sospeso"
    } else if (u.status === "eliminato") {
      status = "Eliminato"
    } else {
      status = "Status non riconosciuto";
    }

    const tr = document.createElement("tr");

    tr.dataset.role = u.role || "";
    tr.dataset.status = u.status || "";
    tr.dataset.verified = u.emailVerified ? "true" : "false";
    tr.dataset.whatsNewViewed = u.whatsNewViewed ? "true" : "false";

    tr.innerHTML = `
      <td>${u.name + " " + u.surname || ""}</td>
      <td>${u.email || ""}</td>
      <td>${u.username || ""}</td>
      <td>${role || "N/A"}</td>
      <td>${status || "N/A"}</td>
    `;

    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => openModal(u));

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
    const currentUserName = userId || "Staff";

    await addDoc(collection(db, "activities"), {
      type: "user_role_change",
      userName: currentUserName,
      userId: userId,
      newRole: newRole,
      changeStaffer: currentUserEmail,
      timestamp: serverTimestamp()
    });

    await updateDoc(doc(db, "users", userId), { role: newRole });
    setStatus(`Ruolo aggiornato a ${newRole}`, "success");
    closeModal();
    await loadUsers();
    applyFilters();
  } catch (error) {
    console.error("Errore nel cambio ruolo:", error);
    setStatus("Errore nel cambio ruolo.", "error");
  }
}

async function resetPassword(user) {
  if (!confirm(`Generare una password temporanea per ${user.email}? La password attuale smetterà di funzionare.`)) return;

  try {
    const { data } = await adminResetPassword({ uid: user.id });

    await addDoc(collection(db, "activities"), {
      type: "user_password_reset",
      userId: user.id,
      resetBy: auth.currentUser.email,
      timestamp: serverTimestamp()
    });

    try { await navigator.clipboard.writeText(data.tempPassword); } catch {}
    setStatus(`Password temporanea per ${user.email}:\n\n${data.tempPassword}\n\n(copiata negli appunti)`);
  } catch (error) {
    console.error("Errore nel reset password:", error);
    setStatus("Errore nel reset della password.", "error");
  }
}

async function deleteUser(userId, userName) {
  if (confirm("Sei sicuro di voler eliminare questo utente? L'account sarà permanentemente eliminato dopo 30 giorni.")) {
    try {
      await addDoc(collection(db, "activities"), {
        type: "user_deletion",
        userId: userName,
        deletedBy: auth.currentUser.email,
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, "users", userId), { status: "eliminato" });
      setStatus("Utente marcato come eliminato", "success");
      closeModal();
      
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      
      setTimeout(async () => {
        try {
          const userDocRef = doc(db, "users", userId);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists() && userDocSnap.data().status === "eliminato") {
            await deleteDoc(userDocRef);
          }
        } catch (error) {
          console.error("Errore nella cancellazione permanente:", error);
        }
      }, thirtyDaysMs);
      
      await loadUsers();
      applyFilters();
      
    } catch (error) {
      console.error("Errore nell'eliminazione:", error);
      setStatus("Errore nell'eliminazione dell'utente.", "error");
    }
  }
}