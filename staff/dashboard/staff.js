// ✅ Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ Riferimenti DOM
const userNameEl = document.getElementById("userName");
const totalUsersEl = document.getElementById("totalUsers");
const pendingPhotosEl = document.getElementById("pendingPhotos");
const approvedPhotosEl = document.getElementById("approvedPhotos");
const rejectedPhotosEl = document.getElementById("rejectedPhotos");
const totalEventsEl = document.getElementById("totalEvents");
const pendingEventsEl = document.getElementById("pendingEvents");
const approvedEventsEl = document.getElementById("approvedEvents");
const rejectedEventsEl = document.getElementById("rejectedEvents");
const organizedEventsEl = document.getElementById("organizedEvents");
const recentActivityListEl = document.getElementById("recentActivityList");
const logoutBtn = document.getElementById("logoutBtn");

// 🚪 Logout
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

// 🔑 Controllo autenticazione + ruolo staff
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  // Verifica che sia staff
  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  const allowedRoles = ["staff", "simpleadmin", "modstaff", "advstaff"];

  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    alert("❌ Accesso negato: non sei staff!");
    window.location.href = "/dashboard";
    return;
  }

  // ✅ Se staff, carica le statistiche
  loadStats();
});

// 📊 Funzione per caricare statistiche
async function loadStats() {
  try {
    // 🔹 Utenti
    const usersSnap = await getDocs(collection(db, "users"));
    totalUsersEl.textContent = usersSnap.size;

    // Loadda l'esatto nome dello staffer loggato
    const currentUser = auth.currentUser;
    const currentUserDoc = await getDocs(
      query(collection(db, "users"), where("__name__", "==", currentUser.uid))
    );
    const currentUserData = currentUserDoc.docs[0].data();
    userNameEl.textContent = `${currentUserData.name} ${currentUserData.surname}`;

    // 🔹 Foto pending
    const pendingSnap = await getDocs(
      query(collection(db, "photos"), where("status", "==", "Foto in attesa di approvazione ⌛"))
    );
    pendingPhotosEl.textContent = pendingSnap.size;

    // 🔹 Foto approvate
    const approvedSnap = await getDocs(
      query(collection(db, "photos"), where("status", "==", "Approvata ✅"))
    );
    approvedPhotosEl.textContent = approvedSnap.size;

    // 🔹 Foto rifiutate
    const rejectedSnap = await getDocs(
      query(collection(db, "photos"), where("status", "==", "Rifiutata ❌"))
    );
    rejectedPhotosEl.textContent = rejectedSnap.size;

    // 🔹 Eventi 
    const eventsSnap = await getDocs(collection(db, "events"));
    totalEventsEl.textContent = eventsSnap.size;

    // 🔹 Eventi pending
    const eventsPendingSnap = await getDocs(
      query(collection(db, "events"), where("status", "==", "In revisione..."))
    );
    pendingEventsEl.textContent = eventsPendingSnap.size;

    // 🔹 Eventi approvati
    const eventsApprovedSnap = await getDocs(
      query(collection(db, "events"), where("status", "==", "Approvato"))
    );
    approvedEventsEl.textContent = eventsApprovedSnap.size;

    // 🔹 Eventi rifiutati
    const eventsRejectedSnap = await getDocs(
      query(collection(db, "events"), where("status", "==", "Rifiutato"))
    );
    rejectedEventsEl.textContent = eventsRejectedSnap.size;

    // 🔹 Eventi organizzati
    const eventsOrganizedSnap = await getDocs(
      query(collection(db, "events"), where("status", "==", "Organizzato"))
    );

    organizedEventsEl.textContent = eventsOrganizedSnap.size;

    // 🔹 Ultime attività generali
    const activitiesSnap = await getDocs(collection(db, "activities"));
    recentActivityListEl.innerHTML = "";
    activitiesSnap.docs
      .sort((a, b) => b.data().timestamp.toMillis() - a.data().timestamp.toMillis())
      .slice(0, 5)
      .forEach((doc) => {
        const activity = doc.data();
        const li = document.createElement("li");
        const date = activity.timestamp.toDate().toLocaleString();
        if (activity.type === "photo_submission") {
          li.textContent = `[${date}] Nuova foto inviata da ${activity.userName}: "${activity.photoTitle}"`;
        } else if (activity.type === "event_creation") {
          li.textContent = `[${date}] Nuovo evento creato da ${activity.userName}: "${activity.eventTitle}"`;
        } else if (activity.type === "event_approval") {
          li.textContent = `[${date}] Evento "${activity.eventTitle}" approvato da: "${activity.approvalStaffer}"`;
        } else if (activity.type === "event_rejection") {
          li.textContent = `[${date}] Evento "${activity.eventTitle}" rifiutato da: "${activity.rejectionStaffer}"`;
        } else if (activity.type === "photo_approval") {
          li.textContent = `[${date}] Foto "${activity.photoTitle}" approvata da: "${activity.approvalStaffer}"`;
        } else if (activity.type === "photo_rejection") {
          li.textContent = `[${date}] Foto "${activity.photoTitle}" rifiutata da: "${activity.rejectionStaffer}"`;
        } else if (activity.type === "event_organized") {
          li.textContent = `[${date}] Evento "${activity.eventTitle}" organizzato da: "${activity.organizationStaffer}"`;
        } else if (activity.type === "photo_edit") {
          li.textContent = `[${date}] Foto "${activity.photoTitle}" modificata da: "${activity.editStaffer}"`;
        } else if (activity.type === "user_role_change") {
          li.textContent = `[${date}] Ruolo utente "${activity.userName}" cambiato in "${activity.newRole}" da: "${activity.changeStaffer}"`;
        } else if (activity.type === "user_deletion") {
          li.textContent = `[${date}] L'utente "${activity.userName}" ha richiesto la cancellazione del proprio account.`;
        } else if (activity.type === "user_creation") {
          li.textContent = `[${date}] Nuovo utente registrato: "${activity.userName}"`;
        } else if (activity.type === "kick_add") {
          li.textContent = `[${date}] Nuovo report di espulsione aggiunto da "${activity.addStaffer}": "${activity.kickedMember}"`;
        } else if (activity.type === "eventRegistration") {
          li.textContent = `[${date}] ${activity.nameJoiner} si è iscritto all'evento "${activity.eventTitle}" (ID: ${activity.eventId}).`;
        } else {
          li.textContent = `[${date}] Attività sconosciuta.`;
        };

        recentActivityListEl.appendChild(li);
      });

    if (recentActivityListEl.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nessuna attività recente.";
      recentActivityListEl.appendChild(li);
    }

  } catch (err) {
    console.error("❌ Errore caricamento statistiche:", err);
  }
}