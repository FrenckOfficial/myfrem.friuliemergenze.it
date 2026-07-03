import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const userSelect = document.getElementById("userSelect");
const userNumber = document.getElementById("userNumber");
const permissionType = document.getElementById("permissionType");
const notes = document.getElementById("notes");
const statusMsg = document.getElementById("statusMsg");
const form = document.getElementById("expulsionReportForm");

let usersMap = {};

async function loadUsers() {
  try {
    const snap = await getDocs(collection(db, "users_whatsapp"));

    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (!data) return;

      usersMap[docSnap.id] = data;

      const option = document.createElement("option");
      option.value = docSnap.id;

      const name = data.name || "Senza nome";
      const phone = data.phone || "No numero";

      option.textContent = `${name} (${phone})`;

      option.dataset.name = name;
      option.dataset.full = `${name} (${phone})`;

      userSelect.appendChild(option);
    });

  } catch (err) {
    console.error("Errore caricamento utenti:", err);
  }
}

userSelect.addEventListener("change", () => {
  const selectedUser = usersMap[userSelect.value];

  userNumber.value = selectedUser?.phone || "";

  Array.from(userSelect.options).forEach(opt => {
    if (opt.dataset.full) {
      opt.textContent = opt.dataset.full;
    }
  });

  const selectedOption = userSelect.options[userSelect.selectedIndex];
  if (selectedOption.dataset.name) {
    selectedOption.textContent = selectedOption.dataset.name;
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userId = userSelect.value;
  const userData = usersMap[userId];
  const perm = permissionType.value;

  if (!userId || !perm) {
    statusMsg.textContent = "❌ Compila tutti i campi obbligatori";
    statusMsg.style.color = "red";
    return;
  }

  try {
    await addDoc(collection(db, "groupPermissions"), {
      userId: userId,
      name: userData.name || "",
      phone: userData.phone || "",
      permissionType: perm,
      notes: notes.value || "",
      createdAt: new Date()
    });

    setStatus("Permesso salvato con successo!", "success");

    window.location.href = "/staff/dashboard/management/permissions";
    userNumber.value = "";

    Array.from(userSelect.options).forEach(opt => {
      if (opt.dataset.full) {
        opt.textContent = opt.dataset.full;
      }
    });

  } catch (err) {
    console.error(err);
    setStatus("Errore durante il salvataggio", "error");
  }
});

function setStatus(message, type = "info") {
  statusMsg.textContent = message;
  statusMsg.className = `${"statusBox" + " " + type}`;
  statusMsg.style.display = "block";
  const closeBtn = document.getElementById("closeSMsg");
  closeBtn.onclick = () => {
    statusMsg.style.display = "none";
  }
}

loadUsers();