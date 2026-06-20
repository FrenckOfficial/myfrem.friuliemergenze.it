import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy, where, doc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const requestsContainer = document.getElementById("contactRequestsTableBody");
const logoutBtn = document.getElementById("logoutBtn");
const statusMsg = document.getElementById("statusMsg");

logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login";
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login";
        return;
    };

    const userDoc = await getDocs(
        query(collection(db, "users"), where("__name__", "==", user.uid))
    );

    const userData = userDoc.docs[0].data();

    const allowedRoles = ["modstaff", "advstaff", "advstaffplus", "superadmin"];

    if (!allowedRoles.includes(userData.role)) {
      setStatus("Accesso negato: solo staff autorizzato.", "error");
      window.location.href = "/login/";
      return;
    }

    loadContactRequests();
});

async function loadContactRequests() {
    try {
        const userSnap = await getDocs(collection(db, "users"));
        const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));
        const requestsSnap = await getDocs(q);
        requestsContainer.innerHTML = "";
        requestsSnap.forEach((doc) => {
            const request = doc.data();
            const createdAt = request.createdAt?.toDate().toLocaleString() || "N/A";
            const userData = userSnap.docs.find(u => u.id === request.userId)?.data() || { name: "Utente non autenticato" };
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${userData.name}</td>
                <td><a href="mailto:${request.email}">${request.email}</a></td>
                <td>${request.subject || request.title}</td>
                <td>${request.message || request.description}</td>
                <td>${request.category || "MyFrEM"}</td>
                <td>${request.from || "N/A"}</td>
                <td>${request.status}</td>
                <td>${createdAt}</td>
                <td>
                  <button class="closeRequestBtn" data-id="${doc.id}">Chiudi</button>
                  <button class="reopenRequestBtn" data-id="${doc.id}">Riapri</button>
                </td>
            `;
            requestsContainer.appendChild(row);
        });
        
        document.querySelectorAll(".closeRequestBtn").forEach((btn, doc) => {
            btn.addEventListener("click", async (e) => {
                const request = requestsSnap.docs.find(r => r.id === e.target.getAttribute("data-id")).data();
                if (request.status === "Chiusa") {
                    setStatus("Non puoi chiudere una richiesta già chiusa.", "error");
                }
                const requestId = e.target.getAttribute("data-id");
                await updateRequestStatus(requestId, "Chiusa");
                setStatus(`La richiesta di assistenza selezionata è stata chiusa.`, "success");
                loadContactRequests();

                await addDoc(collection(db, "activities"), {
                    type: "ticket_close",
                    title: request.title,
                    closedBy: auth.currentUser.email,
                    timestamp: serverTimestamp()
                });
            });
        });
        document.querySelectorAll(".reopenRequestBtn").forEach((btn, doc) => {
            btn.addEventListener("click", async (e) => {
                const request = requestsSnap.docs.find(r => r.id === e.target.getAttribute("data-id")).data();
                if (request.status === "Aperta") {
                    setStatus("Non puoi riaprire una richiesta già aperta.", "error");
                }
                const requestId = e.target.getAttribute("data-id");
                await updateRequestStatus(requestId, "Aperta");
                setStatus(`La richiesta di assistenza selezionata è stata riaperta`, "success");
                loadContactRequests();
            });
        });
    } catch (error) {
        console.error("Errore nel caricamento delle richieste di contatto:", error);
        setStatus("Si è verificato un errore nel caricamento delle richieste di contatto.", "error");
    }
};

async function updateRequestStatus(requestId, newStatus) {
  try {
    if (!requestId) throw new Error("ID richiesta non fornito");

    const requestRef = doc(db, "messages", requestId);
    await updateDoc(requestRef, { status: newStatus });

    console.log(`✅ Richiesta ${requestId} aggiornata a "${newStatus}"`);
  } catch (error) {
    console.error("Errore nell'aggiornamento dello status:", error);
    setStatus("Si è verificato un errore durante l'aggiornamento dello status.", "error");
  }
}

function setStatus(message, type = "info") {
  statusMsg.textContent = message;
  statusMsg.className = `${"statusBox" + " " + type}`;
  statusMsg.style.display = "block";
}