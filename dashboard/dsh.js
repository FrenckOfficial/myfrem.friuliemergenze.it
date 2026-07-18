import { firebaseConfig } from "../configFirebase.js";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

console.log("👉 Inizializzo Firebase...");

const userNameEl = document.getElementById("userName");
const totalPhotosEl = document.getElementById("totalPhotos");
const approvedPhotosEl = document.getElementById("approvedPhotos");
const pendingPhotosEl = document.getElementById("pendingPhotos");
const rejectedPhotosEl = document.getElementById("rejectedPhotos");
const eventsListEl = document.getElementById("eventsList");
const activityListEl = document.getElementById("activityList");
const totalEventsEl = document.getElementById("totalEvents");
const approvedEventsEl = document.getElementById("approvedEvents");
const pendingEventsEl = document.getElementById("pendingEvents");
const rejectedEventsEl = document.getElementById("rejectedEvents");
const organizedEventsEl = document.getElementById("organizedEvents");
const newsBannerEl = document.getElementById("newsBanner");
const newsletterBtn = document.getElementById("newsletterBtn");
const statusMsg = document.getElementById("statusMsg");
const logoutBtn = document.getElementById("logoutBtn");
const btnText = document.getElementById("btnText");
const btnLoader = document.getElementById("btnLoader");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

auth.onAuthStateChanged(async (user) => {
  emailjs.init("49-8564mCPRVWNmBW");
  console.log("👀 onAuthStateChanged triggered, user:", user);

  if (!user) {
    console.warn("⚠️ Nessun utente loggato, redirect al login...");
    loadingEl.style.display = "none";
    window.location.href = "/login/";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("⏱️ Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 5000);

  try {
    const userDoc = await db.collection("users").doc(user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    const staffRoles = [
      "simplestaff",
      "modstaff",
      "advstaff",
      "advstaffplus",
      "superadmin",
    ];
    const allowedRoles = ["testacc", "user"];

    if (
      !staffRoles.includes(userData.role) &&
      !allowedRoles.includes(userData.role)
    ) {
      setStatus("Accesso negato: ruolo non riconosciuto.", "error");
      clearTimeout(timeoutId);
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
      window.location.href = "/login/";
      return;
    }

    const isReadOnlyMode = userData.role === "testacc";

    if (isReadOnlyMode) {
      console.log("📖 Modalità sola lettura attivata per testacc");
      document.body.classList.add("read-only-mode");
    }

    if (userData) {
      userNameEl.textContent = `${userData.name} (${userData.username})`;
    } else {
      userNameEl.textContent = "Utente";
    }

    if (userData.newsSubbed === false) {
      newsBannerEl.style.display = "block";
    } else {
      newsBannerEl.style.display = "none";
    }

    const photosSnap = await db
      .collection("photos")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    let total = 0,
      approved = 0,
      pending = 0,
      rejected = 0;
    activityListEl.innerHTML = "";

    photosSnap.forEach((doc) => {
      const photo = doc.data();
      total++;

      if (photo.status === "Approvata ✅") approved++;
      if (photo.status === "Foto in attesa di approvazione ⌛") pending++;
      if (photo.status === "Rifiutata ❌") rejected++;

      const li = document.createElement("li");
      li.innerHTML = `
        <p>📸 Foto caricata il ${
          photo.createdAt?.toDate().toLocaleString() || "data sconosciuta"
        } - Stato: <b>${photo.status}</b></p>
      `;
      activityListEl.appendChild(li);
    });

    totalPhotosEl.textContent = total;
    approvedPhotosEl.textContent = approved;
    pendingPhotosEl.textContent = pending;
    rejectedPhotosEl.textContent = rejected;

    if (total === 0) {
      activityListEl.innerHTML = "<li>Nessuna attività recente.</li>";
    }

    const eventsSnap = await db
      .collection("events")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    eventsSnap.forEach((doc) => {
      const event = doc.data();
      if (event.status === "Organizzato" && event.showInDash === true) {
        let eventHTML = `
          <div class="event-card">
            <h3>${event.title}</h3>
            <p>Data e ora: ${event.date || "Data e/o ora sconosciute"}  ${event.time || ""}</p>
            <p>Luogo: ${event.location || "Luogo sconosciuto"}</p>
        `;

        if (isReadOnlyMode) {
          eventHTML += `<button class="btn" disabled title="Modalità sola lettura">Iscriviti (Non disponibile)</button>`;
        } else {
          eventHTML += `<a href="/events/join/?event=${doc.id}" class="btn" target="_blank">Iscriviti</a>`;
        }

        eventHTML += `</div>`;
        eventsListEl.innerHTML += eventHTML;
      }
    });

    const eventsUserSnap = await db
      .collection("events")
      .where("userId", "==", userData.name + " " + userData.surname)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    let totalE = 0,
      approvedE = 0,
      pendingE = 0,
      rejectedE = 0,
      organizedE = 0;

    eventsUserSnap.forEach((doc) => {
      const event = doc.data();
      totalE++;

      if (event.status === "Approvato") approvedE++;
      if (event.status === "In revisione...") pendingE++;
      if (event.status === "Rifiutato") rejectedE++;
      if (event.status === "Organizzato") organizedE++;
    });

    totalEventsEl.textContent = totalE;
    approvedEventsEl.textContent = approvedE;
    pendingEventsEl.textContent = pendingE;
    rejectedEventsEl.textContent = rejectedE;
    organizedEventsEl.textContent = organizedE;

    const name = userData.name;

    if (isReadOnlyMode) {
      newsletterBtn.disabled = true;
      newsletterBtn.title = "Non disponibile in modalità sola lettura";
      newsletterBtn.style.opacity = "0.5";
      newsletterBtn.style.cursor = "not-allowed";
      return;
    } else {
      newsletterBtn.addEventListener("click", async () => {
        newsletterBtn.disabled = true;
        btnText.textContent = "Iscrizione in corso...";
        btnLoader.style.display = 'inline-block';
        
        try {
          const userRef = db.collection("users").doc(user.uid);
          const userDoc = await userRef.get();
          const userData = userDoc.data();

          await userRef.update({ newsSubbed: true });

          const existingQuery = await db.collection("newsletterSubs")
            .where("email", "==", userData.email)
            .get();

          if (existingQuery.empty) {
            const token = crypto.randomUUID();
            await db.collection("newsletterSubs").add({
              email: userData.email,
              name: userData.name,
              verified: false,
              subscribed: false,
              verifiedAt: null,
              token: token,
              createdAt: new Date(),
            });

            await emailjs.send("service_ngxrsq8", "template_32nd0dv", {
              email: userData.email,
              name: userData.name,
              link: `https://www.friuliemergenze.it/newsletter/confirm/?token=${token}`,
            });

            setStatus("E-mail di conferma inviata!", "success");
          } else {
            setStatus("Email già iscritta.", "warning");
          }
        } catch (error) {
          console.error("Errore:", error);
          setStatus("Errore nel salvataggio.", "error");
        } finally {
          newsletterBtn.disabled = false;
          btnText.textContent = "Iscriviti";
          btnLoader.style.display = 'none';
          window.location.reload();
        }
      });
    }

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  } catch (err) {
    console.error("❌ Errore durante il caricamento:", err);
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }
});

function setStatus(message, type = "info") {
  const classNameBox = document.querySelector(".statusBox");
  statusMsg.textContent = message;
  classNameBox.className = `${"statusBox" + " " + type}`;
  classNameBox.style.display = "block";
  const closeBtn = document.getElementById("closeSMsg");
  closeBtn.onclick = () => {
    classNameBox.style.display = "none";
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  console.log("🚪 Logout in corso...");
  await auth.signOut();
  console.log("✅ Logout completato, redirect...");
  window.location.href = "/login/";
});
