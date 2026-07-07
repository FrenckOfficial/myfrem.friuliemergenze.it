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
const statusMsg = document.getElementById("statusMsg");

let currentUser = null;
let isReadOnlyMode = false;

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;

  const timeoutId = setTimeout(() => {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }, 5000);

  try {
    if (user) {
      const userDocSnap = await getDoc(doc(db, "users", user.uid));
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.role === "testacc") {
          isReadOnlyMode = true;
          document.body.classList.add("read-only-mode");
        
          form.style.opacity = "0.5";
          form.style.pointerEvents = "none";
          
          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.title = "Non disponibile in modalità sola lettura";
          }
          
          setStatus("Modalità sola lettura: non puoi inviare messaggi", "info");
        }
      }
    }

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  } catch (err) {
    console.error("❌ Errore:", err);
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isReadOnlyMode) {
    setStatus("Non puoi inviare messaggi in modalità sola lettura.", "error");
    return;
  }

  const subject = document.getElementById("subject").value.trim();
  const message = document.getElementById("message").value.trim();

  if (!subject || !message) {
    setStatus("Oggetto e messaggio sono obbligatori.", "error");
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

    setStatus("Messaggio inviato con successo.", "success");
    form.reset();

  } catch (err) {
    console.error(err);
    setStatus("Errore durante l'invio del messaggio.", "error");
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  console.log("🚪 Logout in corso...");
  await auth.signOut();
  console.log("✅ Logout completato, redirect...");
  window.location.href = "/login/";
});