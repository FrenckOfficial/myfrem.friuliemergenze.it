import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { supa } from "/configSupabase.js";
import { firebaseConfig } from "../../configFirebase.js";

const supabase = createClient(supa.url, supa.anonKey);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const profilePicInput = document.getElementById("profilePicInput");
const profilePicForm = document.getElementById("profilePicForm");
const profilePreview = document.getElementById("profilePreview");
const deleteProfPicBtn = document.getElementById("deleteProfPicBtn");

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
const bioText = document.getElementById("bioText");
const saveBioBtn = document.getElementById("saveBioBtn");

const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const savePasswordBtn = document.getElementById("savePasswordBtn");

const logoutBtn = document.getElementById("logoutBtn");
const logoutBtnSettings = document.getElementById("logoutBtnSettings");

let currentUserId = null;
let currentUser = null;
let isReadOnlyMode = false;

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

  // 🔒 Controlla il ruolo
  if (data.role === "testacc") {
    isReadOnlyMode = true;
    document.body.classList.add("read-only-mode");
    disableAllButtons();
    setStatus("readOnlyStatus", "📖 Modalità sola lettura: non puoi modificare i dati", "warning");
  }

  fullNameText.innerHTML = `<b>${data.name || ""} ${data.surname || ""}</b>`;
  userText.innerHTML = `<b>${data.username}</b>` || "";
  mailText.innerHTML = `<b>${data.email}</b>` || "";
  bioText.innerHTML = `<b>${data.bio ? data.bio : ""}</b>` || "";
  if (data.photoURL) {
    profilePreview.src = data.photoURL;
  } else {
    profilePreview.src = "https://myfrem.friuliemergenze.it/assets/profile/defpic.png"
  }
}

function disableAllButtons() {
  const buttons = [
    saveFullNameBtn,
    saveUsernameBtn,
    saveMailBtn,
    saveBioBtn,
    savePasswordBtn
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
}

saveFullNameBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("fullNameStatus", "❌ Non puoi modificare in modalità sola lettura", "error");

  const newName = nameInput.value.trim();
  const newSurname = surnameInput.value.trim();
  if (newName.length < 3) return setStatus("fullNameStatus", "Minimo 3 caratteri!", "error");
  if (newSurname.length < 3) return setStatus("fullNameStatus", "Minimo 3 caratteri!", "error");

  await updateDoc(doc(db, "users", currentUserId), {
    name: newName,
    surname: newSurname,
  });

  setStatus("fullNameStatus", "Nome e cognome aggiornati!", "success");
});

saveUsernameBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("usernameStatus", "❌ Non puoi modificare in modalità sola lettura", "error");

  const newUsername = usernameInput.value.trim();
  if (newUsername.length < 3) return setStatus("usernameStatus", "Minimo 3 caratteri!", "error");

  await updateDoc(doc(db, "users", currentUserId), {
    username: newUsername
  });

  setStatus("usernameStatus", "Username aggiornato!", "success");
});

saveMailBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("mailStatus", "❌ Non puoi modificare in modalità sola lettura", "error");

  const newMail = mailInput.value.trim();
  if (newMail.length < 5 || !newMail.includes("@")) return setStatus("mailStatus", "Inserisci una mail valida!", "error");

  await updateEmail(currentUser, newMail)

  await updateDoc(doc(db, "users", currentUserId), {
    email: newMail
  });

  setStatus("mailStatus", "E-Mail aggiornato!", "success");
});

saveBioBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("bioStatus", "❌ Non puoi modificare in modalità sola lettura", "error");

  const newBio = bioInput.value.trim();

  await updateDoc(doc(db, "users", currentUserId), {
    bio: newBio
  });

  setStatus("bioStatus", "Biografia aggiornata!", "success");
});

savePasswordBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("pswStatus", "❌ Non puoi modificare in modalità sola lettura", "error");

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!currentPassword) return setStatus("pswStatus", "Inserisci la password attuale!", "error");
  if (newPassword.length < 6) return setStatus("pswStatus", "Minimo 6 caratteri!", "error");
  if (newPassword !== confirmPassword) return setStatus("pswStatus", "Le password non coincidono!", "error");

  try {
    const user = auth.currentUser;

    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);

    await updateDoc(doc(db, "users", currentUserId), {
      passwordUpdatedAt: new Date()
    });

    setStatus("pswStatus", "Password aggiornata con successo!", "success");
  } catch (error) {
    setStatus("pswStatus", `${"Errore password: " + error.message}`, "error");
  }
});

profilePicForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isReadOnlyMode) {
    setStatus("pfpStatus", "❌ Non puoi modificare in modalità sola lettura", "error");
    return;
  }

  const file = profilePicInput.files[0];
  if (!file) return setStatus("pfpStatus", "Seleziona un'immagine!", "error");

  if (!file.type.startsWith("image/")) {
    return setStatus("pfpStatus", "Solo immagini!", "error");
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${currentUserId}/avatar.${fileExt}`;

  try {
    const fileBuffer = await file.arrayBuffer();

    const { error } = await supabase.storage
      .from("profilePic")
      .upload(filePath, fileBuffer, {
        upsert: true,
        contentType: file.type
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("profilePic")
      .getPublicUrl(filePath);

    const imageUrl = data.publicUrl;

    await updateDoc(doc(db, "users", currentUserId), {
      photoURL: imageUrl
    });

    profilePreview.src = imageUrl;

    setStatus("pfpStatus", "Foto profilo aggiornata!", "success");
  } catch (err) {
    console.error(err);
    setStatus("pfpStatus", `${"Errore upload: " + err.message}`, "error");
  }
});

function setStatus(statusId, message, type = "info") {
  const element = document.getElementById(statusId);
  if (!element) return;
  element.textContent = message;
  element.className = `${"statusBox" + " " + type}`;
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

logoutBtnSettings.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "/login/";
  });
});