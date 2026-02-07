// Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Login check
onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "/login";
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

// ELEMENTI
const form = document.getElementById("expulsionReportForm");
const statusMsg = document.getElementById("statusMsg");
let linkedMyFremUser = null;

// 🔗 COLLEGAMENTO UTENTE MYFREM
document.getElementById("linkMyFremBtn").onclick = async () => {
  const id = document.getElementById("myfremIdInput").value.trim();
  if (!id) return alert("Inserisci un ID!");

  try {
    const userDoc = await getDoc(doc(db, "users", id));

    if (!userDoc.exists()) {
      document.getElementById("myfremResult").innerHTML = "❌ Nessun utente trovato.";
      linkedMyFremUser = null;
      return;
    }

    linkedMyFremUser = { id, ...userDoc.data() };

    document.getElementById("myfremResult").innerHTML = `
      <b>Utente trovato</b><br>
      Nome: ${linkedMyFremUser.name}<br>
      Email: ${linkedMyFremUser.email}<br>
      Ruolo: ${linkedMyFremUser.role}
    `;

  } catch (err) {
    console.error(err);
    alert("Errore durante la ricerca dell'utente MyFrEM.");
  }
};

// 📤 SALVATAGGIO
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userName = document.getElementById("userSelect").value.trim();
  const userNumber = document.getElementById("userNumber").value.trim();
  const expulsionDate = document.getElementById("expulsionDate").value;
  const notes = document.getElementById("notes").value.trim();

  // TAG
  const tags = Array.from(document.querySelectorAll(".tagCheck:checked"))
    .map(t => t.value);

  if (!userName || !expulsionDate) {
    statusMsg.textContent = "❌ Compila tutti i campi obbligatori!";
    statusMsg.className = "error";
    return;
  }

  try {
    // 🔥 SALVATAGGIO UTENTE
    await addDoc(collection(db, "users_whatsapp"), {
      name: userName,
      phone: userNumber || null,
      date: expulsionDate,
      notes: notes || null,
      tags: tags || [],
      linkedMyFremUser: linkedMyFremUser || null,
      role: "user",
      status: "active",
      createdAt: serverTimestamp()
    });

    // 🔥 LOG ATTIVITÀ
    await addDoc(collection(db, "activities"), {
      type: "user_creation_whatsapp",
      addStaffer: auth.currentUser?.email || "unknown",
      userName,
      timestamp: serverTimestamp()
    });

    statusMsg.textContent = "✅ Utente aggiunto con successo!";
    statusMsg.className = "success";
    form.reset();
    linkedMyFremUser = null;

    window.location.href = "/staff/dashboard/management/users-whatsapp/";

  } catch (err) {
    console.error("Errore creazione utente:", err);
    statusMsg.textContent = "❌ Errore nella creazione dell'utente.";
    statusMsg.className = "error";
  }
});