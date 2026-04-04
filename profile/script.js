import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("userid");

if (!userId) {
    console.error("ID utente mancante");
    alert("ID utente mancante. Verrai reindirizzato alla pagina di login.");
    window.location.href = "/login";
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        loadUserProfile(userId);
    } else {
        console.error("Utente non autenticato");
        window.location.href = "/login";
    }
});

async function loadUserProfile(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            console.error("Profilo non trovato");
            return;
        }

        const user = snap.data();

        document.getElementById("profileTitle").textContent = `Profilo di ${user.name + " " + user.surname ?? "N/D"} - MyFrEM - La migliore in Friuli-Venezia Giulia nel caricamento foto inerenti l'emergenza`;

        document.getElementById("profileTitleSub").textContent = `Profilo di ${user.name + " " + user.surname ?? "N/D"}`;
        document.getElementById("profileName").textContent = user.name + " " + user.surname ?? "N/D";
        document.getElementById("profileUsername").textContent = user.username ?? "N/D";
        document.getElementById("profileEmail").textContent = user.email ?? "N/D";
        document.getElementById("profileRole").textContent = user.role ?? "N/D";
        document.getElementById("profileStatus").textContent = user.status ?? "N/D";

    } catch (err) {
        console.error("Errore Firestore:", err);
    }
}