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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "../../../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 🔐 Auth Check
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "/login";
});

// 🔐 Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login";
});

// 📌 Prende ID utente da URL
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("id");

const userDetails = document.getElementById("userDetails");
const statusMsg = document.getElementById("statusMsg");

// 📥 Carica utente
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
        <p><strong>Data di iscrizione:</strong> ${data.date || "-"}</p>
        <p><strong>Stato:</strong> ${data.status || "-"}</p>
        <p><strong>Note:</strong> ${data.notes || "-"}</p>
    `;

    // Compila form
    document.getElementById("name").value = data.name || "";
    document.getElementById("number").value = data.phone || "";
    document.getElementById("joinedDate").value = data.date  || "";
    document.getElementById("status").value = data.status || "";
    document.getElementById("notes").value = data.notes || "";
}

// 💾 Salva modifiche
document.querySelector(".editForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const updatedData = {
        name: document.getElementById("name").value.trim(),
        phone: document.getElementById("number").value.trim(),
        joinedDate: document.getElementById("joinedDate").value.trim(),
        status: document.getElementById("status").value.trim(),
        notes: document.getElementById("notes").value.trim(),
        lastEdit: serverTimestamp(),
        editedBy: auth.currentUser.uid
    };

    try {
        await updateDoc(doc(db, "users_whatsapp", userId), updatedData);
        window.location.href = "/staff/dashboard/management/users-whatsapp/";

        await updateDoc(doc(db, "activities", ), {
            type: "user_edit_whatsapp",
            userName: userId,
            editedBy: auth.currentUser.email || "unknown",
            timestamp: serverTimestamp()
        });

        statusMsg.textContent = "✅ Modifiche salvate!";
        statusMsg.style.color = "#4aff4a";

        loadUser();
    } catch (err) {
        console.error(err);
        statusMsg.textContent = "❌ Errore durante il salvataggio.";
        statusMsg.style.color = "#ff3b3b";
    }
});

loadUser();