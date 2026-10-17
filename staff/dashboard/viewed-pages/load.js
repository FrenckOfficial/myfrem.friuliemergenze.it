import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "https://myfrem.friuliemergenze.it/helpers/configFirebase.js";
import { parseViewedPage } from "/staff/dashboard/helpers/parseViewedPage.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { createPager } from "/staff/dashboard/helpers/pager.js";

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

const pager = createPager({
  ref: collection(db, "viewedPages"),
  list: recentActivityListEl,
  emptyText: "Nessuna pagina visualizzata di recente.",
  moreLabel: "Carica altre visite",
  renderItem: async (docSnap) => {
    const activity = docSnap.data();
    const li = document.createElement("li");
    const date = activity.timestamp?.toDate?.().toLocaleString("it-IT") || "data sconosciuta";
    li.innerHTML = await parseViewedPage(activity, date);
    return li;
  }
});

async function loadStats() {
  try {
    await pager.load(true);
  } catch (err) {
    console.error("Errore caricamento statistiche:", err);
  }
}
