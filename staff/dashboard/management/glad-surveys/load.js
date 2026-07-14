import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    where, 
    doc, 
    getDoc,
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const surveyList = document.getElementById("surveyTableBody");
const logoutBtn = document.getElementById("logoutBtn");
const statusMsg = document.getElementById("statusMsg");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  const allowedRoles = ["advstaffplus", "superadmin"];

  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    setStatus("Accesso negato: non sei staff!", "error");
    window.location.href = "/dashboard";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("⏱️ Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  await loadSurveys();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

async function loadSurveys() {
    try {
        console.log("Loading surveys...");

        const surveysQuery = query(
            collection(db, "sondaggi_gradimento"),
            orderBy("timestamp", "desc")
        );

        const surveysSnap = await getDocs(surveysQuery);

        surveyList.innerHTML = "";

        surveysSnap.forEach((docSnap) => {
            const surveyId = docSnap.id;
            const survey = docSnap.data();

            const createdAt = survey.timestamp
                ? survey.timestamp.toDate().toLocaleString()
                : "N/A";

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${surveyId}</td>
                <td>${survey.nome}</td>
                <td><a href="mailto:${survey.email}">${survey.email}</a></td>
                <td>${survey.valutazione}</td>
                <td>${survey.commento || "No comment was provided"}</td>
                <td>${createdAt}</td>
            `;

            surveyList.appendChild(row);
        });

        console.log("Surveys loaded.");
    } catch (error) {
        console.error("Error loading surveys:", error);
    }
}

function setStatus(message, type = "info") {
    statusMsg.textContent = message;
    statusMsg.className = `${"statusBox" + " " + type}`;
    statusMsg.style.display = "block";
    const closeBtn = document.getElementById("closeSMsg");
    closeBtn.onclick = () => {
        statusMsg.style.display = "none";
    }
}