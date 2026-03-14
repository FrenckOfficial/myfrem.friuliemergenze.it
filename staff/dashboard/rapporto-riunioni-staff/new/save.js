import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "../../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let staffEmail = "";

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "/login";
  } else {
    staffEmail = user.email;
    document.getElementById("opener").innerHTML = `<a href="mailto:${staffEmail}" target="_blank">${staffEmail}</a>`;
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

const reunionForm = document.getElementById("reunionReportForm");
const statusMsg = document.getElementById("statusMsg");

reunionForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const startDate = document.getElementById("startDate").value.trim();
  const endDate = document.getElementById("endDate").value.trim();
  const order = document.getElementById("ordine").value.trim();
  const description = document.getElementById("description").value.trim();

  try {

    if (!startDate || !endDate || !order || !description) {
      statusMsg.textContent = "❌ Compila tutti i campi obbligatori!";
      statusMsg.className = "error";
      return;
    }

    await addDoc(collection(db, "reunionsReports"), {
      startDate,
      endDate,
      order,
      description,
      opener: staffEmail,
      createdAt: new Date()
    });

    statusMsg.textContent = "✅ Report inviato e caricato con successo!";
    statusMsg.className = "success";
    reunionForm.reset();

  } catch (err) {
    console.error("Errore invio report:", err);
    statusMsg.textContent = "❌ Errore nell'invio del report. Riprovare.";
    statusMsg.className = "error";
  }
});