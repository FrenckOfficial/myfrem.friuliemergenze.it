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