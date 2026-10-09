import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js";
import { uploadFile } from "/helpers/uploadFile.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const logoutBtn = document.getElementById("logoutBtn");

const staffIDText = document.getElementById("staffID");
const staffUsername = document.getElementById("staffUsername");
const staffName = document.getElementById("staffName");
const staffEmail = document.getElementById("staffEmail");
const staffRole = document.getElementById("staffRole");
const staffAccess = document.getElementById("staffAccess");
const staffPhone = document.getElementById("staffPhone");

const changePasswordForm = document.getElementById("changePasswordForm");
const passwordStatusMsg = document.getElementById("passwordStatusMsg");

const bioInput = document.getElementById("bioInput");
const bioText = document.getElementById("bioText");
const saveBioBtn = document.getElementById("saveBioBtn");

const profilePicInput = document.getElementById("profilePicInput");
const profilePicForm = document.getElementById("profilePicForm");
const profilePreview = document.getElementById("profilePreview");
const deleteProfPicBtn = document.getElementById("deleteProfPicBtn");

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

let currentUserId = null;
let currentUser = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "/login/";
    return;
  }

  currentUserId = user.uid;
  currentUser = user;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const data = snap.data();

  const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

  if (snap.empty || !allowedRoles.includes(snap.data().role)) {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    setStatus("Accesso negato: non sei staff!", "error");
    window.location.href = "/dashboard";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  staffIDText.textContent = currentUserId || "Non disponibile.";
  staffUsername.textContent = data.username || "Non disponibile.";
  staffName.textContent = `${data.name || ""} ${data.surname || ""}`.trim() || "Non disponibile.";
  staffEmail.innerHTML = data.email ? `<a href="mailto:${data.email}">${data.email}</a>` : "Non disponibile.";
  staffPhone.textContent = data.phone || "Non disponibile.";
  if (data.role === "superadmin") {
    staffRole.textContent = "Super Amministratore";
  } else if (data.role === "advstaffplus") {
    staffRole.textContent = "Amministratore Avanzato Plus";
  } else if (data.role === "advstaff") {
    staffRole.textContent = "Amministratore Avanzato";
  } else if (data.role === "modstaff") {
    staffRole.textContent = "Amministratore";
  } else if (data.role === "simplestaff") {
    staffRole.textContent = "Amministratore in prova";
  } else {
    staffRole.textContent = "Dato non disponibile."
  };

  if (data.role === "superadmin") {
    staffAccess.textContent = "Accesso completo";
  } else if (data.role === "advstaffplus") {
    staffAccess.textContent = "Moderazione foto, richieste assistenza, rapporti espulsione e gestione utenze";
  } else if (data.role === "advstaff") {
    staffAccess.textContent = "Moderazione foto, richieste assistenza e rapporti espulsione";
  } else if (data.role === "modstaff") {
    staffAccess.textContent = "Moderazione foto e richieste di assistenza";
  } else if (data.role === "simplestaff") {
    staffAccess.textContent = "Sola moderazione foto";
  } else {
    staffAccess.textContent = "Dato non disponibile."
  };

  bioText.textContent = data.bio || "Non disponibile.";

  if (data.photoURL) {
    profilePreview.src = data.photoURL;
  } else {
    profilePreview.src = "https://myfrem.friuliemergenze.it/assets/profile/defpic.png"
  }

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login/";
});

changePasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const current = document.getElementById("currentPassword").value;
  const newP = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmPassword").value;

  if (newP !== confirm) {
    setStatus("Le nuove password non corrispondono.", "error");
    return;
  }

  try {
    const user = auth.currentUser;

    const credential = EmailAuthProvider.credential(user.email, current);
    await reauthenticateWithCredential(user, credential);

    await updatePassword(user, newP);

    setStatus("Password aggiornata con successo!", "success");

    changePasswordForm.reset();
  } catch (err) {
    setStatus(`Errore aggiornamento password: ${err.message}`, "error");
  }
});

saveBioBtn.addEventListener("click", async () => {
  const newBio = bioInput.value.trim();

  await updateDoc(doc(db, "users", currentUserId), {
    bio: newBio
  });

  bioText.textContent = newBio;
  setStatus("Biografia aggiornata!", "success");
});

profilePicForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = profilePicInput.files[0];
  if (!file) return setStatus("Seleziona un'immagine!");

  if (!file.type.startsWith("image/")) {
    return setStatus("Solo immagini!");
  }

  const fileExt = file.name.split(".").pop();

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

deleteProfPicBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  await updateDoc(doc(db, "users", currentUserId), {
    photoURL: "https://myfrem.friuliemergenze.it/assets/profile/defpic.png"
  });
});