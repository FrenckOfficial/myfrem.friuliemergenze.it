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

logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login";
});

onAuthStateChanged(auth, async (user) => {
    console.log("Auth state:", user);

    if (!user) {
        window.location.href = "/login";
        return;
    }

    console.log("User logged:", user.uid);

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        console.warn("User doc not found in Firestore");
        window.location.href = "/login";
        return;
    }

    const userData = userSnap.data();
    const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

    console.log("User role:", userData.role);

    if (!allowedRoles.includes(userData.role)) {
        console.warn("Unauthorized role:", userData.role);
        window.location.href = "/login";
        return;
    }

    loadSurveys();
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