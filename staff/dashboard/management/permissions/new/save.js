import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const userSelect = document.getElementById("userSelect");
const userNumber = document.getElementById("userNumber");
const permissionType = document.getElementById("permissionType");
const expulsionDate = document.getElementById("expulsionDate");
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

  if (!userId || !perm || !expulsionDate.value) {
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
      joinedAt: new Date(expulsionDate.value),
      notes: notes.value || "",
      createdAt: new Date()
    });

    statusMsg.textContent = "✅ Permesso salvato con successo!";
    statusMsg.style.color = "green";

    form.reset();
    userNumber.value = "";

    Array.from(userSelect.options).forEach(opt => {
      if (opt.dataset.full) {
        opt.textContent = opt.dataset.full;
      }
    });

  } catch (err) {
    console.error(err);
    statusMsg.textContent = "❌ Errore durante il salvataggio";
    statusMsg.style.color = "red";
  }
});

loadUsers();