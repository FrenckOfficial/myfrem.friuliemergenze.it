import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, updateDoc, addDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.getElementById("logoutBtn").onclick = () => signOut(auth);

const eventsList = document.getElementById("eventsList");
const statusMsg = document.getElementById("statusMsg");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  try {
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      eventsList.innerHTML = "<p class='info'>Non ci sono richieste di eventi al momento.</p>";
      return;
    }

    eventsList.innerHTML = "";

    snap.forEach(docSnap => {
      const e = docSnap.data();
      const div = document.createElement("div");
      div.className = "event-card";

      div.innerHTML = `
        <h3>${e.title}</h3>
        <p><strong>📍 Luogo:</strong> ${e.location}</p>
        <p>${e.description.length > 150 ? e.description.slice(0,150)+"..." : e.description}</p>
        <span class="status ${e.status === "In revisione..." ? "revision" :
                             e.status === "Approvato" ? "approved" :
                             e.status === "Organizzato" ? "organized" : "rejected"}">
          ${e.status}
        </span>
        <div class="actions">
          <button class="btn-action btn-organized">Contrassegna come Organizzato</button>
          <button class="btn-action btn-approve">Approva</button>
          <button class="btn-action btn-reject">Rifiuta</button>
          <button class="btn-action btn-view" onclick="window.open('/events/detail/?id=${docSnap.id}', '_blank')">Visualizza Evento</button>
          <button class="btn-action btn-view1">Non mostrare in dashboard</button>
        </div>
      `;

      if (e.status === "Organizzato") {
        div.querySelector(".btn-organized").disabled = true;
        div.querySelector(".btn-approve").disabled = true;
        div.querySelector(".btn-reject").disabled = true;
        div.querySelector(".btn-view1").disabled = false;
      }

      if (e.status === "Approvato") {
        div.querySelector(".btn-approve").disabled = true;
        div.querySelector(".btn-reject").disabled = true;
        div.querySelector(".btn-organized").disabled = false;
      }

      if (e.status === "Rifiutato") {
        div.querySelector(".btn-approve").disabled = true;
        div.querySelector(".btn-reject").disabled = true;
        div.querySelector(".btn-organized").disabled = true;
      }
      
        div.querySelector(".btn-organized").onclick = async () => {
          const userRef = doc(db, "events", docSnap.id);
          window.location.href = `/staff/dashboard/events/completeorganization/?event_id=${docSnap.id}`
          await addDoc(collection(db, "activities"), {
            organizationStaffer: auth.currentUser.email || "-",
            eventTitle: e.title,
            timestamp: new Date(),
            type: "event_organized",
          });
          await updateDoc(userRef, { status: "Organizzato" });
          div.querySelector(".status").textContent = "Organizzato";
          div.querySelector(".status").className = "status organized";
        };

        div.querySelector(".btn-approve").onclick = async () => {
          await addDoc(collection(db, "activities"), {
            approvalStaffer: auth.currentUser.email || "-",
            eventTitle: e.title,
            timestamp: new Date(),
            type: "event_approval",
          });
          div.querySelector(".status").textContent = "Approvato";
          div.querySelector(".status").className = "status approved";
        };

        div.querySelector(".btn-reject").onclick = async () => {
          await addDoc(collection(db, "activities"), {
            rejectionStaffer: auth.currentUser.email || "-",
            eventTitle: e.title,
            timestamp: new Date(),
            type: "event_rejection",
          });
          const userRef = doc(db, "events", docSnap.id);
          await updateDoc(userRef, { status: "Rifiutato" });
          div.querySelector(".status").textContent = "Rifiutato";
          div.querySelector(".status").className = "status rejected";
        };
        div.querySelector(".btn-view1").onclick = async () => {
          const userRef = doc(db, "events", docSnap.id);
          await updateDoc(userRef, { showInDash: false });
          div.style.display = "none";
        }

        eventsList.appendChild(div);
      });
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "❌ Errore nel caricamento degli eventi.";
  }
});