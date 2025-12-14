import { getAuth, updatePassword } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==================== DOM ====================
const logoutBtn = document.getElementById("logoutBtn");

const staffUsername = document.getElementById("staffUsername");
const staffName = document.getElementById("staffName");
const staffEmail = document.getElementById("staffEmail");
const staffRole = document.getElementById("staffRole");

const changePasswordForm = document.getElementById("changePasswordForm");
const passwordStatusMsg = document.getElementById("passwordStatusMsg");

const changeUsernameForm = document.getElementById("changeUsernameForm");
const usernameText = document.getElementById("usernameText");
const newUsernameInput = document.getElementById("newUsername");

const bioInput = document.getElementById("bioInput")
const bioText = document.getElementById("bioText")
const saveBioBtn = document.getElementById("saveBioBtn");

const preferencesFormButton = document.getElementById("preferencesFormButton");
const preferencesStatusMsg = document.getElementById("preferencesStatusMsg");

const emailNotificationsCheckbox = document.getElementById("emailNotifications");
const darkModeToggle = document.getElementById("darkModeToggle");

const clearCacheBtn = document.getElementById("clearCacheBtn");
const resetLayoutBtn = document.getElementById("resetLayoutBtn");

let currentUserId = null;
let currentUser = null

// ==================== LOGIN CHECK & CARICAMENTO PROFILO ====================
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "/login/";
    return;
  }

  currentUserId = user.uid;
  currentUser = user;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  const data = snap.data();

  staffUsername.textContent = data.username || "Non disponibile.";
  staffName.textContent = data.name + " " + data.surname || "Non disponibile.";
  staffEmail.innerHTML = `<a href="mailto:${data.email}">${data.email}</a>` || "Non disponibile.";
  staffRole.textContent = data.role || "Non disponibile.";
  usernameText.textContent = data.username || "Non disponibile.";
  bioText.textContent = data.bio || "Non disponibile."

  // Carica preferenze da localStorage
  emailNotificationsCheckbox.checked = localStorage.getItem("staff_emailNotifications") === "true";
});

// ==================== LOGOUT ====================
logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "/login/";
});

// ==================== CAMBIO PASSWORD ====================
changePasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const current = document.getElementById("currentPassword").value;
  const newP = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmPassword").value;
  // Controllo password attuale
  if (current !== auth.currentUser.password) {
    passwordStatusMsg.textContent = "❌ Password attuale errata!";
    passwordStatusMsg.className = "error";
    return;
  }

  if (newP !== confirm) {
    passwordStatusMsg.textContent = "❌ Le nuove password non coincidono!";
    passwordStatusMsg.className = "error";
    return;
  }

  try {
    const user = auth.currentUser;
    await updatePassword(user, newP);
    passwordStatusMsg.textContent = "✅ Password cambiata con successo!";
    passwordStatusMsg.className = "success";
    changePasswordForm.reset();
  } catch (err) {
    passwordStatusMsg.textContent = "❌ Errore nel cambiare password: " + err.message;
    passwordStatusMsg.className = "error";
  }
});

// ==================== CAMBIO USERNAME ====================
changeUsernameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newUsername = newUsernameInput.value.trim();
  if (newUsername.length < 3) {
    alert("Lo username deve essere di almeno 3 caratteri!");
    return;
  }
  await updateDoc(doc(db, "users", currentUserId), {
    username: newUsername
  });
  usernameText.textContent = newUsername;
  alert("Username aggiornato!");
});

// ==================== BIO ====================
saveBioBtn.addEventListener("click", async () => {
  const newBio = bioInput.value.trim();

  await updateDoc(doc(db, "users", currentUserId), {
    bio: newBio
  });

  alert("Biografia aggiornata!");
});

// ==================== PREFERENZE STAFF ====================
preferencesFormButton.addEventListener("submit", (e) => {
  e.preventDefault();

  localStorage.setItem("staff_emailNotifications", emailNotificationsCheckbox.checked);

  preferencesStatusMsg.textContent = "✅ Preferenze salvate!";
  preferencesStatusMsg.className = "success";

  setTimeout(() => { preferencesStatusMsg.textContent = ""; }, 3000);
});

// ==================== SISTEMA ====================
clearCacheBtn.addEventListener("click", () => {
  localStorage.clear();
  alert("Cache locale svuotata!");
});

resetLayoutBtn.addEventListener("click", () => {
  // Resetta solo layout / temi / preferenze
  localStorage.removeItem("staff_darkMode");
  localStorage.removeItem("staff_emailNotifications");
  document.body.classList.remove("dark-mode");
  alert("Layout dashboard reimpostato!");
});