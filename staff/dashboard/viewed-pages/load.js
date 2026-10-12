import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "https://myfrem.friuliemergenze.it/helpers/configFirebase.js";
import { parseViewedPage } from "/staff/dashboard/helpers/parseViewedPage.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const recentActivityListEl = document.getElementById("activitiesList");
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "/login";

  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  initBottomNav(userDoc.docs[0].data(), user, "staff");

  const allowedRoles = [
    "simplestaff",
    "modstaff",
    "advstaff",
    "advstaffplus",
    "superadmin"
  ];

  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    setStatus("Accesso negato: non sei staff!", "error");
    return (window.location.href = "/dashboard");
  }

  loadStats();
});

async function loadStats() {
  try {
    const activitiesSnap = await getDocs(collection(db, "viewedPages"));
    recentActivityListEl.innerHTML = "";

    if (activitiesSnap.empty) {
      const li = document.createElement("li");
      li.textContent = "Nessuna pagina visualizzata di recente.";
      recentActivityListEl.appendChild(li);
      return;
    }

    const sorted = activitiesSnap.docs.sort(
      (a, b) => b.data().timestamp.toMillis() - a.data().timestamp.toMillis()
    );

    const pStatusMsg = document.createElement("p");
    pStatusMsg.id = "statusMsg";
    pStatusMsg.className = "statusBox info";
    pStatusMsg.style.display = "none";
    recentActivityListEl.appendChild(pStatusMsg);

    for (const docSnap of sorted) {
      const activity = docSnap.data();

      const li = document.createElement("li");

      const date = activity.timestamp.toDate().toLocaleString();
      const text = await parseViewedPage(activity, date);

      li.innerHTML = text;

      recentActivityListEl.appendChild(li);
    }

    if (recentActivityListEl.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nessuna attività recente.";
      recentActivityListEl.appendChild(li);
    }

  } catch (err) {
    console.error("Errore caricamento statistiche:", err);
  }
}