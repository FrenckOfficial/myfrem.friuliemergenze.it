import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    updateDoc,
    addDoc,
    collection,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "../../../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// AUTH
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "/login";
});

// LOGOUT
document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login";
});

// URL ID
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("id");

const userDetails = document.getElementById("userDetails");
const statusMsg = document.getElementById("statusMsg");
let linkedMyFremUser = null;

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

async function loadUser() {
    const ref = doc(db, "users_whatsapp", userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        userDetails.innerHTML = "<p>❌ Utente non trovato.</p>";
        return;
    }

    const data = snap.data();

    userDetails.innerHTML = `
        <p><strong>ID Utente:</strong> ${userId}</p>
        <p><strong>Nome:</strong> ${data.name || "-"}</p>
        <p><strong>Numero:</strong> ${data.phone || "-"}</p>
        <p><strong>Data iscrizione:</strong> ${data.date || "-"}</p>
        <p><strong>Tag:</strong> ${(data.tags || []).join(", ") || "-"}</p>
        <p><strong>Linked MyFrEM:</strong> ${data.linkedMyFremUser ? data.linkedMyFremUser.name ? data.linkedMyFremUser.name + " (" + data.linkedMyFremUser.role + ")" : "-" : "-"}</p>
        <p><strong>ID MyFrEM:</strong> ${data.linkedMyFremUser ? data.linkedMyFremUser.id || "-" : "-"}</p>
    `;

    document.getElementById("name").value = data.name || "";
    document.getElementById("number").value = data.phone || "";
    document.getElementById("joinedDate").value = data.date || "";
    document.getElementById("status").value = data.status || "";
    document.getElementById("notes").value = data.notes || "";
}

document.querySelector(".editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const tags = Array.from(document.querySelectorAll(".tagCheck:checked"))
    .map(t => t.value);

    const updatedData = {
        name: document.getElementById("name").value.trim(),
        phone: document.getElementById("number").value.trim(),
        date: document.getElementById("joinedDate").value.trim(),
        status: document.getElementById("status").value.trim(),
        notes: document.getElementById("notes").value.trim(),
        tags: tags || [],
        linkedMyFremUser: linkedMyFremUser || null,
        lastEdit: serverTimestamp(),
        editedBy: auth.currentUser.uid
    };

    try {
        await updateDoc(doc(db, "users_whatsapp", userId), updatedData);

        await addDoc(collection(db, "activities"), {
            type: "user_edit_whatsapp",
            userId,
            editedBy: auth.currentUser.email,
            timestamp: serverTimestamp()
        });

        window.location.href = "/staff/dashboard/management/users-whatsapp/";

    } catch (err) {
        console.error(err);
        statusMsg.textContent = "❌ Errore durante il salvataggio.";
        statusMsg.style.color = "#ff3b3b";
    }
});

loadUser();