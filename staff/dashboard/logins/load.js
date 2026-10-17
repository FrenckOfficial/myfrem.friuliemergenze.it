import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, deleteDoc, doc, onSnapshot, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig } from "/helpers/configFirebase.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { escapeHtml } from "/helpers/escapeHtml.js";
import { createPager } from "/staff/dashboard/helpers/pager.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const loginTable = document.getElementById("usersTableBody");
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

  initBottomNav(userDoc.docs[0].data(), user, "staff");

  const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

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

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

const pager = createPager({
  ref: collection(db, "logins"),
  list: loginTable,
  anchor: loginTable.closest("table") || loginTable,
  moreLabel: "Carica altri accessi",
  renderEmpty: () => {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "Nessun login trovato.";
    row.append(cell);
    return row;
  },
  renderItem: (docSnap) => {
    const data = docSnap.data();
    const timestamp = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString("it-IT") : "—";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(data.email ?? "—")}</td>
      <td>${escapeHtml(timestamp)}</td>
      <td>${escapeHtml(data.userId ?? "—")}</td>
      <td>${escapeHtml(data.ipAddress ?? "—")}</td>
      <td>${escapeHtml(data.userAgent ?? "—")}</td>
    `;
    row.addEventListener("click", () => deleteDB(docSnap.id, row));
    return row;
  }
});

async function loadUsers() {
  await pager.load(true);
}

async function deleteDB(loginId, row) {
  if (!confirm("Sei sicuro di voler eliminare definitivamente questo login dal database? Questa azione è irreversibile.")) return;
  try {
    await deleteDoc(doc(db, "logins", loginId));
    row.remove();
    setStatus("Login eliminato.", "success");
  } catch (err) {
    console.error("Errore eliminazione login:", err);
    setStatus("Non è stato possibile eliminare il login.", "error");
  }
}