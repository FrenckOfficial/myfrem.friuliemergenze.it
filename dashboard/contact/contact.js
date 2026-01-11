import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("contactForm");
const result = document.getElementById("result");

let currentUser = null;

onAuthStateChanged(auth, user => {
  currentUser = user || null;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const subject = document.getElementById("subject").value.trim();
  const message = document.getElementById("message").value.trim();

  if (!subject || !message) {
    result.innerText = "❌ Compila tutti i campi.";
    return;
  }

  try {
    await addDoc(collection(db, "messages"), {
      userId: currentUser?.uid || null,
      email: currentUser?.email || "Non autenticato",
      subject,
      message,
      from: "Sistema di contatto MyFrEM",
      createdAt: serverTimestamp(),
      status: "Aperta"
    });

    result.innerText = "✅ Messaggio inviato! Ti risponderemo al più presto.";
    form.reset();

  } catch (err) {
    console.error(err);
    result.innerText = "❌ Errore durante l'invio.";
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  console.log("🚪 Logout in corso...");
  await auth.signOut();
  console.log("✅ Logout completato, redirect...");
  window.location.href = "/login/";
});