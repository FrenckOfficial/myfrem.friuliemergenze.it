import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import { firebaseConfig } from "../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

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

const bioInput = document.getElementById("bioInput");
const saveBioBtn = document.getElementById("saveBioBtn");

const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const savePasswordBtn = document.getElementById("savePasswordBtn");

const logoutBtn = document.getElementById("logoutBtn");
const logoutBtnSettings = document.getElementById("logoutBtnSettings");

let currentUserId = null;
let currentUser = null;

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "/login/";
    return;
  }

  currentUserId = user.uid;
  currentUser = user;

  await loadUserData(user.uid);
});

async function loadUserData(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const data = snap.data();

  fullNameText.innerHTML = `<b>${data.name} ${data.surname}</b>` || "";
  userText.innerHTML = `<b>${data.username}</b>` || "";
  mailText.innerHTML = `<b>${data.email}</b>` || "";
  bioInput.value = data.bio || "";
}

saveFullNameBtn.addEventListener("click", async () => {
  const newName = nameInput.value.trim();
  const newSurname = surnameInput.value.trim();
  if (newName.length < 3) return alert("Minimo 3 caratteri!");
  if (newSurname.length < 3) return alert("Minimo 3 caratteri!");

  await updateDoc(doc(db, "users", currentUserId), {
    name: newName,
    surname: newSurname,
  });

  alert("Nome e cognome aggiornati!");
});

saveUsernameBtn.addEventListener("click", async () => {
  const newUsername = usernameInput.value.trim();
  if (newUsername.length < 3) return alert("Minimo 3 caratteri!");

  await updateDoc(doc(db, "users", currentUserId), {
    username: newUsername
  });

  alert("Username aggiornato!");
});

saveMailBtn.addEventListener("click", async () => {
  const newMail = mailInput.value.trim();
  if (newMail.length < 5 || !newMail.includes("@")) return alert("Inserisci una mail valida!");

  await updateDoc(doc(db, "users", currentUserId), {
    email: newMail
  });

  alert("E-Mail aggiornato!");
});

saveBioBtn.addEventListener("click", async () => {
  const newBio = bioInput.value.trim();

  await updateDoc(doc(db, "users", currentUserId), {
    bio: newBio
  });

  alert("Biografia aggiornata!");
});

savePasswordBtn.addEventListener("click", async () => {
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  if (currentPassword !== auth.currentUser.password) {
    return alert("Password attuale errata!");
  }
  if (currentPassword.length === 0) return alert("Inserisci la password attuale!");
  if (newPassword.length < 6) return alert("La nuova password deve essere di almeno 6 caratteri!");
  if (newPassword !== confirmPassword) return alert("Le nuove password non corrispondono!");
  
  const credential = auth.EmailAuthProvider.credential(
    currentUser.email,
    currentPassword
  );

  try {
    await currentUser.reauthenticateWithCredential(credential);
    await currentUser.updatePassword(newPassword);
    await updateDoc(doc(db, "users", currentUserId), {
      passwordUpdatedAt: new Date()
    });
    alert("Password aggiornata con successo!");
  } catch (error) {
    alert("Errore durante l'aggiornamento della password: " + error.message);
  }
});

logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "/login/";
  });
});

logoutBtnSettings.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "/login/";
  });
});