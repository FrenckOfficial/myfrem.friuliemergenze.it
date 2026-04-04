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
    arrayUnion,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "/login";
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login";
});

const urlParams = new URLSearchParams(window.location.search);
const reportId = urlParams.get("id");

const reportDetails = document.getElementById("reportDetails");
const notesContainer = document.getElementById("notesContainer");
const statusMsg = document.getElementById("statusMsg");

async function loadReport() {
    const ref = doc(db, "expulsionReports", reportId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        reportDetails.innerHTML = "<p>❌ Report non trovato.</p>";
        return;
    }

    const data = snap.data();

    reportDetails.innerHTML = `
        <p><strong>Utente:</strong> ${data.userName}</p>
        <p><strong>Contatto:</strong> ${data.userNumber || "-"}</p>
        <p><strong>Motivo:</strong> ${data.reason}</p>
        <p><strong>Note iniziali:</strong> ${data.notes || "Nessuna"}</p>
        <p><strong>Data espulsione:</strong> ${data.expulsionDate}</p>
    `;

    loadNotes(data.notesHistory || []);
}

function loadNotes(notes) {
    notesContainer.innerHTML = "";

    notes.forEach((n) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <strong>🕒 ${new Date(n.time.toDate()).toLocaleString()}</strong><br>
            ${n.text}
            ${n.attachment ? `<a class="attachment" href="${n.attachment}" target="_blank">📎 Allegato</a>` : ""}
        `;
        notesContainer.appendChild(li);
    });
}

document.getElementById("addNoteForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = document.getElementById("noteText").value.trim();
    const attachment = document.getElementById("noteAttachment").value.trim();

    if (!text) return;

    const noteEntry = {
        text,
        attachment: attachment || null,
        time: serverTimestamp(),
        staff: auth.currentUser.uid
    };

    try {
        await updateDoc(doc(db, "expulsionReports", reportId), {
            notesHistory: arrayUnion(noteEntry)
        });

        statusMsg.textContent = "✅ Nota aggiunta!";
        statusMsg.style.color = "#4aff4a";

        document.getElementById("addNoteForm").reset();

        loadReport();
    } catch (err) {
        console.error(err);
        statusMsg.textContent = "❌ Errore nel salvataggio.";
        statusMsg.style.color = "#ff3b3b";
    }
});

loadReport();