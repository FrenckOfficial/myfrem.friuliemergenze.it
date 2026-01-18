// ✅ Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ Riferimenti DOM
const requestsContainer = document.getElementById("contactRequestsTableBody");
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
    };
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
    // ✅ Se staff, carica le richieste di contatto
    loadContactRequests();
});

// 📞 Funzione per caricare richieste di contatto
async function loadContactRequests() {
    try {
        const userSnap = await getDocs(collection(db, "users"));
        const requestsSnap = await getDocs(collection(db, "messages"));
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
        // Aggiungi event listeners ai bottoni
        document.querySelectorAll(".closeRequestBtn").forEach((btn, doc) => {
            btn.addEventListener("click", async (e) => {
                const request = requestsSnap.docs.find(r => r.id === e.target.getAttribute("data-id")).data();
                if (request.status === "Chiusa") {
                    alert("❌ Non puoi chiudere una richiesta già chiusa.");
                }
                const requestId = e.target.getAttribute("data-id");
                await updateRequestStatus(requestId, "Chiusa");
                alert(`La richiesta di assistenza selezionata è stata chiusa.`)
                loadContactRequests();

                await addDoc(collection(db, "activities"), {
                    type: "ticket_close",
                    title: request.title,
                    closedBy: auth.currentUser.email,
                    timestamp: new Date()
                });
            });
        });
        document.querySelectorAll(".reopenRequestBtn").forEach((btn, doc) => {
            btn.addEventListener("click", async (e) => {
                const request = requestsSnap.docs.find(r => r.id === e.target.getAttribute("data-id")).data();
                if (request.status === "Aperta") {
                    alert("❌ Non puoi riaprire una richiesta già aperta.");
                }
                const requestId = e.target.getAttribute("data-id");
                await updateRequestStatus(requestId, "Aperta");
                alert(`La richiesta di assistenza selezionata è stata riaperta`)
                loadContactRequests();
            });
        });
    } catch (error) {
        console.error("Errore nel caricamento delle richieste di contatto:", error);
        alert("❌ Si è verificato un errore nel caricamento delle richieste di contatto.");
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
    alert("❌ Si è verificato un errore durante l'aggiornamento dello status.");
  }
}