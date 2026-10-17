import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { auth, db } from "/helpers/firebase.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { createFilteredList, deleteButton } from "/staff/dashboard/helpers/filteredList.js";

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

const loginTable = document.getElementById("usersTableBody");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

function showContent() {
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text ?? "—";
  return td;
}

function renderEmpty(text) {
  const row = document.createElement("tr");
  row.className = "activity-empty";
  const td = cell(text);
  td.colSpan = 6;
  row.append(td);
  return row;
}

function renderRow(docSnap, list) {
  const data = docSnap.data();
  const timestamp = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString("it-IT") : "—";

  const row = document.createElement("tr");
  const actions = document.createElement("td");
  actions.append(deleteButton("Elimina accesso", async () => {
    if (!confirm("Sei sicuro di voler eliminare definitivamente questo accesso dal database? Questa azione è irreversibile.")) return false;
    await deleteDoc(doc(db, "logins", docSnap.id));
    list.removed(row);
    setStatus("Accesso eliminato.", "success");
    return true;
  }));

  row.append(cell(data.email), cell(timestamp), cell(data.userId), cell(data.ipAddress), cell(data.userAgent), actions);
  return row;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "/login");

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const userData = userSnap.exists() ? userSnap.data() : null;

  if (!userData || !STAFF_ROLES.includes(userData.role)) {
    showContent();
    setStatus("Accesso negato: non sei staff!", "error");
    return (window.location.href = "/dashboard");
  }

  initBottomNav(userData, user, "staff");
  showContent();

  createFilteredList({
    db,
    ref: collection(db, "logins"),
    panel: document.getElementById("loginsPanel"),
    list: loginTable,
    frame: document.getElementById("loginsList"),
    person: {
      label: "Utente",
      placeholder: "Email o UID",
      resolve: async (value) => (value.includes("@") ? { field: "email", value } : { field: "userId", value })
    },
    renderItem: renderRow,
    renderEmpty,
    emptyText: "Nessun accesso con questi filtri.",
    unit: "accessi"
  }).start();
});
