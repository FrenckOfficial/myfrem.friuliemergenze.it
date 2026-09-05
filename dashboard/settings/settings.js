import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { uploadFile } from "/helpers/uploadFile.js";
import { firebaseConfig } from "../../configFirebase.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "../../helpers/modals.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const profilePicInput = document.getElementById("profilePicInput");
const profilePicForm = document.getElementById("profilePicForm");
const profilePreview = document.getElementById("profilePreview");
const deleteProfPicBtn = document.getElementById("deleteProfPicBtn");
const uploadProfilePicBtn = document.getElementById("uploadProfilePicBtn");

const profileIDText = document.getElementById("profileIDText");
const copyProfileLinkBtn = document.getElementById("copyProfileLinkBtn");
const nameInput = document.getElementById("nameInput");
const surnameInput = document.getElementById("surnameInput");
const fullNameText = document.getElementById("fullNameText");
const saveFullNameBtn = document.getElementById("saveFullNameBtn");

const usernameInput = document.getElementById("usernameInput");
const userText = document.getElementById("userText");
const saveUsernameBtn = document.getElementById("saveUsernameBtn");

const mailInput = document.getElementById("mailInput");
const mailText = document.getElementById("mailText");
const saveMailBtn = document.getElementById("saveMailBtn");
const mailTextPsw = document.getElementById("mailTextPsw");

const phoneInput = document.getElementById("phoneInput");
const phoneText = document.getElementById("phoneText");
const savePhoneBtn = document.getElementById("savePhoneBtn");

const bioInput = document.getElementById("bioInput");
const bioText = document.getElementById("bioText");
const saveBioBtn = document.getElementById("saveBioBtn");

const savePasswordBtn = document.getElementById("savePasswordBtn");

const emailNotificationsCheckbox = document.getElementById("emailNotifications");
const newsletterCheckbox = document.getElementById("newsletter");
const publicProfileCheckbox = document.getElementById("publicProfile");
const savePreferencesBtn = document.getElementById("savePreferencesBtn");

const logoutBtn = document.getElementById("logoutBtn");
const logoutBtnSettings = document.getElementById("logoutBtnSettings");

let currentUserId = null;
let currentUser = null;
let isReadOnlyMode = false;
emailjs.init("49-8564mCPRVWNmBW");

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

onAuthStateChanged(auth, async user => {
  if (!user) {
    loadingEl.style.display = "none";
    window.location.href = "/login/";
    return;
  }

  const timeoutId = setTimeout(() => {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }, 5000);

  await addDoc(collection(db, "viewedPages"), {
    type: "page_view",
    timestamp: serverTimestamp(),
    userId: user.uid,
    page: window.location.pathname
  });

  try {
    currentUserId = user.uid;
    currentUser = user;
    await loadUserData(user.uid);
    await loadPreferences();
    await loadUserBadgesSettings();
    await loadBadgesProgress();
    await load2FAStatus();
    
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  } catch (err) {
    console.error("❌ Errore:", err);
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }
});

async function loadUserData(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const staffRoles = [
    "simplestaff",
    "modstaff",
    "advstaff",
    "advstaffplus",
    "superadmin",
  ];

  const data = snap.data();

  if (data.role === "testacc") {
    isReadOnlyMode = true;
    document.body.classList.add("read-only-mode");
    disableAllButtons();
    setStatus("closeReadOnlyStatus", "readOnlyStatusBox", "readOnlyStatus", "📖 Modalità sola lettura: non puoi modificare i dati", "warning");
  }

  if (staffRoles.includes(data.role)) {
    const staffLinkEl = document.querySelector('.navbar');
    const br = document.createElement('br');
    const link = document.createElement('a');
    link.href = '/staff/dashboard/';
    link.textContent = 'Passa alla dashboard staff';
    staffLinkEl.appendChild(br);
    staffLinkEl.appendChild(link);
    const content = document.querySelector('.main-content');
    const settingsContainer = document.querySelector('.settings-container');
    settingsContainer.style.display = 'none';
    const div = document.createElement('div');
    div.className = "staff-warning";
    div.textContent = "Sei un membro dello staff. Non è possibile modificare i tuoi dati personali.";
    content.appendChild(div);
  }

  profileIDText.innerHTML = `<b>${uid}</b>`;
  fullNameText.innerHTML = `<b>${data.name || ""} ${data.surname || ""}</b>`;
  userText.innerHTML = `<b>${data.username}</b>` || "";
  mailText.innerHTML = `<b>${data.email}</b>` || "";
  mailTextPsw.innerHTML = `<b>${data.email}</b>` || "";
  bioText.innerHTML = `<b>${data.bio ? data.bio : ""}</b>` || "";
  if (data.photoURL) {
    profilePreview.src = data.photoURL;
  } else {
    profilePreview.src = "https://myfrem.friuliemergenze.it/assets/profile/defpic.png"
  }
}

function disableAllButtons() {
  const buttons = [
    uploadProfilePicBtn,
    copyProfileLinkBtn,
    saveFullNameBtn,
    saveUsernameBtn,
    saveMailBtn,
    savePhoneBtn,
    saveBioBtn,
    savePasswordBtn,
    savePreferencesBtn
  ];

  buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
    btn.title = "Non disponibile in modalità sola lettura";
  });

  profilePicForm.style.opacity = "0.5";
  profilePicForm.style.pointerEvents = "none";
  profilePicInput.disabled = true;
  deleteProfPicBtn.disabled = true;

  ["enable-twofa-btn", "disable-twofa-btn", "regenerate-recovery-btn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
      btn.title = "Non disponibile in modalità sola lettura";
    }
  });
}

profilePicForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isReadOnlyMode) {
    setStatus("Non puoi modificare in modalità sola lettura", "error");
    return;
  }

  const file = profilePicInput.files[0];
  if (!file) return setStatus("Seleziona un'immagine!", "error");

  if (!file.type.startsWith("image/")) {
    return setStatus("Solo immagini!", "error");
  }

  try {
    const imageUrl = await uploadFile(file, "profile-pics", currentUserId);

    await updateDoc(doc(db, "users", currentUserId), {
      photoURL: imageUrl
    });

    profilePreview.src = imageUrl;

    setStatus("Foto profilo aggiornata!", "success");
  } catch (err) {
    console.error(err);
    setStatus(`${"Errore upload: " + err.message}`, "error");
  }
});

copyProfileLinkBtn.addEventListener("click", () => {
  const profileLink = `https://myfrem.friuliemergenze.it/profile/?userid=${currentUserId}`;
  navigator.clipboard.writeText(profileLink);
  setStatus("closePStatus", "profileStatusBox", "profileStatus", "Link copiato!", "success");
})

saveFullNameBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("Non puoi modificare in modalità sola lettura", "error");

  const newName = nameInput.value.trim();
  const newSurname = surnameInput.value.trim();
  if (newName.length < 3) return setStatus("Minimo 3 caratteri!", "error");
  if (newSurname.length < 3) return setStatus("Minimo 3 caratteri!", "error");

  await updateDoc(doc(db, "users", currentUserId), {
    name: newName,
    surname: newSurname,
  });

  setStatus("Nome e cognome aggiornati!", "success");
});

saveUsernameBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("Non puoi modificare in modalità sola lettura", "error");

  const newUsername = usernameInput.value.trim();
  if (newUsername.length < 3) return setStatus("Minimo 3 caratteri!", "error");

  await updateDoc(doc(db, "users", currentUserId), {
    username: newUsername
  });

  setStatus("Username aggiornato!", "success");
});

saveMailBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("Non puoi modificare in modalità sola lettura", "error");

  const newMail = mailInput.value.trim();
  if (newMail.length < 5 || !newMail.includes("@")) return setStatus("Inserisci una mail valida!", "error");

  await updateEmail(currentUser, newMail)

  await updateDoc(doc(db, "users", currentUserId), {
    email: newMail
  });

  setStatus("E-Mail aggiornata!", "success");
});

savePhoneBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("Non puoi modificare in modalità sola lettura", "error");

  const newPhone = phoneInput.value.trim();
  if (newPhone.length < 10) return setStatus("Inserisci un numero valido!", "error");

  await updateDoc(doc(db, "users", currentUserId), {
    phone: newPhone
  });

  setStatus("Numero di telefono aggiornato!", "success");
});

saveBioBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("Non puoi modificare in modalità sola lettura", "error");

  const newBio = bioInput.value.trim();
  if (newBio.length > 150) return setStatus("Massimo 150 caratteri!", "error");

  await updateDoc(doc(db, "users", currentUserId), {
    bio: newBio
  });

  setStatus("Biografia aggiornata!", "success");
});

savePasswordBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("Non puoi modificare in modalità sola lettura", "error");

  const passwordInput = document.getElementById("passwordInput");
  const passwordRepeatInput = document.getElementById("passwordRepeatInput");
  const currentPasswordInput = document.getElementById("currentPasswordInput");

  const currentPassword = currentPasswordInput.value.trim();
  const newPassword = passwordInput.value.trim();
  const newPasswordRepeat = passwordRepeatInput.value.trim();

  if (!currentPassword) return setStatus("Inserisci la password attuale!", "error");
  if (newPassword.length < 6) return setStatus("Password: minimo 6 caratteri!", "error");
  if (newPassword !== newPasswordRepeat) return setStatus("Le password non corrispondono!", "error");

  try {
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);

    setStatus("Password aggiornata!", "success");
    currentPasswordInput.value = "";
    passwordInput.value = "";
    passwordRepeatInput.value = "";
  } catch (err) {
    setStatus("Password attuale non corretta!", "error");
  }
});

savePreferencesBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("Non puoi modificare in modalità sola lettura", "error");

  await updateDoc(doc(db, "users", currentUserId), {
    emailNotifications: emailNotificationsCheckbox.checked,
    newsletter: newsletterCheckbox.checked,
    publicProfile: publicProfileCheckbox.checked
  });

  setStatus("Preferenze aggiornate!", "success");
});

async function loadPreferences() {
  const ref = doc(db, "users", currentUserId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const data = snap.data();
  emailNotificationsCheckbox.checked = data.emailNotifications || false;
  newsletterCheckbox.checked = data.newsletter || false;
  publicProfileCheckbox.checked = data.publicProfile || false;
}

async function loadUserBadgesSettings() {
  try {
    const userDocRef = doc(db, "users", currentUserId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) return;

    const userData = userDocSnap.data();
    const badgeVisibilityCheckbox = document.getElementById("badgeVisibility");

    if (badgeVisibilityCheckbox) {
      badgeVisibilityCheckbox.checked = userData.badgeVisibility !== false;
    }

    const saveBadgeVisibilityBtn = document.getElementById("saveBadgeVisibilityBtn");
    if (saveBadgeVisibilityBtn) {
      saveBadgeVisibilityBtn.addEventListener("click", async () => {
        if (isReadOnlyMode) {
          setStatus("Non puoi modificare in modalità sola lettura", "error");
          return;
        }

        await updateDoc(userDocRef, {
          badgeVisibility: badgeVisibilityCheckbox.checked
        });

        setStatus("Visibilità badge aggiornata!", "success");
      });
    }
  } catch (err) {
    console.error("Errore caricamento impostazioni badge:", err);
  }
}

async function load2FAStatus() {
  try {
    const userDocRef = doc(db, "users", currentUserId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) return;

    const userData = userDocSnap.data();
    const is2FAEnabled = userData.twoFactorEnabled || false;

    const twoFAStatusEl = document.getElementById("twoFAStatus");
    const enableTwoFABtn = document.getElementById("enable-twofa-btn");
    const disableTwoFABtn = document.getElementById("disable-twofa-btn");

    if (twoFAStatusEl) {
      twoFAStatusEl.textContent = is2FAEnabled ? "🔒 Abilitato" : "🔓 Disabilitato";
    }

    if (enableTwoFABtn) {
      enableTwoFABtn.style.display = is2FAEnabled ? "none" : "block";
      if (!isReadOnlyMode) {
        enableTwoFABtn.addEventListener("click", () => {
          window.location.href = "/dashboard/settings/2fa/setup/";
        });
      }
    }

    if (disableTwoFABtn) {
      disableTwoFABtn.style.display = is2FAEnabled ? "block" : "none";
      if (!isReadOnlyMode) {
        disableTwoFABtn.addEventListener("click", async () => {
          const confirmed = confirm("Sei sicuro di disabilitare l'autenticazione a due fattori?");
          if (confirmed) {
            await updateDoc(userDocRef, {
              twoFactorEnabled: false,
              twoFactorSecret: null,
              twoFactorBackupCodes: null
            });
            twoFAStatusEl.textContent = "🔓 Disabilitato";
            enableTwoFABtn.style.display = "block";
            disableTwoFABtn.style.display = "none";
          }
        });
      }
    }
  } catch (err) {
    console.error("Errore caricamento 2FA:", err);
  }
}

async function loadUserBadgesEarned() {
  try {
    const badgesContainer = document.getElementById("badgesContainer");
    if (!badgesContainer) return;

    const badgesRef = collection(db, "users", currentUserId, "badges");
    const badgesSnap = await getDocs(badgesRef);

    if (badgesSnap.empty) {
      badgesContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--muted);">
          <p>Non hai ancora guadagnato badge.</p>
          <p style="font-size: 0.9rem;">Continua con foto e partecipazione!</p>
        </div>
      `;
      return;
    }

    const badgeEarnedList = document.createElement("div");
    badgeEarnedList.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-top: 1rem;";

    for (const badgeDocSnap of badgesSnap.docs) {
      const badgeId = badgeDocSnap.id;
      const badgeData = badgeDocSnap.data();

      const badgeDocRef = doc(db, "badges", badgeId);
      const badgeMeta = await getDoc(badgeDocRef);

      if (!badgeMeta.exists()) continue;

      const meta = badgeMeta.data();

      const badgeEl = document.createElement("div");
      badgeEl.style.cssText = `
        background: var(--bg-surface);
        border: 2px solid #00d4e8;
        border-radius: var(--radius-md);
        padding: 1rem;
        text-align: center;
        transition: transform 0.2s, box-shadow 0.2s;
      `;

      const img = document.createElement("img");
      img.src = meta.icon || "/assets/badges/default.svg";
      img.alt = meta.name;
      img.style.cssText = "width: 60px; height: 60px; margin-bottom: 0.5rem; border-radius: 50%;";
      img.onerror = () => {
        img.src = "/assets/badges/default.svg";
      };

      const name = document.createElement("div");
      name.style.cssText = "font-weight: 700; color: #00d4e8; font-size: 0.85rem; margin-bottom: 0.25rem;";
      name.textContent = meta.name;

      const earnedDate = document.createElement("div");
      earnedDate.style.cssText = "font-size: 0.75rem; color: var(--muted);";
      if (badgeData.earnedAt?.toDate) {
        earnedDate.textContent = `${badgeData.earnedAt.toDate().toLocaleDateString("it-IT")}`;
      }

      badgeEl.appendChild(img);
      badgeEl.appendChild(name);
      badgeEl.appendChild(earnedDate);

      badgeEl.addEventListener("mouseenter", () => {
        badgeEl.style.transform = "scale(1.08)";
        badgeEl.style.boxShadow = "0 0 12px rgba(0, 212, 232, 0.3)";
      });

      badgeEl.addEventListener("mouseleave", () => {
        badgeEl.style.transform = "scale(1)";
        badgeEl.style.boxShadow = "none";
      });

      badgeEarnedList.appendChild(badgeEl);
    }

    badgesContainer.appendChild(badgeEarnedList);

  } catch (err) {
    console.error("Errore caricamento badge:", err);
  }
}

async function loadBadgesProgress() {
  try {
    const progressContainer = document.getElementById("badgesProgressContainer");
    if (!progressContainer) return;

    const badgesRef = collection(db, "badges");
    const badgesSnap = await getDocs(badgesRef);

    const earnedBadgesRef = collection(db, "users", currentUserId, "badges");
    const earnedSnap = await getDocs(earnedBadgesRef);
    const earnedIds = new Set(earnedSnap.docs.map(d => d.id));

    const progressList = document.createElement("div");
    progressList.style.cssText = "display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;";

    for (const badgeDoc of badgesSnap.docs) {
      if (earnedIds.has(badgeDoc.id)) continue;

      const badge = badgeDoc.data();
      if (!badge.enabled) continue;

      const progress = await calculateBadgeProgress(currentUserId, badge, badgeDoc.id);

      if (!progress || progress.earned) continue;

      const progressEl = document.createElement("div");
      progressEl.style.cssText = "padding: 1rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-panel);";

      const title = document.createElement("div");
      title.style.cssText = "font-weight: 700; color: var(--accent); margin-bottom: 0.5rem; font-size: 0.9rem;";
      title.textContent = badge.name;

      const barContainer = document.createElement("div");
      barContainer.style.cssText = "width: 100%; height: 6px; background: var(--bg-panel); border-radius: 3px; overflow: hidden; margin-bottom: 0.5rem;";

      const bar = document.createElement("div");
      bar.style.cssText = `width: ${progress.percentage}%; height: 100%; background: #00d4e8; transition: width 0.3s ease;`;
      barContainer.appendChild(bar);

      const percent = document.createElement("div");
      percent.style.cssText = "font-size: 0.75rem; color: var(--muted);";
      percent.textContent = `${progress.current}/${progress.target} (${progress.percentage}%)`;

      progressEl.appendChild(title);
      progressEl.appendChild(barContainer);
      progressEl.appendChild(percent);

      progressList.appendChild(progressEl);
    }

    progressContainer.appendChild(progressList);

  } catch (err) {
    console.error("Errore caricamento progress:", err);
  }
}

async function calculateBadgeProgress(userId, badge, badgeId) {
  const { type, threshold } = badge.criteria;

  let current = 0;

  switch (type) {
    case "photos": {
      const snap = await getDocs(
        query(
          collection(db, "photos"),
          where("userId", "==", userId),
          where("status", "==", `${"Approvata ✅" || "Approvata"}`)
        )
      );
      current = snap.size;
      break;
    }

    case "events": {
      const snap = await getDocs(
        query(
          collection(db, "events"),
          where("userId", "==", userId),
          where("status", "==", "Organizzato")
        )
      );
      current = snap.size;
      break;
    }

    case "surveys": {
      const snap = await getDocs(
        query(
          collection(db, "surveyResponses"),
          where("userId", "==", userId)
        )
      );
      current = snap.size;
      break;
    }

    case "exploration": {
      const snap = await getDocs(
        query(
          collection(db, "photos"),
          where("userId", "==", userId),
          where("status", "==", `${"Approvata ✅" || "Approvata"}`)
        )
      );
      const services = new Set(snap.docs.map(d => d.data().serviceId));
      current = services.size;
      break;
    }

    case "time": {
      const userDoc = await getDoc(doc(db, "users", userId));
      const createdAt = userDoc.data()?.createdAt?.toDate();
      if (createdAt) {
        const daysSinceCreation = Math.floor(
          (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        current = daysSinceCreation;
      }
      break;
    }

    default:
      return null;
  }

  return {
    earned: false,
    current,
    target: threshold,
    percentage: Math.floor((current / threshold) * 100)
  };
}

deleteProfPicBtn.addEventListener("click", async (e) => {
  if (isReadOnlyMode) return;
  
  await updateDoc(doc(db, "users", currentUserId), {
    photoURL: "https://myfrem.friuliemergenze.it/assets/profile/defpic.png"
  });
})

logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "/login/";
  });
});