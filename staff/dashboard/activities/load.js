import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "https://myfrem.friuliemergenze.it/helpers/configFirebase.js";
import { parseActivity } from "/staff/dashboard/helpers/activityParsers.js";
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
  ref: collection(db, "activities"),
  list: recentActivityListEl,
  emptyText: "Nessuna attività recente.",
  moreLabel: "Carica altre attività",
  renderItem: async (docSnap) => {
    const activity = docSnap.data();
    const li = document.createElement("li");
    li.style.cursor = "pointer";

    const date = activity.timestamp?.toDate?.().toLocaleString("it-IT") || "data sconosciuta";
    li.innerHTML = await parseActivity(activity, date);

    li.addEventListener("click", async () => {
      if (!confirm("Vuoi eliminare questa attività?")) return;
      try {
        await deleteDoc(doc(db, "activities", docSnap.id));
        li.remove();
        setStatus("Attività eliminata!", "success");
      } catch (err) {
        console.error("Errore eliminazione:", err);
      }
    });

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
