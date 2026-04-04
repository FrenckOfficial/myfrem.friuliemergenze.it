// ✅ Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js"
import { parseActivity } from "/staff/dashboard/helpers/activityParsers.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ Riferimenti DOM
const userNameEl = document.getElementById("userName");
const totalUsersEl = document.getElementById("totalUsers");
const pendingPhotosEl = document.getElementById("pendingPhotos");
const approvedPhotosEl = document.getElementById("approvedPhotos");
const rejectedPhotosEl = document.getElementById("rejectedPhotos");
const totalEventsEl = document.getElementById("totalEvents");
const pendingEventsEl = document.getElementById("pendingEvents");
const approvedEventsEl = document.getElementById("approvedEvents");
const rejectedEventsEl = document.getElementById("rejectedEvents");
const organizedEventsEl = document.getElementById("organizedEvents");
const recentActivityListEl = document.getElementById("recentActivityList");
const recentLoginsListEl = document.getElementById("recentLoginsList");
const logoutBtn = document.getElementById("logoutBtn");

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

  const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus"];

  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    alert("❌ Accesso negato: non sei staff!");
    window.location.href = "/dashboard";
    return;
  }

  loadStats();
});

async function loadStats() {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    totalUsersEl.textContent = usersSnap.size;

    const currentUser = auth.currentUser;
    const currentUserDoc = await getDocs(
      query(collection(db, "users"), where("__name__", "==", currentUser.uid))
    );
    const currentUserData = currentUserDoc.docs[0].data();
    userNameEl.textContent = `${currentUserData.name} ${currentUserData.surname}`;

    const pendingSnap = await getDocs(
      query(collection(db, "photos"), where("status", "==", "Foto in attesa di approvazione ⌛"))
    );
    pendingPhotosEl.textContent = pendingSnap.size;

    const approvedSnap = await getDocs(
      query(collection(db, "photos"), where("status", "==", "Approvata ✅"))
    );
    approvedPhotosEl.textContent = approvedSnap.size;

    const rejectedSnap = await getDocs(
      query(collection(db, "photos"), where("status", "==", "Rifiutata ❌"))
    );
    rejectedPhotosEl.textContent = rejectedSnap.size;

    const eventsSnap = await getDocs(collection(db, "events"));
    totalEventsEl.textContent = eventsSnap.size;

    const eventsPendingSnap = await getDocs(
      query(collection(db, "events"), where("status", "==", "In revisione..."))
    );
    pendingEventsEl.textContent = eventsPendingSnap.size;

    const eventsApprovedSnap = await getDocs(
      query(collection(db, "events"), where("status", "==", "Approvato"))
    );
    approvedEventsEl.textContent = eventsApprovedSnap.size;

    const eventsRejectedSnap = await getDocs(
      query(collection(db, "events"), where("status", "==", "Rifiutato"))
    );
    rejectedEventsEl.textContent = eventsRejectedSnap.size;

    const eventsOrganizedSnap = await getDocs(
      query(collection(db, "events"), where("status", "==", "Organizzato"))
    );

    organizedEventsEl.textContent = eventsOrganizedSnap.size;

    const activitiesSnap = await getDocs(collection(db, "activities"));
    recentActivityListEl.innerHTML = "";

    const sortedActivities = activitiesSnap.docs
      .sort((a, b) => b.data().timestamp.toMillis() - a.data().timestamp.toMillis())
      .slice(0, 5);

    for (const docSnap of sortedActivities) {
      const activity = docSnap.data();
      const li = document.createElement("li");
      const date = activity.timestamp.toDate().toLocaleString();

      const text = await parseActivity(activity, date);
      li.innerHTML = text;

      recentActivityListEl.appendChild(li);
    }

    if (recentActivityListEl.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nessuna attività recente.";
      recentActivityListEl.appendChild(li);
    }

    if (recentActivityListEl.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nessuna attività recente.";
      recentActivityListEl.appendChild(li);
    }

    const loginsSnap = await getDocs(collection(db, "logins"));
    recentLoginsListEl.innerHTML = "";

    const sortedLogins = loginsSnap.docs
      .sort((a, b) => b.data().timestamp.toMillis() - a.data().timestamp.toMillis())
      .slice(0, 5);

    for (const docSnap of sortedLogins) {
      const activity = docSnap.data();
      const li = document.createElement("li");
      const date = activity.timestamp.toDate().toLocaleString();
      const email = activity.email;

      li.innerHTML = `Accesso di <a mailto:${email}>${email}</a> in data ${date}`;

      recentLoginsListEl.appendChild(li);
    }

    if (recentLoginsListEl.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nessuna attività recente.";
      recentLoginsListEl.appendChild(li);
    }

    if (recentLoginsListEl.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nessuna attività recente.";
      recentLoginsListEl.appendChild(li);
    }
  } catch (err) {
    console.error("❌ Errore caricamento statistiche:", err);
  }
}