import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const surveyForm = document.getElementById("surveyForm");
const surveyTitle = document.getElementById("surveyTitle");
const surveyDescription = document.getElementById("surveyDescription");
const compilabileFino = document.getElementById("compilabileFino");
const surveyLink = document.getElementById("surveyLink");
const linkValidation = document.getElementById("linkValidation");
const statusBox = document.querySelector(".statusBox");
const statusMsg = document.getElementById("statusMsg");
const closeSMsg = document.getElementById("closeSMsg");
const logoutBtn = document.getElementById("logoutBtn");

// Validazione link in tempo reale
surveyLink.addEventListener("change", validateLink);

function validateLink() {
    const url = surveyLink.value.trim();
    linkValidation.style.display = "block";

    if (!url) {
        linkValidation.style.display = "none";
        return;
    }

    const allowedDomains = ["friuliemergenze.it", "www.friuliemergenze.it"];
    const isValid = allowedDomains.some(domain => url.startsWith(`https://${domain}`) || url.startsWith(`http://${domain}`));

    if (isValid) {
        linkValidation.innerHTML = "✅ Link valido";
        linkValidation.style.color = "var(--success, #4caf50)";
    } else {
        linkValidation.innerHTML = `❌ Il link deve iniziare con friuliemergenze.it o www.friuliemergenze.it`;
        linkValidation.style.color = "var(--error, #f44336)";
    }
}

function showStatus(message, type = "info") {
    statusMsg.textContent = message;
    statusBox.style.display = "block";
    statusBox.style.borderLeft = `4px solid var(--${type}, #2196f3)`;
    
    if (type === "error") {
        statusBox.style.borderLeft = "4px solid #f44336";
    } else if (type === "success") {
        statusBox.style.borderLeft = "4px solid #4caf50";
    }

    if (type === "success") {
        setTimeout(() => {
            statusBox.style.display = "none";
            surveyForm.reset();
            linkValidation.style.display = "none";
        }, 2000);
    }
}

closeSMsg.addEventListener("click", () => {
    statusBox.style.display = "none";
});

onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = "/login/";
        return;
    }
});

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "/login/";
    } catch (err) {
        console.error("Logout error:", err);
    }
});

surveyForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = surveyTitle.value.trim();
    const description = surveyDescription.value.trim();
    const dueDateStr = compilabileFino.value;
    const link = surveyLink.value.trim();

    if (!title || !description || !dueDateStr || !link) {
        showStatus("❌ Compila tutti i campi obbligatori", "error");
        return;
    }

    const allowedDomains = ["friuliemergenze.it", "www.friuliemergenze.it"];
    const isValidLink = allowedDomains.some(domain => 
        link.startsWith(`https://${domain}`) || link.startsWith(`http://${domain}`)
    );

    if (!isValidLink) {
        showStatus("❌ Il link non è valido. Deve iniziare con friuliemergenze.it o www.friuliemergenze.it", "error");
        return;
    }

    try {
        const dueDate = new Date(dueDateStr);
        const timestamp = Timestamp.fromDate(new Date());

        const docRef = await addDoc(collection(db, "surveys"), {
            title,
            description,
            compilabileFino: dueDate,
            link,
            timestamp,
            createdBy: auth.currentUser.uid,
            status: "active"
        });

        showStatus(`✅ Sondaggio creato con ID: ${docRef.id}`, "success");

    } catch (err) {
        console.error("Errore creazione sondaggio:", err);
        showStatus(`❌ Errore: ${err.message}`, "error");
    }
});