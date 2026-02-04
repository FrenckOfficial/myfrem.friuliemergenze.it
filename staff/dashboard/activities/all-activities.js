import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ Riferimenti DOM
const userNameEl = document.getElementById("userName");
const recentActivityListEl = document.getElementById("activitiesList");
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

async function loadStats() {
    try {
        // 🔹 Ultime attività generali
        const activitiesSnap = await getDocs(collection(db, "activities"));
        recentActivityListEl.innerHTML = "";
        activitiesSnap.docs
          .sort((a, b) => b.data().timestamp.toMillis() - a.data().timestamp.toMillis())
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
          li.textContent = `[${date}] L'account dell'utente "${activity.userName}" è stato contrassegnato come eliminato.`;
        } else if (activity.type === "user_creation") {
          li.textContent = `[${date}] Nuovo utente registrato: "${activity.userName}"`;
        } else if (activity.type === "kick_add") {
          li.textContent = `[${date}] Nuovo report di espulsione aggiunto da "${activity.addStaffer}": "${activity.kickedMember}"`;
        } else if (activity.type === "eventRegistration") {
          li.textContent = `[${date}] ${activity.nameJoiner} si è iscritto all'evento "${activity.eventTitle}" (ID: ${activity.eventId}).`;
        } else if (activity.type === "new_ticket") {
          li.innerHTML = `[${date}] Da <b>${activity.from}</b>: Nuovo ticket creato con oggetto "${activity.title}".`;
        } else if (activity.type === "ticket_close") {
          li.textContent = `[${date}] Ticket "${activity.title}" chiuso da ${activity.closedBy}.`;
        } else if (activity.type === "user_deletion_whatsapp") {
          li.textContent = `[${date}] L'utente "${activity.userName}" è stato eliminato dal gruppo WhatsApp.`;
        } else if (activity.type === "user_creation_whatsapp") {
          li.textContent = `[${date}] Nuovo utente WhatsApp registrato: "${activity.userName}"`;
        } else if (activity.type === "user_role_change_whatsapp") {
          li.innerHTML = `[${date}] L'utente WhatsApp "${activity.userName}" ha cambiato ruolo in <b>AMMINISTRATORE DEL GRUPPO</b>`;
        } else if (activity.type === "user_deletion_whatsapp") {
          li.textContent = `[${date}] L'utente WhatsApp "${activity.userName}" è stato segnalato come espulso.`;
        } else if (activity.type === "user_edit_whatsapp") {
          li.textContent = `[${date}] L'anagrafica WhatsApp di "${activity.userName}" è stato modificato dallo staff.`;
        } else if (activity.type === "user_permanent_deletion_whatsapp") {
          li.textContent = `[${date}] L'utente WhatsApp "${activity.userName}" è stato eliminato definitivamente dal database.`;
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
