import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const surveysTableBody = document.getElementById("surveysTableBody");
const totalSurveysCount = document.getElementById("totalSurveysCount");
const statusBox = document.querySelector(".statusBox");
const statusMsg = document.getElementById("statusMsg");
const closeSMsg = document.getElementById("closeSMsg");
const logoutBtn = document.getElementById("logoutBtn");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

let surveysData = [];

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
        }, 3000);
    }
}

closeSMsg.addEventListener("click", () => {
    statusBox.style.display = "none";
});

function formatDate(date) {
    if (!date) return "N/A";
    if (date.toDate) {
        return date.toDate().toLocaleDateString("it-IT");
    }
    return new Date(date).toLocaleDateString("it-IT");
}

function getSurveyStatus(compilabileFino) {
    if (!compilabileFino) return "N/A";
    
    const dueDate = compilabileFino.toDate ? compilabileFino.toDate() : new Date(compilabileFino);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
        return "Scaduto";
    }
    return "Attivo";
}

async function loadSurveys() {
    try {
        const snapshot = await getDocs(collection(db, "surveys"));
        surveysData = [];

        if (snapshot.empty) {
            surveysTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem;">
                        Nessun sondaggio trovato. <a href="/staff/dashboard/management/surveys/new/">Crea il primo</a>
                    </td>
                </tr>
            `;
            totalSurveysCount.textContent = "0";
            return;
        }

        const fragment = document.createDocumentFragment();

        snapshot.forEach(doc => {
            const survey = doc.data();
            surveysData.push({ id: doc.id, ...survey });

            const compilabileFino = formatDate(survey.compilabileFino);
            const status = getSurveyStatus(survey.compilabileFino);
            const title = survey.title || "N/A";
            const description = (survey.description || "").substring(0, 50) + (survey.description?.length > 50 ? "..." : "");
            const link = survey.link || "N/A";

            const row = document.createElement("tr");
            
            // Titolo
            const titleTd = document.createElement("td");
            titleTd.textContent = title;
            row.appendChild(titleTd);

            // Descrizione
            const descTd = document.createElement("td");
            descTd.textContent = description;
            row.appendChild(descTd);

            // Compilabile fino
            const dateTd = document.createElement("td");
            dateTd.textContent = compilabileFino;
            row.appendChild(dateTd);

            // Link
            const linkTd = document.createElement("td");
            const linkEl = document.createElement("a");
            linkEl.href = link;
            linkEl.textContent = link;
            linkEl.target = "_blank";
            linkEl.rel = "noopener noreferrer";
            linkEl.style.color = "var(--accent, #ff7b00)";
            linkTd.appendChild(linkEl);
            row.appendChild(linkTd);

            // Stato
            const statusTd = document.createElement("td");
            statusTd.textContent = status;
            statusTd.style.fontWeight = "bold";
            statusTd.style.color = status === "Attivo" ? "#4caf50" : "#f44336";
            row.appendChild(statusTd);

            // Azioni
            const actionsTd = document.createElement("td");
            actionsTd.style.textAlign = "center";
            
            const editBtn = document.createElement("button");
            editBtn.textContent = "✏️ Modifica";
            editBtn.style.marginRight = "0.5rem";
            editBtn.style.padding = "0.5rem 1rem";
            editBtn.style.cursor = "pointer";
            editBtn.className = "action-btn";
            editBtn.addEventListener("click", () => {
                window.location.href = `/staff/dashboard/surveys/edit/?id=${doc.id}`;
            });

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "🗑️ Elimina";
            deleteBtn.style.padding = "0.5rem 1rem";
            deleteBtn.style.cursor = "pointer";
            deleteBtn.className = "action-btn delete-btn";
            deleteBtn.addEventListener("click", async () => {
                if (confirm(`Sei sicuro di voler eliminare il sondaggio "${title}"?`)) {
                    try {
                        await deleteDoc(doc(db, "surveys", doc.id));
                        showStatus("✅ Sondaggio eliminato", "success");
                        await loadSurveys();
                    } catch (err) {
                        console.error("Errore eliminazione:", err);
                        showStatus(`❌ Errore: ${err.message}`, "error");
                    }
                }
            });

            actionsTd.appendChild(editBtn);
            actionsTd.appendChild(deleteBtn);
            row.appendChild(actionsTd);

            fragment.appendChild(row);
        });

        surveysTableBody.innerHTML = "";
        surveysTableBody.appendChild(fragment);
        totalSurveysCount.textContent = snapshot.size;

    } catch (err) {
        console.error("❌ Errore caricamento sondaggi:", err);
        surveysTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #f44336; padding: 2rem;">
                    Errore nel caricamento dei sondaggi
                </td>
            </tr>
        `;
        showStatus(`❌ Errore: ${err.message}`, "error");
    }
}

onAuthStateChanged(auth, async user => {
    if (!user) {
        loadingEl.style.display = "none";
        window.location.href = "/login/";
        return;
    }

    const timeoutId = setTimeout(() => {
        loadingEl.style.display = "none";
        contentEl.style.display = "block";
    }, 5000);

    try {
        await loadSurveys();
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

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "/login/";
    } catch (err) {
        console.error("Logout error:", err);
    }
});