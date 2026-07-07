import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const permissionsTableBody = document.querySelector("#permissionTable tbody");
const logoutBtn = document.getElementById("logoutBtn");
const totalPermissionsCountEl = document.getElementById("totalPermissionsCount");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

logoutBtn.addEventListener("click", async () => {
  console.log("🚪 Logout in corso...");
  await auth.signOut();
  console.log("✅ Logout completato, redirect...");
  window.location.href = "/login/";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  const allowedRoles = ["advstaffplus", "superadmin"];

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

  await loadPermissions();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

async function loadPermissions() {
  permissionsTableBody.innerHTML = "";

  const q = query(collection(db, "groupPermissions"), orderBy("createdAt", "desc"));

  const permissionsSnap = await getDocs(q);
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

    let permissionType = [];

    if (u.permissionType === "photovideo_extra_fvg") {
      permissionType.push("📸 Extra Regionali");
    } else if (u.permissionType === "photovideo_extra_ita") {
      permissionType.push("🎥 Extra Italiani");
    } else if (u.permissionType === "all_media") {
      permissionType.push("📸🎥 Tutti i tipi");
    } else {
      permissionType.push("N/A");
    }

    tr.innerHTML = `
      <td>${u.name || "N/A"}</td>
      <td>${u.phone || "N/A"}</td>
      <td>${permissionType || "N/A"}</td>
      <td>${u.notes || "N/A"}</td>
      <td>${u.createdAt ? u.createdAt.toDate().toLocaleString() : "N/A"}</td>
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

function setStatus(message, type = "info") {
  const statusMsg = document.getElementById("statusMsg");
  statusMsg.textContent = message;
  statusMsg.className = `${"statusBox" + " " + type}`;
  statusMsg.style.display = "block";
  const closeBtn = document.getElementById("closeSMsg");
  closeBtn.onclick = () => {
    statusMsg.style.display = "none";
  };
};