import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("eventForm");
const statusMsg = document.getElementById("statusMsg");
const logoutBtn = document.getElementById("logoutBtn");

logoutBtn.onclick = async () => {
  await signOut(auth);
  window.location.href = "/login";
};

let currentUser = null;
let isReadOnlyMode = false;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  
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
        
        statusMsg.textContent = "📖 Modalità sola lettura: non puoi creare eventi";
        statusMsg.className = "warning";
      }
    }
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isReadOnlyMode) {
    statusMsg.textContent = "❌ Non puoi creare eventi in modalità sola lettura";
    statusMsg.style.color = "#ff4a4a";
    return;
  }

  const userDoc = await getDoc(doc(db, "users", currentUser.uid));

  if (!userDoc.exists()) {
    statusMsg.textContent = "❌ Errore: utente non trovato.";
    statusMsg.style.color = "#ff4a4a";
    return;
  }

  const title = document.getElementById("eventTitle").value;
  const description = document.getElementById("description").value;
  const location = document.getElementById("location").value;
  const contact = document.getElementById("contact").value;

  statusMsg.textContent = "⏳ Invio in corso...";
  statusMsg.style.color = "#ccc";

  try {
    await addDoc(collection(db, "activities"), {
      userName: userDoc.data().name,
      eventTitle: title,
      timestamp: serverTimestamp(),
      type: "event_creation",
    });

    await addDoc(collection(db, "events"), {
      title,
      description,
      location,
      contact,
      userId: userDoc.data().name + " " + userDoc.data().surname,
      uid: currentUser.uid,
      status: "In revisione...",
      createdAt: serverTimestamp()
    });

    statusMsg.textContent = "✅ Proposta inviata! Lo staff ti contatterà.";
    statusMsg.style.color = "#4aff4a";
    form.reset();
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "❌ Errore durante l'invio.";
    statusMsg.style.color = "#ff4a4a";
  }
});