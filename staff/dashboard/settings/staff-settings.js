import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../../configFirebase.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { supa } from "/configSupabase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const supabase = createClient(supa.url, supa.anonKey);

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

const bioInput = document.getElementById("bioInput");
const bioText = document.getElementById("bioText");
const saveBioBtn = document.getElementById("saveBioBtn");

const profilePicInput = document.getElementById("profilePicInput");
const profilePicForm = document.getElementById("profilePicForm");
const profilePreview = document.getElementById("profilePreview");
const deleteProfPicBtn = document.getElementById("deleteProfPicBtn");

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

  staffUsername.textContent = data.username || "Non disponibile.";
  staffName.textContent = `${data.name || ""} ${data.surname || ""}`.trim() || "Non disponibile.";
  staffEmail.innerHTML = data.email ? `<a href="mailto:${data.email}">${data.email}</a>` : "Non disponibile.";
  staffRole.textContent = data.role || "Non disponibile.";

  usernameText.textContent = data.username || "Non disponibile.";
  bioText.textContent = data.bio || "Non disponibile.";

  if (data.photoURL) {
    profilePreview.src = data.photoURL;
  }
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
    passwordStatusMsg.textContent = "❌ Le nuove password non coincidono!";
    passwordStatusMsg.className = "error";
    return;
  }

  try {
    const user = auth.currentUser;

    const credential = EmailAuthProvider.credential(user.email, current);
    await reauthenticateWithCredential(user, credential);

    await updatePassword(user, newP);

    passwordStatusMsg.textContent = "✅ Password cambiata con successo!";
    passwordStatusMsg.className = "success";

    changePasswordForm.reset();
  } catch (err) {
    passwordStatusMsg.textContent = "❌ Errore: " + err.message;
    passwordStatusMsg.className = "error";
  }
});

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

saveBioBtn.addEventListener("click", async () => {
  const newBio = bioInput.value.trim();

  await updateDoc(doc(db, "users", currentUserId), {
    bio: newBio
  });

  bioText.textContent = newBio;
  alert("Biografia aggiornata!");
});

profilePicForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = profilePicInput.files[0];
  if (!file) return alert("Seleziona un'immagine!");

  if (!file.type.startsWith("image/")) {
    return alert("Solo immagini!");
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

    alert("Foto profilo aggiornata!");
  } catch (err) {
    console.error(err);
    alert("Errore upload: " + err.message);
  }
});

deleteProfPicBtn.addEventListener("submit", async (e) => {
  e.preventDefault();

  await updateDoc(doc(db, "users", currentUserId), {
    photoURL: "https://myfrem.friuliemergenze.it/assets/profile/defpic.png"
  });
})