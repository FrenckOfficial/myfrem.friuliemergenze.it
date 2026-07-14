import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const editForm = document.querySelector(".editForm");
const surveyTitle = document.getElementById("surveyTitle");
const surveyDescription = document.getElementById("surveyDescription");
const compilabileFino = document.getElementById("compilabileFino");
const surveyLink = document.getElementById("surveyLink");
const linkValidation = document.getElementById("linkValidation");
const status = document.getElementById("status");
const statusBox = document.querySelector(".statusBox");
const statusMsg = document.getElementById("statusMsg");
const closeSMsg = document.getElementById("closeSMsg");
const logoutBtn = document.getElementById("logoutBtn");
const backBtn = document.getElementById("backBtn");
const surveyDetails = document.getElementById("surveyDetails");

let surveyId = null;

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function validateLink() {
    const url = surveyLink.value.trim();
    linkValidation.style.display = "block";

    if (!url) {
        linkValidation.style.display = "none";
        return true;
    }

    const allowedDomains = ["friuliemergenze.it", "www.friuliemergenze.it"];
    const isValid = allowedDomains.some(domain => 
        url.startsWith(`https://${domain}`) || url.startsWith(`http://${domain}`)
    );

    if (isValid) {
        linkValidation.innerHTML = "✅ Link valido";
        linkValidation.style.color = "var(--success, #4caf50)";
        return true;
    } else {
        linkValidation.innerHTML = `❌ Il link deve iniziare con friuliemergenze.it o www.friuliemergenze.it`;
        linkValidation.style.color = "var(--error, #f44336)";
        return false;
    }
}

surveyLink.addEventListener("change", validateLink);

function showStatus(message, type = "info") {
    statusMsg.textContent = message;
    statusBox.style.display = "block";
    
    if (type === "error") {
        statusBox.style.borderLeft = "4px solid #f44336";
    } else if (type === "success") {
        statusBox.style.borderLeft = "4px solid #4caf50";
    } else {
        statusBox.style.borderLeft = "4px solid #2196f3";
    }

    if (type === "success") {
        setTimeout(() => {
            statusBox.style.display = "none";
        }, 2000);
    }
}

closeSMsg.addEventListener("click", () => {
    statusBox.style.display = "none";
});

backBtn.addEventListener("click", () => {
    window.location.href = "/staff/dashboard/surveys/";
});

onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "/login/";
        return;
    }

    surveyId = getQueryParam("id");
    if (!surveyId) {
        showStatus("❌ ID sondaggio mancante", "error");
        return;
    }

    try {
        const docRef = doc(db, "surveys", surveyId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            showStatus("❌ Sondaggio non trovato", "error");
            return;
        }

        const survey = docSnap.data();

        surveyTitle.value = survey.title || "";
        surveyDescription.value = survey.description || "";
        status.value = survey.status || "active";

        if (survey.compilabileFino) {
            const date = survey.compilabileFino.toDate ? survey.compilabileFino.toDate() : new Date(survey.compilabileFino);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            compilabileFino.value = `${year}-${month}-${day}`;
        }

        surveyLink.value = survey.link || "";

        surveyDetails.innerHTML = `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                <p><strong>ID:</strong> <code style="background: #e0e0e0; padding: 0.25rem 0.5rem; border-radius: 4px;">${surveyId}</code></p>
                <p><strong>Creato:</strong> ${survey.timestamp ? survey.timestamp.toDate().toLocaleString("it-IT") : "N/A"}</p>
                <p><strong>Creato da:</strong> ${survey.createdBy || "N/A"}</p>
            </div>
        `;

    } catch (err) {
        console.error("Errore caricamento sondaggio:", err);
        showStatus(`❌ Errore: ${err.message}`, "error");
    }
});

editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!surveyId) {
        showStatus("❌ ID sondaggio mancante", "error");
        return;
    }

    const title = surveyTitle.value.trim();
    const description = surveyDescription.value.trim();
    const dueDateStr = compilabileFino.value;
    const link = surveyLink.value.trim();
    const surveyStatus = status.value;

    if (!title || !description || !dueDateStr || !link) {
        showStatus("❌ Compila tutti i campi obbligatori", "error");
        return;
    }

    if (!validateLink()) {
        showStatus("❌ Link non valido", "error");
        return;
    }

    try {
        const dueDate = new Date(dueDateStr);

        await updateDoc(doc(db, "surveys", surveyId), {
            title,
            description,
            compilabileFino: dueDate,
            link,
            status: surveyStatus
        });

        showStatus("✅ Sondaggio aggiornato con successo", "success");
        setTimeout(() => {
            window.location.href = "/staff/dashboard/surveys/";
        }, 1500);

    } catch (err) {
        console.error("Errore aggiornamento sondaggio:", err);
        showStatus(`❌ Errore: ${err.message}`, "error");
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