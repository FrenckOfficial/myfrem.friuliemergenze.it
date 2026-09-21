import { firebaseConfig } from "../configFirebase.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "../helpers/modals.js";
import "/helpers/loadIcons.js";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

console.log("Inizializzo Firebase...");

let currentUser = null;
let currentUserId = null;
let allPhotos = [];

const userNameEl = document.getElementById("userName");
const totalPhotosEl = document.getElementById("totalPhotos");
const approvedPhotosEl = document.getElementById("approvedPhotos");
const pendingPhotosEl = document.getElementById("pendingPhotos");
const rejectedPhotosEl = document.getElementById("rejectedPhotos");
const activityListEl = document.getElementById("activityList");
const newsBannerEl = document.getElementById("newsBanner");
const newsletterBtn = document.getElementById("newsletterBtn");
const logoutBtn = document.getElementById("logoutBtn");
const btnText = document.getElementById("btnText");
const btnLoader = document.getElementById("btnLoader");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");
const enableNotificationsBtn = document.getElementById("enable-notifications-btn");
const notificationStatus = document.getElementById("notification-status");
const notificationStatusIcon = document.getElementById("notification-status-icon");
const notificationStatusText = document.getElementById("notification-status-text");
const notificationStatusDesc = document.getElementById("notification-status-desc");
const goToSurveyBtn = document.getElementById("goToSurveyBtn");

const statsModal = document.getElementById("statsModal");
const statsModalTitle = document.getElementById("statsModalTitle");
const statsModalList = document.getElementById("statsModalList");
const closeStatsModal = document.getElementById("closeStatsModal");
const closeStatsModalBtn = document.getElementById("closeStatsModalBtn");
const statsOverlay = statsModal ? statsModal.querySelector(".modal-overlay") : null;

const filterLabels = {
  all: "Tutte le foto caricate",
  approved: "Foto approvate",
  pending: "Foto in attesa",
  rejected: "Foto rifiutate",
};

function matchesFilter(photo, filter) {
  if (filter === "all") return true;
  if (filter === "approved") return photo.status === "Approvata ✅" || photo.status === "Approvata";
  if (filter === "pending") return photo.status === "Foto in attesa di approvazione" || photo.status === "Foto in attesa di approvazione ⌛";
  if (filter === "rejected") return photo.status === "Rifiutata ❌" || photo.status === "Rifiutata";
  return false;
}

function getReadableStatus(photo) {
  if (photo.status === "Approvata ✅" || photo.status === "Approvata") {
    return "Approvata";
  } else if (photo.status === "Foto in attesa di approvazione" || photo.status === "Foto in attesa di approvazione ⌛") {
    return "In attesa";
  } else if (photo.status === "Rifiutata ❌" || photo.status === "Rifiutata") {
    return "Rifiutata";
  }
  return photo.status || "Sconosciuto";
}

function openStatsModal(filter) {
  const filtered = allPhotos.filter((photo) => matchesFilter(photo, filter));

  statsModalTitle.textContent = filterLabels[filter] || "Foto";
  statsModalList.innerHTML = "";

  if (filtered.length === 0) {
    statsModalList.innerHTML = "<li>Nessuna foto in questa categoria.</li>";
  } else {
    filtered.forEach((photo) => {
      const status = getReadableStatus(photo);

      const li = document.createElement("li");
      li.innerHTML = `
        <p><b>${photo.vehicleModel || "Foto"}</b><br>
        Caricata il <em>${photo.createdAt?.toDate().toLocaleString() || "data sconosciuta"}</em><br>
        Revisionata il <em>${photo.reviewedAt?.toDate().toLocaleString() || "non ancora revisionata"}</em><br>
        Stato: <em>${status}</em></p>
      `;
      statsModalList.appendChild(li);
    });
  }

  statsModal.classList.add("active");
}

function closeStatsModalFn() {
  statsModal.classList.remove("active");
}

if (statsModal) {
  document.querySelectorAll(".card-clickable").forEach((card) => {
    card.addEventListener("click", () => {
      openStatsModal(card.dataset.filter);
    });
  });

  closeStatsModal?.addEventListener("click", closeStatsModalFn);
  closeStatsModalBtn?.addEventListener("click", closeStatsModalFn);
  statsOverlay?.addEventListener("click", closeStatsModalFn);
}

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  currentUserId = user ? user.uid : null;
  emailjs.init("49-8564mCPRVWNmBW");
  console.log("onAuthStateChanged triggered, user:", user);

  if (!user) {
    console.warn("Nessun utente loggato, redirect al login...");
    loadingEl.style.display = "none";
    window.location.href = "/login/";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 5000);

  await db.collection("viewedPages").add({
    type: "page_view",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    userId: user.uid,
    page: window.location.pathname
  });

  await db.collection("users").doc(user.uid).update({
    lastDashSelected: "user",
  });

  try {
    const userDoc = await db.collection("users").doc(user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    if (userData.firstAccess === true) {
      showFirstAccessModal(user.uid);
    }

    goToSurveyBtn.addEventListener("click", () => {
      console.log("Vai al sondaggio");
      window.open("https://www.friuliemergenze.it/sondaggi/aggiunta-servizi-funzioni/", "_blank");
    });

    function checkNotificationStatus() {
      if (!("Notification" in window)) {
        notificationStatusText.textContent = "Notifiche: Non supportate";
        notificationStatusDesc.textContent = "Il tuo browser non supporta le notifiche";
        notificationStatus.classList.add("denied");
        enableNotificationsBtn.disabled = true;
        return;
      }

      if (Notification.permission === "granted") {
        notificationStatusIcon.textContent = "✅";
        notificationStatusText.textContent = "Notifiche: Abilitate";
        notificationStatusDesc.textContent = "Riceverai notifiche in tempo reale";
        notificationStatus.classList.add("enabled");
        enableNotificationsBtn.textContent = "✅ Notifiche Abilitate";
        enableNotificationsBtn.disabled = true;
      } else if (Notification.permission === "denied") {
        notificationStatusIcon.textContent = "❌";
        notificationStatusText.textContent = "Notifiche: Negate";
        notificationStatusDesc.textContent = "Abilita le notifiche nelle impostazioni del browser";
        notificationStatus.classList.add("denied");
        enableNotificationsBtn.textContent = "❌ Non Disponibili";
        enableNotificationsBtn.disabled = true;
      }
    }

    enableNotificationsBtn.addEventListener("click", async () => {
      if (!("Notification" in window)) {
        alert("Il tuo browser non supporta le notifiche");
        return;
      }

      try {
        const permission = await Notification.requestPermission();

        if (permission === "granted") {
          if (currentUserId) {
            await db.collection("users").doc(currentUserId).update({ notificationsEnabled: true, notificationsEnabledAt: new Date() });
          }

          notificationStatusIcon.textContent = "✅";
          notificationStatusText.textContent = "Notifiche: Abilitate";
          notificationStatusDesc.textContent = "Riceverai notifiche in tempo reale";
          notificationStatus.classList.remove("denied");
          notificationStatus.classList.add("enabled");

          enableNotificationsBtn.textContent = "✅ Notifiche Abilitate";
          enableNotificationsBtn.disabled = true;

          new Notification("MyFrEM", {
            icon: "https://www.friuliemergenze.it/assets/logo.png",
            body: "Notifiche abilitate con successo! Riceverai aggiornamenti in tempo reale.",
            tag: "friuliemergenze-welcome",
            requireInteraction: false,
          });

          console.log("✅ Notifiche abilitate");
        } else if (permission === "denied") {
          notificationStatusIcon.textContent = "❌";
          notificationStatusText.textContent = "Notifiche: Negate";
          notificationStatusDesc.textContent = "Puoi abilitarle dalle impostazioni del browser";
          notificationStatus.classList.add("denied");
          enableNotificationsBtn.textContent = "❌ Non Disponibili";
          enableNotificationsBtn.disabled = true;
          console.log("❌ Notifiche negate");
        }
      } catch (error) {
        console.error("Errore nell'abilitazione delle notifiche:", error);
        notificationStatusText.textContent = "Notifiche: Errore";
        notificationStatusDesc.textContent = "Si è verificato un errore";
      }
    });

    document.addEventListener("DOMContentLoaded", checkNotificationStatus);

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
      console.log("Modalità sola lettura attivata");
      document.body.classList.add("read-only-mode");
    }

    if (staffRoles.includes(userData.role)) {
      const staffLinkEl = document.querySelector(".navbar");
      const br = document.createElement("br");
      const link = document.createElement("a");
      link.href = "/staff/dashboard/";
      link.textContent = "Passa alla dashboard staff";
      staffLinkEl.appendChild(br);
      staffLinkEl.appendChild(link);
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
      .get();

    let total = 0,
      approved = 0,
      pending = 0,
      rejected = 0;
    let displayCount = 0;
    activityListEl.innerHTML = "";
    allPhotos = [];

    photosSnap.forEach((doc) => {
      const photo = doc.data();
      let status;
      console.log("📸 Foto:", photo.vehicleModel, "Status:", photo.status);
      total++;

      if (photo.status === "Approvata ✅" || photo.status === "Approvata") approved++;
      if (photo.status === "Foto in attesa di approvazione" || photo.status === "Foto in attesa di approvazione ⌛") pending++;
      if (photo.status === "Rifiutata ❌" || photo.status === "Rifiutata") rejected++;

      if (photo.status === "Approvata ✅" || photo.status === "Approvata") {
        status = "Approvata";
      } else if (photo.status === "Foto in attesa di approvazione" || photo.status === "Foto in attesa di approvazione ⌛") {
        status = "In attesa";
      } else if (photo.status === "Rifiutata ❌" || photo.status === "Rifiutata") {
        status = "Rifiutata";
      }

      allPhotos.push(photo);

      if (displayCount < 5) {
        const li = document.createElement("li");
        li.innerHTML = `
          <p>Foto caricata il ${
            photo.createdAt?.toDate().toLocaleString() || "data sconosciuta"
          } - Stato: <b>${photo.status}</b></p>
        `;
        activityListEl.appendChild(li);
        displayCount++;
      }
    });

    totalPhotosEl.textContent = total;
    approvedPhotosEl.textContent = approved;
    pendingPhotosEl.textContent = pending;
    rejectedPhotosEl.textContent = rejected;

    if (total === 0) {
      activityListEl.innerHTML = "<li>Nessuna attività recente.</li>";
    }

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
        btnLoader.style.display = "inline-block";

        try {
          const userRef = db.collection("users").doc(user.uid);
          const userDoc = await userRef.get();
          const userData = userDoc.data();

          await userRef.update({ newsSubbed: true });

          const existingQuery = await db
            .collection("newsletterSubs")
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
          btnLoader.style.display = "none";
          window.location.reload();
        }
      });
    }

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  } catch (err) {
    console.error("Errore durante il caricamento:", err);
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }
});

let currentStep = 1;
const totalSteps = 5;

function showFirstAccessModal(userId) {
  const modal = document.getElementById("firstAccessModal");
  modal.classList.add("active");
  currentStep = 1;
  showStep(1);
  setupModalListeners(userId);
}

function showStep(step) {
  const steps = document.querySelectorAll(".modal-step");
  steps.forEach((el) => el.classList.remove("active"));

  const activeStep = document.querySelector(`.modal-step[data-step="${step}"]`);
  if (activeStep) {
    activeStep.classList.add("active");
  }

  currentStep = step;
}

function setupModalListeners(userId) {
  const nextButtons = document.querySelectorAll("[data-action='next']");
  const backButtons = document.querySelectorAll("[data-action='back']");
  const finishButton = document.querySelector("[data-action='finish']");

  nextButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentStep < totalSteps) {
        showStep(currentStep + 1);
      }
    });
  });

  backButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentStep > 1) {
        showStep(currentStep - 1);
      }
    });
  });

  finishButton.addEventListener("click", async () => {
    closeFirstAccessModal(userId);
  });

  const modal = document.getElementById("firstAccessModal");
  const overlay = modal.querySelector(".modal-overlay");

  overlay.addEventListener("click", async () => {
    closeFirstAccessModal(userId);
  });
}

async function closeFirstAccessModal(userId) {
  try {
    await db.collection("users").doc(userId).update({ firstAccess: false });
    console.log("✅ firstAccess settato a false");

    const modal = document.getElementById("firstAccessModal");
    modal.classList.remove("active");

    if (typeof window.initWhatsNewCarousel === "function") {
      window.initWhatsNewCarousel();
    }
  } catch (error) {
    console.error("❌ Errore nell'aggiornamento del doc:", error);
    const modal = document.getElementById("firstAccessModal");
    modal.classList.remove("active");
  }
}

logoutBtn.addEventListener("click", async () => {
  console.log("🚪 Logout in corso...");
  await auth.signOut();
  console.log("✅ Logout completato, redirect...");
  window.location.href = "/login/";
});