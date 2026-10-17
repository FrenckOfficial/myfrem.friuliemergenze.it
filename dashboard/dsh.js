import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, updateDoc, addDoc, collection, query, where, orderBy, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { auth, db } from "/helpers/firebase.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { addStaffLink } from "/helpers/loadNavbar.js";
import { photoStatus, STATUS, filled, formatDate, safeUrl } from "/dashboard/photos.js";
import { shouldTrackPageView } from "/helpers/pageViews.js";

let currentUser = null;
let currentUserId = null;

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

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  currentUserId = user ? user.uid : null;

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

  if (shouldTrackPageView(user.uid)) {
    await addDoc(collection(db, "viewedPages"), {
      type: "page_view",
      timestamp: serverTimestamp(),
      userId: user.uid,
      page: window.location.pathname
    });
  }

  await updateDoc(doc(db, "users", user.uid), {
    lastDashSelected: "user",
  });

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.exists() ? userDoc.data() : null;

    initBottomNav(userData, user, "user");

    if (userData.firstAccess === true) {
      showFirstAccessModal(user.uid);
    }

    goToSurveyBtn.addEventListener("click", () => {
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
        notificationStatusText.textContent = "Notifiche: Abilitate";
        notificationStatusDesc.textContent = "Riceverai notifiche in tempo reale";
        notificationStatus.classList.add("enabled");
        enableNotificationsBtn.textContent = "Notifiche Abilitate";
        enableNotificationsBtn.disabled = true;
      } else if (Notification.permission === "denied") {
        notificationStatusText.textContent = "Notifiche: Negate";
        notificationStatusDesc.textContent = "Abilita le notifiche nelle impostazioni del browser";
        notificationStatus.classList.add("denied");
        enableNotificationsBtn.textContent = "Non Disponibili";
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
            await updateDoc(doc(db, "users", currentUserId), { notificationsEnabled: true, notificationsEnabledAt: new Date() });
          }

          notificationStatusText.textContent = "Notifiche abilitate!";
          notificationStatusDesc.textContent = "Riceverai notifiche in tempo reale";
          notificationStatus.classList.remove("denied");
          notificationStatus.classList.add("enabled");

          enableNotificationsBtn.textContent = "Notifiche abilitate!";
          enableNotificationsBtn.disabled = true;

          new Notification("Piattaforma MyFrEM", {
            icon: "https://www.friuliemergenze.it/assets/logo.png",
            body: "Notifiche abilitate con successo! Riceverai aggiornamenti in tempo reale.",
            tag: "friuliemergenze-welcome",
            requireInteraction: false,
          });

        } else if (permission === "denied") {
          notificationStatusText.textContent = "Notifiche negate";
          notificationStatusDesc.textContent = "Puoi abilitarle dalle impostazioni del browser!";
          notificationStatus.classList.add("denied");
          enableNotificationsBtn.textContent = "Non Disponibili";
          enableNotificationsBtn.disabled = true;
        }
      } catch (error) {
        console.error("Errore nell'abilitazione delle notifiche:", error);
        notificationStatusText.textContent = "Notifiche: Errore";
        notificationStatusDesc.textContent = "Si è verificato un errore";
      }
    });

    checkNotificationStatus();

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
      document.body.classList.add("read-only-mode");
    }

    if (staffRoles.includes(userData.role)) {
      addStaffLink();
    }

    userNameEl.textContent = filled(userData?.name) || filled(userData?.username) || "volontario";

    if (userData.newsSubbed === false) {
      newsBannerEl.style.display = "block";
    } else {
      newsBannerEl.style.display = "none";
    }

    const photosSnap = await getDocs(query(collection(db, "photos"), where("userId", "==", user.uid), orderBy("createdAt", "desc")));

    const counts = { approved: 0, pending: 0, rejected: 0 };
    const recent = [];

    photosSnap.forEach((doc) => {
      const photo = doc.data();
      counts[photoStatus(photo)]++;
      if (recent.length < 5) recent.push(photo);
    });

    totalPhotosEl.textContent = photosSnap.size;
    approvedPhotosEl.textContent = counts.approved;
    pendingPhotosEl.textContent = counts.pending;
    rejectedPhotosEl.textContent = counts.rejected;

    renderRecentPhotos(recent);

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
          const userRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userRef);
          const userData = userDoc.data();

          const response = await fetch("https://europe-west1-friuli-emergenze.cloudfunctions.net/newsletterSubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: { email: userData.email, name: userData.name || "" } })
          });
          const body = await response.json();
          if (!response.ok || body.error) throw new Error(body.error?.message || `HTTP ${response.status}`);

          if (body.result.status === "already") {
            await updateDoc(userRef, { newsSubbed: true });
            setStatus("Email già iscritta.", "warning");
          } else {
            setStatus("E-mail di conferma inviata!", "success");
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

function renderRecentPhotos(photos) {
  if (photos.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.innerHTML = '<i class="fa-solid fa-camera" aria-hidden="true"></i>Non hai ancora caricato foto. <a href="/dashboard/upload">Carica la prima</a>.';
    activityListEl.replaceChildren(li);
    return;
  }

  activityListEl.replaceChildren(...photos.map((photo) => {
    const li = document.createElement("li");
    li.className = "row";

    const thumb = document.createElement("span");
    thumb.className = "avatar avatar--square";
    const url = safeUrl(photo.url);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.loading = "lazy";
      thumb.append(img);
    } else {
      thumb.innerHTML = '<i class="fa-solid fa-image" aria-hidden="true"></i>';
    }

    const main = document.createElement("div");
    main.className = "row__main";
    const title = document.createElement("div");
    title.className = "row__title";
    title.textContent = filled(photo.vehicleModel) || "Foto";
    const sub = document.createElement("div");
    sub.className = "row__sub";
    sub.textContent = [filled(photo.location), formatDate(photo.createdAt)].filter(Boolean).join(" · ");
    main.append(title, sub);

    const status = STATUS[photoStatus(photo)];
    const chip = document.createElement("span");
    chip.className = `chip ${status.chip}`;
    chip.textContent = status.label;

    li.append(thumb, main, chip);
    return li;
  }));
}

let currentStep = 1;
const PHONE_STEP = 5;
let firstAccessBound = false;

function getFirstAccessModal() {
  return document.getElementById("firstAccessModal");
}

function getTotalSteps() {
  return getFirstAccessModal().querySelectorAll(".modal-step").length;
}

function showFirstAccessModal(userId) {
  getFirstAccessModal().classList.add("active");
  showStep(1);
  setupModalListeners(userId);
}

function showStep(step) {
  const modal = getFirstAccessModal();

  modal.querySelectorAll(".modal-step").forEach((el) => el.classList.remove("active"));

  const activeStep = modal.querySelector(`.modal-step[data-step="${step}"]`);
  if (activeStep) {
    activeStep.classList.add("active");
  }

  currentStep = step;
}

async function savePhoneIfPresent(userId) {
  const input = document.getElementById("firstAccessPhone");
  const status = document.getElementById("firstAccessPhoneStatus");
  if (!input || !status) return true;

  const phone = input.value.trim();
  status.textContent = "";

  if (!phone) return true;

  const digits = phone.replace(/[\s.-]/g, "");
  if (!/^\+?[0-9]{6,15}$/.test(digits)) {
    status.textContent = "Numero non valido.";
    status.style.color = "var(--signal-red)";
    return false;
  }

  try {
    await updateDoc(doc(db, "users", userId), { phone });
    return true;
  } catch (error) {
    console.error("Errore salvataggio telefono:", error);
    status.textContent = "Non è stato possibile salvare il numero.";
    status.style.color = "var(--signal-red)";
    return false;
  }
}

function setupModalListeners(userId) {
  if (firstAccessBound) return;
  firstAccessBound = true;

  const modal = getFirstAccessModal();

  modal.addEventListener(
    "click",
    async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn || !modal.contains(btn)) return;

      e.stopPropagation();

      const action = btn.dataset.action;

      if (action === "next") {
        if (currentStep === PHONE_STEP) {
          btn.disabled = true;
          const ok = await savePhoneIfPresent(userId);
          btn.disabled = false;
          if (!ok) return;
        }

        if (currentStep < getTotalSteps()) {
          showStep(currentStep + 1);
        }
      } else if (action === "back") {
        if (currentStep > 1) {
          showStep(currentStep - 1);
        }
      } else if (action === "finish") {
        closeFirstAccessModal(userId);
      }
    },
    true
  );

  modal.querySelector(".modal-overlay").addEventListener("click", () => {
    closeFirstAccessModal(userId);
  });
}

async function closeFirstAccessModal(userId) {
  const modal = getFirstAccessModal();

  try {
    await updateDoc(doc(db, "users", userId), { firstAccess: false });

    modal.classList.remove("active");

    if (typeof window.initWhatsNewCarousel === "function") {
      window.initWhatsNewCarousel();
    }
  } catch (error) {
    console.error("Errore nell'aggiornamento del doc:", error);
    modal.classList.remove("active");
  }
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login/";
});