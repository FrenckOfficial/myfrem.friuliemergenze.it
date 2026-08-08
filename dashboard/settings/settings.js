import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
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

async function getIpAddress() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("Errore nel recupero IP:", error);
    return "Non disponibile";
  }
}

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

  // Disabilita anche i controlli 2FA in modalità sola lettura
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
    setStatus("closePfpStatus", "pfpStatusBox", "pfpStatus", "Non puoi modificare in modalità sola lettura", "error");
    return;
  }

  const file = profilePicInput.files[0];
  if (!file) return setStatus("closePfpStatus", "pfpStatusBox", "pfpStatus", "Seleziona un'immagine!", "error");

  if (!file.type.startsWith("image/")) {
    return setStatus("closePfpStatus", "pfpStatusBox", "pfpStatus", "Solo immagini!", "error");
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

    setStatus("closePfpStatus", "pfpStatusBox", "pfpStatus", "Foto profilo aggiornata!", "success");
  } catch (err) {
    console.error(err);
    setStatus("closePfpStatus", "pfpStatusBox", "pfpStatus", `${"Errore upload: " + err.message}`, "error");
  }
});

copyProfileLinkBtn.addEventListener("click", () => {
  const profileLink = `https://myfrem.friuliemergenze.it/profile/?userid=${currentUserId}`;
  navigator.clipboard.writeText(profileLink);
  setStatus("closePStatus", "profileStatusBox", "profileStatus", "Link copiato!", "success");
})

saveFullNameBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("closeFNStatus", "fullNameStatusBox", "fullNameStatus", "Non puoi modificare in modalità sola lettura", "error");

  const newName = nameInput.value.trim();
  const newSurname = surnameInput.value.trim();
  if (newName.length < 3) return setStatus("closeFNStatus", "fullNameStatusBox", "fullNameStatus", "Minimo 3 caratteri!", "error");
  if (newSurname.length < 3) return setStatus("closeFNStatus", "fullNameStatusBox", "fullNameStatus", "Minimo 3 caratteri!", "error");

  await updateDoc(doc(db, "users", currentUserId), {
    name: newName,
    surname: newSurname,
  });

  setStatus("closeFNStatus", "fullNameStatusBox", "fullNameStatus", "Nome e cognome aggiornati!", "success");
});

saveUsernameBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("closeUserStatus", "usernameStatusBox", "usernameStatus", "Non puoi modificare in modalità sola lettura", "error");

  const newUsername = usernameInput.value.trim();
  if (newUsername.length < 3) return setStatus("closeUserStatus", "usernameStatusBox", "usernameStatus", "Minimo 3 caratteri!", "error");

  await updateDoc(doc(db, "users", currentUserId), {
    username: newUsername
  });

  setStatus("closeUserStatus", "usernameStatusBox", "usernameStatus", "Username aggiornato!", "success");
});

saveMailBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("closeMailStatus", "mailStatusBox", "mailStatus", "Non puoi modificare in modalità sola lettura", "error");

  const newMail = mailInput.value.trim();
  if (newMail.length < 5 || !newMail.includes("@")) return setStatus("closeMailStatus", "mailStatusBox", "mailStatus", "Inserisci una mail valida!", "error");

  await updateEmail(currentUser, newMail)

  await updateDoc(doc(db, "users", currentUserId), {
    email: newMail
  });

  setStatus("closeMailStatus", "mailStatusBox", "mailStatus", "E-Mail aggiornata!", "success");
});

savePhoneBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("closePhoneStatus", "phoneStatusBox", "phoneStatus", "Non puoi modificare in modalità sola lettura", "error");

  const newPhone = phoneInput.value.trim();

  await updateDoc(doc(db, "users", currentUserId), {
    phone: newPhone
  });

  setStatus("closePhoneStatus", "phoneStatusBox", "phoneStatus", "Numero di telefono aggiornato!", "success");
})

saveBioBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("closeBioStatus", "bioStatusBox", "bioStatus", "Non puoi modificare in modalità sola lettura", "error");

  const newBio = bioInput.value.trim();

  await updateDoc(doc(db, "users", currentUserId), {
    bio: newBio
  });

  setStatus("closeBioStatus", "bioStatusBox", "bioStatus", "Biografia aggiornata!", "success");
});

savePasswordBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("closePswStatus", "pswStatusBox", "pswStatus", "Non puoi modificare in modalità sola lettura", "error");

  try {
    const user = auth.currentUser;

    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    await sendPasswordResetEmail(auth, user.email);

    await updateDoc(doc(db, "users", currentUserId), {
      passwordUpdatedAt: new Date()
    });

    setStatus("closePswStatus", "pswStatusBox", "pswStatus", "Link inviato con successo!", "success");
  } catch (error) {
    setStatus("closePswStatus", "pswStatusBox", "pswStatus", `${"Errore password: " + error.message}`, "error");
  }
});

async function loadPreferences() {
  try {
    const userRef = doc(db, "users", currentUserId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    if (userData) {
      emailNotificationsCheckbox.checked = userData.emailNotifications || false;
      newsletterCheckbox.checked = userData.newsSubbed || false;
      publicProfileCheckbox.checked = userData.publicProfile || false;
    }
  } catch (error) {
    console.error("Errore nel caricamento preferenze:", error);
  }
}

savePreferencesBtn.addEventListener("click", async () => {
  if (isReadOnlyMode) return setStatus("closePrefStatus", "prefStatusBox", "prefStatus", "Non puoi modificare in modalità sola lettura", "error");

  try {
    const userRef = doc(db, "users", currentUserId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    await updateDoc(userRef, {
      emailNotifications: emailNotificationsCheckbox.checked,
      newsSubbed: newsletterCheckbox.checked,
      privateProfile: publicProfileCheckbox.checked
    });
    
    const newsRef = collection(db, "newsletterSubs");
    const existingQuery = query(newsRef, where("email", "==", userData.email));
    const existingDoc = await getDocs(existingQuery);

    if (newsletterCheckbox.checked) {
      if (existingDoc.empty) {
        const token = crypto.randomUUID();
        await addDoc(newsRef, {
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
          link: `https://www.friuliemergenze.it/newsletter/confirm/?token=${token}`
        });

        setStatus("closePrefStatus", "prefStatusBox", "prefStatus", "Preferenze salvate! E-mail di conferma inviata!", "success");
      } else {
        setStatus("closePrefStatus", "prefStatusBox", "prefStatus", "Preferenze salvate!", "success");
      }
    } else {
      if (!existingDoc.empty) {
        await deleteDoc(doc(db, "newsletterSubs", existingDoc.docs[0].id));
      }
      setStatus("closePrefStatus", "prefStatusBox", "prefStatus", "Preferenze salvate!", "success");
    }
  } catch (error) {
    console.error("Errore:", error);
    setStatus("closePrefStatus", "prefStatusBox", "prefStatus", "Errore nel salvataggio", "error");
  }
});

let settings2FASetup = {
  method: null,
  emailVerified: false,
  totpVerified: false,
  totpSecret: null,
  recoveryCodes: [],
  emailCode: null
};

async function load2FAStatus() {
  try {
    const statusEl = document.getElementById("twofa-current-status");
    if (!statusEl) return; // sezione non presente in questa pagina

    const userRef = doc(db, "users", currentUserId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    const methodEl = document.getElementById("twofa-method-display");
    const enableBtn = document.getElementById("enable-twofa-btn");
    const disableBtn = document.getElementById("disable-twofa-btn");
    const regenerateBtn = document.getElementById("regenerate-recovery-btn");

    if (userData && userData.twoFactorEnabled) {
      statusEl.innerHTML = `<span style="color: #4fca7a;">✓ Abilitato</span>`;

      let methodText = "";
      if (userData.twoFactorMethod === "email") {
        methodText = "📧 Email";
      } else if (userData.twoFactorMethod === "totp") {
        methodText = "📱 App Authenticator";
      }
      methodEl.innerHTML = `<p style="color: var(--muted, #7a8fa6);">${methodText}</p>`;

      enableBtn.style.display = "none";
      disableBtn.style.display = isReadOnlyMode ? "none" : "block";
      regenerateBtn.style.display = isReadOnlyMode ? "none" : "block";
    } else {
      statusEl.innerHTML = `<span style="color: var(--muted, #7a8fa6);">Non abilitato</span>`;
      methodEl.innerHTML = "";

      enableBtn.style.display = isReadOnlyMode ? "none" : "block";
      disableBtn.style.display = "none";
      regenerateBtn.style.display = "none";
    }
  } catch (error) {
    console.error("❌ Errore caricamento stato 2FA:", error);
    const statusEl = document.getElementById("twofa-current-status");
    if (statusEl) {
      statusEl.innerHTML = `<span style="color: #e84855;">Errore caricamento</span>`;
    }
  }
}

const enableTwofaBtn = document.getElementById("enable-twofa-btn");
if (enableTwofaBtn) {
  enableTwofaBtn.addEventListener("click", () => {
    if (isReadOnlyMode) return;

    document.getElementById("enable-twofa-modal").style.display = "flex";
    settings2FASetup = {
      method: null,
      emailVerified: false,
      totpVerified: false,
      totpSecret: null,
      recoveryCodes: [],
      emailCode: null
    };
    document.querySelectorAll('input[name="settings-twofa-method"]').forEach(r => r.checked = false);
    document.getElementById("settings-email-setup").style.display = "none";
    document.getElementById("settings-totp-setup").style.display = "none";
    document.getElementById("settings-recovery-codes-section").style.display = "none";
  });
}

document.getElementById("close-enable-modal")?.addEventListener("click", () => {
  document.getElementById("enable-twofa-modal").style.display = "none";
});

document.querySelectorAll(".twofa-modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if (e.target.classList.contains("twofa-modal-overlay")) {
      e.target.closest(".twofa-modal").style.display = "none";
    }
  });
});

document.querySelectorAll('input[name="settings-twofa-method"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    settings2FASetup.method = e.target.value;
    showSettingsTwoFASection();
  });
});

function showSettingsTwoFASection() {
  document.getElementById("settings-email-setup").style.display = "none";
  document.getElementById("settings-totp-setup").style.display = "none";
  document.getElementById("settings-recovery-codes-section").style.display = "none";

  if (settings2FASetup.method === "email") {
    document.getElementById("settings-email-setup").style.display = "block";
  } else if (settings2FASetup.method === "totp") {
    document.getElementById("settings-totp-setup").style.display = "block";
    initSettingsTOTPSetup();
  }
}

document.getElementById("settings-email-send")?.addEventListener("click", async () => {
  const btn = document.getElementById("settings-email-send");
  const status = document.getElementById("settings-email-status");
  const form = document.getElementById("settings-email-form");

  btn.disabled = true;
  status.textContent = "Invio codice...";
  status.style.color = "var(--muted, #7a8fa6)";

  try {
    settings2FASetup.emailCode = String(Math.floor(100000 + Math.random() * 900000));

    const response = await fetch("/api/send2FACode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        userName: `${pendingLogin.userData.name} ${pendingLogin.userData.surname}`,
        email: currentUser.email,
        ip: await getIpAddress(),
        code: settings2FASetup.emailCode
      })
    });

    status.textContent = "Codice inviato!";
    status.style.color = "#4fca7a";
    form.style.display = "block";
  } catch (error) {
    console.error("Errore invio email:", error);
    status.textContent = "Errore nell'invio del codice";
    status.style.color = "#e84855";
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("settings-email-verify")?.addEventListener("click", () => {
  const inputCode = document.getElementById("settings-email-code").value.trim();
  const status = document.getElementById("settings-email-status");

  if (inputCode === settings2FASetup.emailCode) {
    settings2FASetup.emailVerified = true;
    document.getElementById("settings-email-form").style.display = "none";
    document.getElementById("settings-email-send").style.display = "none";
    document.getElementById("settings-email-success").style.display = "block";

    generateSettingsRecoveryCodes();
    showSettingsRecoveryCodes();
  } else {
    status.textContent = "Codice errato";
    status.style.color = "#e84855";
  }
});

function initSettingsTOTPSetup() {
  if (settings2FASetup.totpSecret) return;

  const secret = generateTOTPSecret();
  settings2FASetup.totpSecret = secret;

  document.getElementById("settings-totp-secret").textContent = secret;

  const otpauthUrl = `otpauth://totp/MyFrEM:${currentUser.email}?secret=${secret}&issuer=MyFrEM`;

  document.getElementById("settings-qrcode").innerHTML = "";
  new QRCode(document.getElementById("settings-qrcode"), {
    text: otpauthUrl,
    width: 200,
    height: 200,
    colorDark: "#00d4e8",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function generateTOTPSecret() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  return secret;
}

async function verifyTOTPCode(secret, code) {
  try {
    const result = await otplib.verify({ secret, token: code });
    return result.valid;
  } catch (e) {
    console.error("Errore verifica TOTP:", e);
    return false;
  }
}

document.getElementById("settings-totp-verify")?.addEventListener("click", async () => {
  const inputCode = document.getElementById("settings-totp-code").value.trim();
  const status = document.getElementById("settings-totp-status");

  if (inputCode.length !== 6 || !/^\d{6}$/.test(inputCode)) {
    status.textContent = "Inserisci 6 cifre";
    status.style.color = "#e84855";
    return;
  }

  if (await verifyTOTPCode(settings2FASetup.totpSecret, inputCode)) {
    settings2FASetup.totpVerified = true;
    document.getElementById("settings-totp-verify").disabled = true;
    document.getElementById("settings-totp-success").style.display = "block";

    generateSettingsRecoveryCodes();
    showSettingsRecoveryCodes();
  } else {
    status.textContent = "Codice errato";
    status.style.color = "#e84855";
  }
});

function generateSettingsRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const code = Array(8)
      .fill(0)
      .map(() => Math.floor(Math.random() * 10))
      .join("");
    codes.push(code);
  }
  settings2FASetup.recoveryCodes = codes;
}

function showSettingsRecoveryCodes() {
  const container = document.getElementById("settings-recovery-codes-display");
  container.innerHTML = settings2FASetup.recoveryCodes
    .map(code => `<div style="padding: 0.5rem 0.75rem; background: rgba(0, 212, 232, 0.08); border-radius: 4px; margin-bottom: 0.75rem; border: 1px solid rgba(0, 212, 232, 0.15);">${code}</div>`)
    .join("");

  document.getElementById("settings-recovery-codes-section").style.display = "block";
}

document.getElementById("settings-recovery-download")?.addEventListener("click", () => {
  const content = `Recovery Codes - MyFrEM\n${"=".repeat(40)}\n\nSalva questi codici in un luogo sicuro!\n\n${settings2FASetup.recoveryCodes.join("\n")}\n\nGenerato il: ${new Date().toLocaleString()}`;

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `myfrem-recovery-codes-${Date.now()}.txt`;
  a.click();
});

document.getElementById("settings-recovery-copy")?.addEventListener("click", () => {
  const text = settings2FASetup.recoveryCodes.join("\n");
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("settings-recovery-copy");
    const original = btn.textContent;
    btn.textContent = "✓ Copiato!";
    setTimeout(() => {
      btn.textContent = original;
    }, 2000);
  });
});

document.getElementById("settings-recovery-confirmed")?.addEventListener("change", () => {
  const btn = document.getElementById("settings-enable-final-btn");
  if (document.getElementById("settings-recovery-confirmed").checked) {
    btn.style.display = "block";
  } else {
    btn.style.display = "none";
  }
});

document.getElementById("settings-enable-final-btn")?.addEventListener("click", async () => {
  const btn = document.getElementById("settings-enable-final-btn");
  btn.disabled = true;
  btn.textContent = "Abilitazione in corso...";

  try {
    const twoFAData = {
      twoFactorEnabled: true,
      twoFactorMethod: settings2FASetup.method,
      recoveryCodes: settings2FASetup.recoveryCodes,
      usedRecoveryCodes: []
    };

    if (settings2FASetup.method === "totp") {
      twoFAData.totpSecret = settings2FASetup.totpSecret;
    }

    await updateDoc(doc(db, "users", currentUserId), twoFAData);

    setStatus("closeTwofaStatus", "twofaStatusBox", "twofaStatus", "2FA abilitato con successo!", "success");
    document.getElementById("enable-twofa-modal").style.display = "none";

    await load2FAStatus();
  } catch (error) {
    console.error("Errore abilitazione 2FA:", error);
    setStatus("closeTwofaStatus", "twofaStatusBox", "twofaStatus", "Errore nell'abilitazione di 2FA", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Abilita 2FA";
  }
});

document.getElementById("disable-twofa-btn")?.addEventListener("click", () => {
  if (isReadOnlyMode) return;
  document.getElementById("disable-twofa-modal").style.display = "flex";
});

document.getElementById("close-disable-modal")?.addEventListener("click", () => {
  document.getElementById("disable-twofa-modal").style.display = "none";
});

document.getElementById("cancel-disable-btn")?.addEventListener("click", () => {
  document.getElementById("disable-twofa-modal").style.display = "none";
});

document.getElementById("disable-verify-btn")?.addEventListener("click", async () => {
  const code = document.getElementById("disable-twofa-code").value.trim();
  const status = document.getElementById("disable-verify-status");
  const btn = document.getElementById("disable-verify-btn");

  if (!code) {
    status.textContent = "Inserisci il codice";
    status.style.color = "#e84855";
    return;
  }

  btn.disabled = true;
  status.textContent = "Verifica in corso...";

  try {
    const userRef = doc(db, "users", currentUserId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    let verified = false;

    if (userData.twoFactorMethod === "totp") {
      verified = await verifyTOTPCode(userData.totpSecret, code);
    } else if (userData.twoFactorMethod === "email") {
      verified = true;
    }

    if (verified) {
      await updateDoc(userRef, {
        twoFactorEnabled: false,
        twoFactorMethod: null,
        totpSecret: null
      });

      setStatus("closeTwofaStatus", "twofaStatusBox", "twofaStatus", "2FA disabilitato con successo!", "success");
      document.getElementById("disable-twofa-modal").style.display = "none";
      document.getElementById("disable-twofa-code").value = "";

      await load2FAStatus();
    } else {
      status.textContent = "Codice errato";
      status.style.color = "#e84855";
    }
  } catch (error) {
    console.error("Errore disabilitazione 2FA:", error);
    status.textContent = "Errore nella disabilitazione";
    status.style.color = "#e84855";
  } finally {
    btn.disabled = false;
    btn.textContent = "Verifica e disabilita";
  }
});

document.getElementById("regenerate-recovery-btn")?.addEventListener("click", () => {
  if (isReadOnlyMode) return;
  document.getElementById("regenerate-modal").style.display = "flex";
});

document.getElementById("close-regenerate-modal")?.addEventListener("click", () => {
  document.getElementById("regenerate-modal").style.display = "none";
});

document.getElementById("cancel-regenerate-btn")?.addEventListener("click", () => {
  document.getElementById("regenerate-modal").style.display = "none";
});

document.getElementById("verify-regenerate-btn")?.addEventListener("click", async () => {
  const code = document.getElementById("regenerate-code").value.trim();
  const status = document.getElementById("regenerate-status");
  const btn = document.getElementById("verify-regenerate-btn");

  if (!code) {
    status.textContent = "Inserisci il codice";
    status.style.color = "#e84855";
    return;
  }

  btn.disabled = true;
  status.textContent = "Verifica in corso...";

  try {
    const userRef = doc(db, "users", currentUserId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    let verified = false;

    if (userData.twoFactorMethod === "totp") {
      verified = await verifyTOTPCode(userData.totpSecret, code);
    } else if (userData.twoFactorMethod === "email") {
      verified = true;
    }

    if (verified) {
      const newCodes = [];
      for (let i = 0; i < 5; i++) {
        newCodes.push(Array(8).fill(0).map(() => Math.floor(Math.random() * 10)).join(""));
      }

      await updateDoc(userRef, {
        recoveryCodes: newCodes,
        usedRecoveryCodes: []
      });

      const container = document.getElementById("new-recovery-codes-display");
      container.innerHTML = newCodes
        .map(c => `<div style="padding: 0.5rem 0.75rem; background: rgba(0, 212, 232, 0.08); border-radius: 4px; margin-bottom: 0.75rem; border: 1px solid rgba(0, 212, 232, 0.15);">${c}</div>`)
        .join("");
      container.style.display = "block";

      document.getElementById("regenerate-actions").style.display = "flex";
      document.getElementById("regenerate-code").style.display = "none";
      btn.style.display = "none";

      status.textContent = "✓ Nuovi codici generati!";
      status.style.color = "#4fca7a";

      document.getElementById("regenerate-download").onclick = () => {
        const content = `Recovery Codes Rigenerati - MyFrEM\n${"=".repeat(40)}\n\n${newCodes.join("\n")}\n\nGenerato il: ${new Date().toLocaleString()}`;
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `myfrem-recovery-codes-${Date.now()}.txt`;
        a.click();
      };

      document.getElementById("regenerate-copy").onclick = () => {
        navigator.clipboard.writeText(newCodes.join("\n")).then(() => {
          const cpBtn = document.getElementById("regenerate-copy");
          const original = cpBtn.textContent;
          cpBtn.textContent = "✓ Copiato!";
          setTimeout(() => cpBtn.textContent = original, 2000);
        });
      };
    } else {
      status.textContent = "Codice errato";
      status.style.color = "#e84855";
    }
  } catch (error) {
    console.error("Errore rigenerazione codici:", error);
    status.textContent = "Errore nella rigenerazione";
    status.style.color = "#e84855";
  } finally {
    btn.disabled = false;
    btn.textContent = "Verifica e rigenera";
  }
});

document.getElementById("settings-copy-secret")?.addEventListener("click", () => {
  const secret = document.getElementById("settings-totp-secret").textContent;
  navigator.clipboard.writeText(secret).then(() => {
    const btn = document.getElementById("settings-copy-secret");
    const original = btn.textContent;
    btn.textContent = "✓ Copiato!";
    setTimeout(() => {
      btn.textContent = original;
    }, 2000);
  });
});

// ============================
// FINE BLOCCO 2FA IMPOSTAZIONI
// ============================

async function loadUserBadgesSettings() {
  try {
    const badgesRef = collection(db, "users", currentUserId, "badges");
    const badgesSnap = await getDocs(badgesRef);
 
    const badgesContainer = document.getElementById("userBadgesContainer");
    if (!badgesContainer) {
      console.warn("Container badge non trovato, saltando");
      return;
    }
 
    badgesContainer.innerHTML = "";
 
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

function setStatus(closeBox, statusBox, statusMsg, message, type = "info") {
  const classNameBox = document.querySelector(`${"." + statusBox}`);
  if (!statusMsg) return;
  document.getElementById(`${statusMsg}`).textContent = message;
  classNameBox.className = `${"statusBox" + " " + statusBox + " " + type}`;
  classNameBox.style.display = "block";
  const closeBtn = document.getElementById(closeBox);
  closeBtn.onclick = () => {
    classNameBox.style.display = "none";
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