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

import { firebaseConfig } from "../../../configFirebase.js";
import { parseActivity } from "/staff/dashboard/helpers/activityParsers.js";

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

  const allowedRoles = [
    "simplestaff",
    "modstaff",
    "advstaff",
    "advstaffplus",
    "superadmin"
  ];

  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    alert("❌ Accesso negato: non sei staff!");
    return (window.location.href = "/dashboard");
  }

  loadStats();
});

async function loadStats() {
  try {
    const activitiesSnap = await getDocs(collection(db, "activities"));
    recentActivityListEl.innerHTML = "";

    const sorted = activitiesSnap.docs.sort(
      (a, b) => b.data().timestamp.toMillis() - a.data().timestamp.toMillis()
    );

    for (const docSnap of sorted) {
      const activity = docSnap.data();

      const li = document.createElement("li");
      li.style.cursor = "pointer";

      const date = activity.timestamp.toDate().toLocaleString();
      const text = await parseActivity(activity, date);

      li.innerHTML = text;

      li.addEventListener("click", async () => {
        const ok = confirm("Vuoi eliminare questa attività?");
        if (!ok) return;

        try {
          await deleteDoc(doc(db, "activities", docSnap.id));

          li.remove();
          console.log("🗑️ Eliminata activity:", docSnap.id);

        } catch (err) {
          console.error("❌ Errore eliminazione:", err);
        }
      });

      recentActivityListEl.appendChild(li);
    }

    if (recentActivityListEl.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nessuna attività recente.";
      recentActivityListEl.appendChild(li);
    }

  } catch (err) {
    console.error("❌ Errore caricamento statistiche:", err);
  }
}