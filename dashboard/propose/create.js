import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("eventForm");
const statusMsg = document.getElementById("statusMsg");
const statusBox = document.querySelector(".statusBox");
const closeSMsg = document.getElementById("closeSMsg");
const logoutBtn = document.getElementById("logoutBtn");

logoutBtn.onclick = async () => {
  await signOut(auth);
  window.location.href = "/login";
};

let currentUser = null;
let isReadOnlyMode = false;

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  const timeoutId = setTimeout(() => {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 5000);

  await addDoc(collection(db, "viewedPages"), {
    type: "page_view",
    timestamp: serverTimestamp(),
    userId: user.uid,
    page: window.location.pathname
  });

  try {
    if (user) {
      const userDocSnap = await getDoc(doc(db, "users", user.uid));
      if (userDocSnap.exists()) {
        const staffRoles = [
          "simplestaff",
          "modstaff",
          "advstaff",
          "advstaffplus",
          "superadmin",
        ];

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
          
          showStatus("Modalità sola lettura: non puoi creare eventi", "warning");
        }

        if (staffRoles.includes(userData.role)) {
          const staffLinkEl = document.querySelector('.navbar');
          const br = document.createElement('br');
          const link = document.createElement('a');
          link.href = '/staff/dashboard/';
          link.textContent = 'Passa alla dashboard staff';
          staffLinkEl.appendChild(br);
          staffLinkEl.appendChild(link);
        }
      }
    }

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  } catch (err) {
    console.error("❌ Errore:", err);
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }
});

closeSMsg.addEventListener("click", () => {
  statusBox.style.display = "none";
});

function showStatus(message, type = "info") {
  statusMsg.textContent = message;
  statusBox.className = `statusBox ${type}`;
  statusBox.style.display = "flex";
  
  if (type === "success") {
    setTimeout(() => {
      statusBox.style.display = "none";
    }, 6000);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isReadOnlyMode) {
    showStatus("Non puoi creare eventi in modalità sola lettura", "error");
    return;
  }

  const userDoc = await getDoc(doc(db, "users", currentUser.uid));

  if (!userDoc.exists()) {
    showStatus("Errore: utente non trovato.", "error");
    return;
  }

  const title = document.getElementById("eventTitle").value.trim();
  const eventType = document.getElementById("eventType").value;
  const description = document.getElementById("description").value.trim();
  const location = document.getElementById("location").value.trim();
  const contact = document.getElementById("contact").value.trim();

  const suggestedDate = document.getElementById("suggestedDate").value || null;
  const suggestedTime = document.getElementById("suggestedTime").value || null;
  const expectedParticipants = document.getElementById("expectedParticipants").value || null;
  const contactEmail = document.getElementById("contactEmail").value.trim() || null;
  const attachmentUrl = document.getElementById("attachmentUrl").value.trim() || null;
  const additionalNotes = document.getElementById("additionalNotes").value.trim() || null;

  if (!title || !eventType || !description || !location || !contact) {
    showStatus("Per favore, compila tutti i campi obbligatori.", "error");
    return;
  }

  showStatus("Invio in corso...", "info");

  try {
    await addDoc(collection(db, "activities"), {
      userName: userDoc.data().name,
      eventTitle: title,
      timestamp: serverTimestamp(),
      type: "event_creation",
    });

    await addDoc(collection(db, "events"), {
      title,
      eventType,
      description,
      location,
      contact,
      
      ...(suggestedDate && { suggestedDate }),
      ...(suggestedTime && { suggestedTime }),
      ...(expectedParticipants && { expectedParticipants: parseInt(expectedParticipants) }),
      ...(contactEmail && { contactEmail }),
      ...(attachmentUrl && { attachmentUrl }),
      ...(additionalNotes && { additionalNotes }),
      
      userId: userDoc.data().name + " " + userDoc.data().surname,
      uid: currentUser.uid,
      status: "In revisione",
      createdAt: serverTimestamp()
    });

    showStatus("Proposta inviata con successo!", "success");
    form.reset();

  } catch (err) {
    console.error(err);
    showStatus("Errore durante l'invio. Riprova più tardi.", "error");
  }
});