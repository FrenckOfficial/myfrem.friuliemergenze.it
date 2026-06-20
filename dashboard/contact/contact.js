import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("contactForm");
const result = document.getElementById("result");

let currentUser = null;
let isReadOnlyMode = false;

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  
  if (user) {
    // 🔒 Controlla il ruolo
    const userDocSnap = await getDoc(doc(db, "users", user.uid));
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (userData.role === "testacc") {
        isReadOnlyMode = true;
        document.body.classList.add("read-only-mode");
        
        // Disabilita il form
        form.style.opacity = "0.5";
        form.style.pointerEvents = "none";
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.title = "Non disponibile in modalità sola lettura";
        }
        
        result.textContent = "📖 Modalità sola lettura: non puoi inviare messaggi";
        result.className = "warning";
      }
    }
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isReadOnlyMode) {
    result.innerText = "❌ Non puoi inviare messaggi in modalità sola lettura";
    return;
  }

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

    await addDoc(collection(db, "activities"), {
      type: "new_ticket",
      title: subject,
      from: "Sistema di contatto MyFrEM",
      timestamp: serverTimestamp()
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