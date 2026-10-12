import { firebaseConfig } from "/helpers/configFirebase.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, deleteUser, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, where, limit, getDocs, getDoc, setDoc, addDoc, updateDoc, doc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

const allowedRoles = [
  "simplestaff",
  "modstaff",
  "advstaff",
  "advstaffplus",
  "superadmin"
];

let isRegistering = false;
let isLoggingIn = false;
let isRouting = false;

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const googleBtn = document.getElementById("googleLoginBtn");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const resendEmailBtn = document.getElementById("resendEmail");

const resetForm = document.getElementById("resetForm");
const resetEmail = document.getElementById("resetEmail");
const resetError = document.getElementById("error");
const resetSuccess = document.getElementById("success");
const resetButton = document.getElementById("resetEmailButton");

async function redirectByRole(role, userData) {
  if (allowedRoles.includes(role)) {
    if (userData?.lastDashSelected) {
      const dashboardMap = {
        "admin": "/staff/dashboard",
        "user": "/dashboard"
      };
      const dashboard = dashboardMap[userData.lastDashSelected];
      if (dashboard) {
        window.location.href = dashboard;
        return;
      }
    }
    openChooseDashboardModal();
  } else if (role === "association") {
    window.location.href = "/association/dashboard";
  } else {
    window.location.href = "/dashboard";
  }
}

function openChooseDashboardModal() {
  const modal = document.getElementById("chooseDashboardModal");
  const closeBtn = document.getElementById("closeChooseDashboardModal");
  modal.style.display = "";
  modal.classList.add('active');
  closeBtn.onclick = () => {
    modal.classList.remove('active');
  };

  const dashboardBtns = document.querySelectorAll('.dashboard-btn');
  dashboardBtns.forEach(btn => {
    btn.onclick = async () => {
      const dashboard = btn.getAttribute('data-dashboard');
      const dashboardType = btn.getAttribute('data-type');
      
      try {
        const user = auth.currentUser;
        if (user) {
          await updateDoc(doc(db, "users", user.uid), {
            lastDashSelected: dashboardType
          });
        }
      } catch (error) {
        console.error("Errore aggiornamento lastDashSelected:", error);
      }
      
      window.location.href = dashboard;
    };
  });
}

async function getUserByUsername(username) {
  const q = query(
    collection(db, "users"),
    where("username", "==", username),
    limit(1)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    return null;
  }

  return snap.docs[0].data();
}

async function getUserDoc(uid) {
  return await getDoc(doc(db, "users", uid));
}

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

async function createLoginLog(user) {
  await addDoc(collection(db, "logins"), {
    userId: user.uid,
    email: user.email,
    userAgent: navigator.userAgent,
    ipAddress: await getIpAddress(),
    timestamp: serverTimestamp()
  });

  console.table(
    (await getDocs(collection(db, "logins"))).docs.map((doc) => doc.data())
  );
}

async function validateAccount(userData) {
  if (!userData) {
    throw new Error("Profilo utente non trovato.");
  }

  if (userData.status === "sospeso") {
    throw new Error("Il tuo account è sospeso.");
  }

  if (userData.status === "eliminato") {
    throw new Error("Il tuo account è stato eliminato.");
  }
}

let pendingLogin = null;

const twofaLoginModal = document.getElementById("twofa-login-modal");
const twofaLoginDesc = document.getElementById("twofa-login-desc");
const twofaLoginEmailBlock = document.getElementById("twofa-login-email-block");
const twofaLoginResendBtn = document.getElementById("twofa-login-resend-email");
const twofaLoginCodeInput = document.getElementById("twofa-login-code");
const twofaLoginStatus = document.getElementById("twofa-login-status");
const twofaLoginVerifyBtn = document.getElementById("twofa-login-verify-btn");
const twofaLoginToggleRecovery = document.getElementById("twofa-login-toggle-recovery");
const twofaLoginCloseBtn = document.getElementById("closeTwoFALoginModal");

async function verifyTOTPLoginCode(secret, code) {
  try {
    const result = await otplib.verify({ secret, token: code });
    return result.valid;
  } catch (e) {
    console.error("Errore verifica TOTP login:", e);
    return false;
  }
}

function checkRecoveryCode(userData, code) {
  const codes = userData.recoveryCodes || [];
  return codes.includes(code);
}

async function sendLoginEmailCode() {
  if (!twofaLoginStatus || !pendingLogin) return;

  try {
    pendingLogin.emailCode = String(Math.floor(100000 + Math.random() * 900000));

    const token = await pendingLogin.user.getIdToken();

    const response = await fetch("/api/send2FACode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        userName: `${pendingLogin.userData.name} ${pendingLogin.userData.surname}`,
        email: pendingLogin.userData.email,
        ip: await getIpAddress(),
        code: pendingLogin.emailCode
      })
    });

    if (!response.ok) {
      throw new Error("Invio codice fallito");
    }

    twofaLoginStatus.textContent = "Codice inviato via email.";
    twofaLoginStatus.className = "success";
  } catch (error) {
    console.error("Errore invio codice 2FA login:", error);
    twofaLoginStatus.textContent = "Errore nell'invio del codice.";
    twofaLoginStatus.className = "error";
  }
}

function start2FAChallenge(user, userData) {
  if (!twofaLoginModal) {
    console.error("Modal 2FA login non trovato nel DOM.");
    return;
  }

  pendingLogin = { user, userData, usingRecovery: false, emailCode: null };

  twofaLoginCodeInput.value = "";
  twofaLoginCodeInput.maxLength = 6;
  twofaLoginCodeInput.placeholder = "000000";
  twofaLoginStatus.textContent = "";
  twofaLoginStatus.className = "";
  twofaLoginToggleRecovery.textContent = "Usa un recovery code";

  if (userData.twoFactorMethod === "totp") {
    twofaLoginDesc.textContent = "Inserisci il codice generato dalla tua app di autenticazione.";
    twofaLoginEmailBlock.style.display = "none";
    twofaLoginResendBtn.style.display = "none";
  } else if (userData.twoFactorMethod === "email") {
    twofaLoginDesc.textContent = "Ti abbiamo inviato un codice via email.";
    twofaLoginEmailBlock.style.display = "block";
    twofaLoginResendBtn.style.display = "inline";
    sendLoginEmailCode();
  }

  twofaLoginModal.style.display = "";
  twofaLoginModal.classList.add("active");
  twofaLoginCodeInput.focus();
}

if (twofaLoginVerifyBtn) {
  twofaLoginVerifyBtn.addEventListener("click", async () => {
    if (!pendingLogin) return;

    const code = twofaLoginCodeInput.value.trim();

    if (!code) {
      twofaLoginStatus.textContent = "Inserisci il codice";
      twofaLoginStatus.className = "error";
      return;
    }

    twofaLoginVerifyBtn.disabled = true;
    twofaLoginStatus.textContent = "Verifica in corso...";
    twofaLoginStatus.className = "";

    try {
      let verified = false;

      if (pendingLogin.usingRecovery) {
        verified = checkRecoveryCode(pendingLogin.userData, code);

        if (verified) {
          const remaining = (pendingLogin.userData.recoveryCodes || []).filter(c => c !== code);
          const used = [...(pendingLogin.userData.usedRecoveryCodes || []), code];

          await updateDoc(doc(db, "users", pendingLogin.user.uid), {
            recoveryCodes: remaining,
            usedRecoveryCodes: used
          });
        }
      } else if (pendingLogin.userData.twoFactorMethod === "totp") {
        verified = await verifyTOTPLoginCode(pendingLogin.userData.totpSecret, code);
      } else if (pendingLogin.userData.twoFactorMethod === "email") {
        verified = code === pendingLogin.emailCode;
      }

      if (!verified) {
        twofaLoginStatus.textContent = "Codice non valido.";
        twofaLoginStatus.className = "error";
        return;
      }

      const finishedUser = pendingLogin.user;
      const finishedUserData = pendingLogin.userData;

      twofaLoginModal.classList.remove("active");
      pendingLogin = null;

      await completeLogin(finishedUser, finishedUserData);
    } catch (error) {
      console.error("Errore verifica 2FA login:", error);
      twofaLoginStatus.textContent = "Errore durante la verifica.";
      twofaLoginStatus.className = "error";
    } finally {
      twofaLoginVerifyBtn.disabled = false;
    }
  });
}

if (twofaLoginToggleRecovery) {
  twofaLoginToggleRecovery.addEventListener("click", (e) => {
    e.preventDefault();
    if (!pendingLogin) return;

    pendingLogin.usingRecovery = !pendingLogin.usingRecovery;
    twofaLoginCodeInput.value = "";
    twofaLoginStatus.textContent = "";
    twofaLoginStatus.className = "";

    if (pendingLogin.usingRecovery) {
      twofaLoginDesc.textContent = "Inserisci uno dei tuoi recovery code.";
      twofaLoginToggleRecovery.textContent = "Usa invece il codice normale";
      twofaLoginEmailBlock.style.display = "none";
      twofaLoginCodeInput.maxLength = 8;
      twofaLoginCodeInput.placeholder = "00000000";
    } else {
      if (pendingLogin.userData.twoFactorMethod === "email") {
        twofaLoginDesc.textContent = "Ti abbiamo inviato un codice via email.";
        twofaLoginEmailBlock.style.display = "block";
      } else {
        twofaLoginDesc.textContent = "Inserisci il codice generato dalla tua app di autenticazione.";
      }
      twofaLoginToggleRecovery.textContent = "Usa un recovery code";
      twofaLoginCodeInput.maxLength = 6;
      twofaLoginCodeInput.placeholder = "000000";
    }
  });
}

if (twofaLoginResendBtn) {
  twofaLoginResendBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (pendingLogin && pendingLogin.userData.twoFactorMethod === "email" && !pendingLogin.usingRecovery) {
      sendLoginEmailCode();
    }
  });
}

if (twofaLoginCodeInput) {
  twofaLoginCodeInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") twofaLoginVerifyBtn?.click();
  });
}

if (twofaLoginCloseBtn) {
  twofaLoginCloseBtn.addEventListener("click", async () => {
    twofaLoginModal.classList.remove("active");
    if (pendingLogin) {
      await signOut(auth);
      pendingLogin = null;
    }
  });
}

const TEMP_PASS_RE = /^pass\d{4}$/;

const changePasswordModal = document.getElementById("changePasswordModal");
const newPasswordInput = document.getElementById("newPassword");
const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
const changePasswordStatus = document.getElementById("changePasswordStatus");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const closeChangePasswordModal = document.getElementById("closeChangePasswordModal");

function validateNewPassword(password, confirm) {
  if (password.length < 8) return "La password deve essere lunga almeno 8 caratteri.";
  if (!/[A-Z]/.test(password)) return "La password deve contenere almeno una lettera maiuscola.";
  if (!/[a-z]/.test(password)) return "La password deve contenere almeno una lettera minuscola.";
  if (!/[0-9]/.test(password)) return "La password deve contenere almeno un numero.";
  if (TEMP_PASS_RE.test(password)) return "Scegli una password diversa da quella temporanea.";
  if (password !== confirm) return "Le password inserite non corrispondono.";
  return null;
}

function requirePasswordChange(user) {
  return new Promise((resolve, reject) => {
    newPasswordInput.value = "";
    confirmNewPasswordInput.value = "";
    changePasswordStatus.textContent = "";
    changePasswordStatus.className = "";

    changePasswordModal.style.display = "";
    changePasswordModal.classList.add("active");
    newPasswordInput.focus();

    changePasswordBtn.onclick = async () => {
      const error = validateNewPassword(newPasswordInput.value, confirmNewPasswordInput.value);
      if (error) {
        changePasswordStatus.textContent = error;
        changePasswordStatus.className = "error";
        return;
      }

      changePasswordBtn.disabled = true;
      changePasswordStatus.textContent = "Salvataggio in corso...";
      changePasswordStatus.className = "";

      try {
        await updatePassword(user, newPasswordInput.value);
        await updateDoc(doc(db, "users", user.uid), { mustChangePassword: false });

        changePasswordModal.classList.remove("active");
        resolve();
      } catch (err) {
        console.error("Errore cambio password:", err);
        changePasswordStatus.textContent = "Errore nel salvataggio della password. Riprova.";
        changePasswordStatus.className = "error";
      } finally {
        changePasswordBtn.disabled = false;
      }
    };

    closeChangePasswordModal.onclick = async () => {
      changePasswordModal.classList.remove("active");
      await signOut(auth);
      reject(new Error("Devi cambiare la password temporanea per accedere."));
    };
  });
}

async function completeLogin(user, userData) {
  try {
    const token = await auth.currentUser.getIdToken();

    await fetch("/api/sendLoginMail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        email: user.email,
        name: (userData.name + " " + userData.surname) || "Utente",
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      })
    });
  } catch (error) {
    console.error("Errore notifica:", error);
  }

  await createLoginLog(user);

  redirectByRole(userData.role, userData);
}

if (loginForm) {
  document.getElementById("loginEmail")?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") loginForm.dispatchEvent(new Event("submit"));
  });
  document.getElementById("loginPassword")?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") loginForm.dispatchEvent(new Event("submit"));
  });
  loginForm.addEventListener("submit", async (e) => {
    submitBtn.disabled = true;
    btnText.textContent = "Accesso in corso..."
    btnLoader.style.display = 'inline-block';
    e.preventDefault();

    if (isLoggingIn) return;
    isLoggingIn = true;

    try {
      const identifier = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      let email = identifier;

      if (!identifier.includes("@")) {
        const userData = await getUserByUsername(identifier);
        if (!userData) throw new Error("Credenziali errate.");
        email = userData.email;
      }

      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      await user.reload();

      const userSnap = await getUserDoc(user.uid);
      const userData = userSnap.data();

      
      if (!userSnap.exists()) {
        await signOut(auth);
        throw new Error("Profilo non trovato.");
      }
      
      if (userData.emailVerified === false) {
        await signOut(auth);
        throw new Error("Verifica il tuo indirizzo email prima di accedere.");
      }

      await validateAccount(userData);

      if (TEMP_PASS_RE.test(password) || userData.mustChangePassword) {
        await requirePasswordChange(user);
      }

      if (userData.twoFactorEnabled) {
        submitBtn.disabled = false;
        btnText.textContent = "Accedi";
        btnLoader.style.display = "none";
        start2FAChallenge(user, userData);
        return;
      }

      await completeLogin(user, userData);

      btnText.style.display = 'inline-block';
      btnLoader.style.display = 'none';

    } catch (err) {
      btnText.textContent = "Accedi";
      switch (err.code) {
        case "auth/user-not-found":
          setStatus("Credenziali errate.", "error");
          break;
        case "auth/wrong-password":
          setStatus("Password errata.", "error");
          break;
        case "auth/invalid-credential":
          setStatus("Credenziali errate.", "error");
          break;
        default:
          setStatus(err.message, "error");
          break;
      }
      document.getElementById("loginPassword").value = "";
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = "Accedi";
      btnText.style.opacity = '1';
      btnLoader.style.display = 'none';
      isLoggingIn = false;
    }
  });
}

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      let userSnap = await getUserDoc(user.uid);

      if (!userSnap.exists()) {
        const nameParts = (user.displayName || "").split(" ");
        await addDoc(collection(db, "activities"), {
        	type: "user_creation",
          userName: `${nameParts[0]} ${nameParts.slice(1).join(" ")}`,
          timestamp: serverTimestamp()
        });
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          name: nameParts[0] || "",
          surname: nameParts.slice(1).join(" ") || "",
          username: user.email.split("@")[0],
          phone: "",
          role: "user",
          status: "attivo",
          newsSubbed: false,
          emailVerified: true,
          createdAt: serverTimestamp()
        });

        userSnap = await getUserDoc(user.uid);
      }

      const userData = userSnap.data();
      await validateAccount(userData);

      if (userData.twoFactorEnabled) {
        start2FAChallenge(user, userData);
        return;
      }

      await completeLogin(user, userData);

    } catch (err) {
      setStatus(err.message, "error");
      console.error(err);
    }
  });
}

if (resetForm) {
  document.getElementById("resetEmail")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") resetForm.dispatchEvent(new Event("submit"));
  });
  resetForm.addEventListener("submit", async (e) => {
    resetButton.disabled = true;
    btnText.textContent = "Invio in corso..."
    btnLoader.style.display = 'inline-block';
    e.preventDefault();

    resetError.textContent = "";
    resetSuccess.textContent = "";

    const email = resetEmail.value.trim();

    if (!email) {
      setStatus("Inserisci un indirizzo email valido.", "error");

      return;
    }

    try {
      resetButton.disabled = true;
      resetButton.textContent = "Invio in corso...";

      await sendPasswordResetEmail(auth, email);

      setStatus("Email di reset inviata. Controlla la tua casella di posta.", "success");

      resetForm.reset();

      btnText.style.display = 'inline-block';
      btnLoader.style.display = 'none';

    } catch (error) {
      btnText.textContent = "Invia link di reset";
      switch (error.code) {
        case "auth/user-not-found":
          setStatus("Nessun account trovato con questo indirizzo email.", "error");
          break;

        case "auth/invalid-email":
          setStatus("Indirizzo email non valido.", "error");
          break;

        case "auth/too-many-requests":
          setStatus("Troppi tentativi. Riprova più tardi.", "error");
          break;

        default:
          setStatus("Si è verificato un errore. Riprova.", "error");
          break;
      }

      console.error(error);

    } finally {
      resetButton.disabled = false;
      btnText.style.opacity = '1';
      btnLoader.style.display = 'none';
    }
  });
}

if (registerForm) {
  const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const el = (id) => document.getElementById(id);
  const steps = document.querySelectorAll(".step");
  const totalSteps = steps.length;
  const prevBtn = el("prevBtn");
  const nextBtn = el("nextBtn");

  let currentStep = 1;

  function showStep(step) {
    currentStep = step;

    steps.forEach((s) => {
      const active = Number(s.dataset.step) === step;
      s.style.display = active ? "block" : "none";
      s.classList.toggle("active", active);
    });

    el("stepCounter").textContent = `Passo ${step} di ${totalSteps}`;
    document.querySelector(".step-progress").style.width = `${(step / totalSteps) * 100}%`;

    prevBtn.style.display = step === 1 ? "none" : "block";
    nextBtn.style.display = step === totalSteps ? "none" : "block";
    submitBtn.style.display = step === totalSteps ? "block" : "none";
  }

  async function isUsernameTaken(username) {
    const snap = await getDocs(
      query(collection(db, "users"), where("username", "==", username), limit(1))
    );
    return !snap.empty;
  }

  async function validateStep(step) {
    if (step === 1) {
      if (!el("registerName").value.trim() || !el("registerSurname").value.trim()) {
        setStatus("Per iniziare la registrazione devi inserire nome e cognome.", "error");
        return false;
      }

      const username = el("registerUsername").value.trim().toLowerCase();

      if (!username) {
        setStatus("Devi scegliere uno username.", "error");
        return false;
      }

      if (!USERNAME_RE.test(username)) {
        setStatus("Lo username deve avere da 3 a 20 caratteri: lettere minuscole, numeri, punto, trattino o underscore.", "error");
        return false;
      }

      try {
        if (await isUsernameTaken(username)) {
          setStatus("Lo username inserito è già in uso.", "error");
          return false;
        }
      } catch (err) {
        console.error("Errore controllo username:", err);
        setStatus("Impossibile verificare lo username, riprova.", "error");
        return false;
      }
    }

    if (step === 2) {
      const email = el("registerEmail").value.trim();
      const password = el("registerPassword").value;
      const confirm = el("registerConfirmPassword").value;

      if (!email) {
        setStatus("Devi inserire un indirizzo email.", "error");
        return false;
      }

      if (!EMAIL_RE.test(email)) {
        setStatus("L'email inserita non è valida.", "error");
        return false;
      }

      if (!password) {
        setStatus("Devi scegliere una password.", "error");
        return false;
      }

      if (password.length < 8) {
        setStatus("La password deve essere lunga almeno 8 caratteri.", "error");
        return false;
      }

      if (!/[A-Z]/.test(password)) {
        setStatus("La password deve contenere almeno una lettera maiuscola.", "error");
        return false;
      }

      if (!/[a-z]/.test(password)) {
        setStatus("La password deve contenere almeno una lettera minuscola.", "error");
        return false;
      }

      if (!/[0-9]/.test(password)) {
        setStatus("La password deve contenere almeno un numero.", "error");
        return false;
      }

      if (password !== confirm) {
        setStatus("Le password inserite non corrispondono.", "error");
        return false;
      }
    }

    return true;
  }

  nextBtn.addEventListener("click", async () => {
    nextBtn.disabled = true;
    try {
      if (await validateStep(currentStep)) showStep(currentStep + 1);
    } finally {
      nextBtn.disabled = false;
    }
  });

  prevBtn.addEventListener("click", () => showStep(currentStep - 1));

  document.querySelectorAll(".toggle-password[data-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = el(btn.dataset.target);
      const icon = btn.querySelector("i");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      icon.classList.toggle("fa-eye", !show);
      icon.classList.toggle("fa-eye-slash", show);
    });
  });

  showStep(1);

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (currentStep < totalSteps) {
      nextBtn.click();
      return;
    }

    if (isRegistering) return;
    if (!(await validateStep(1)) || !(await validateStep(2))) return;

    isRegistering = true;
    submitBtn.disabled = true;
    btnText.textContent = "Registrazione in corso...";
    btnLoader.style.display = "inline-block";

    let createdUser = null;
    let committed = false;

    try {
      const name = el("registerName").value.trim();
      const surname = el("registerSurname").value.trim();
      const username = el("registerUsername").value.trim().toLowerCase();
      const email = el("registerEmail").value.trim();
      const password = el("registerPassword").value;
      const phone = "";

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = cred.user;
      const uid = createdUser.uid;

      const token = crypto.randomUUID();
      const verifyLink = `https://myfrem.friuliemergenze.it/verify-email?token=${token}`;

      const batch = writeBatch(db);

      batch.set(doc(db, "users", uid), {
        email,
        name,
        surname,
        username,
        phone,
        role: "user",
        status: "inattivo",
        newsSubbed: false,
        emailVerified: false,
        verifyLink: verifyLink,
        createdAt: serverTimestamp(),
        firstAccess: true,
        twoFactorEnabled: false,
        twoFactorMethod: null
      });

      batch.set(doc(db, "emailVerifications", token), {
        email,
        userId: uid,
        expiresAt: Date.now() + 86400000,
        used: false
      });

      batch.set(doc(collection(db, "activities")), {
        type: "user_creation",
        userName: `${name} ${surname}`,
        timestamp: serverTimestamp()
      });

      await batch.commit();
      committed = true;

      const htmlContent = buildEmail({ verifyLink, email, name });
      const staffContent = buildStaffEmail({ name, surname, email, username, phone, verifyLink });

      const response = await fetch("https://myfrem.api.friuliemergenze.it/api/sendVerificationEmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userName: `${name} ${surname}`,
          userEmail: email,
          htmlContent
        })
      });

      fetch("/api/sendStaffNewUserEmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userName: `${name} ${surname}`,
          staffContent
        })
      })
        .then((r) => {
          if (!r.ok) console.error("Errore invio email staff:", r.status);
        })
        .catch((err) => console.error("Errore invio email staff:", err));

      await signOut(auth);
      localStorage.setItem("email", email);

      if (!response.ok) {
        setStatus("Account creato, ma l'invio dell'email di verifica non è riuscito. Nella prossima pagina potrai richiederne un nuovo invio.", "error");
        setTimeout(() => {
          window.location.href = "/auth/confirm-email";
        }, 3000);
        return;
      }

      setStatus("L'email di verifica è stata inviata con successo all'indirizzo fornito!", "success");
      window.location.href = "/auth/confirm-email";

    } catch (err) {
      console.error(err);

      if (createdUser && !committed) {
        try {
          await deleteUser(createdUser);
        } catch (cleanupErr) {
          console.error("Pulizia utente non riuscita:", cleanupErr);
        }
      }

      btnText.textContent = "Registrazione fallita";
      switch (err.code) {
        case "auth/email-already-in-use":
          setStatus("L'email inserita è già in uso da un altro account.", "error");
          break;
        case "auth/invalid-email":
          setStatus("L'email inserita non risulta valida.", "error");
          break;
        case "auth/weak-password":
          setStatus("La password inserita non risulta sufficientemente sicura.", "error");
          break;
        case "auth/missing-password":
          setStatus("Per poter registrarti devi inserire una password per il tuo account.", "error");
          break;
        case "permission-denied":
          setStatus("Non è stato possibile completare la registrazione (permessi insufficienti). Riprova più tardi.", "error");
          break;
        default:
          setStatus("C'è stato un errore durante la registrazione.", "error");
      }
    } finally {
      isRegistering = false;
      submitBtn.disabled = false;
      btnText.textContent = "Registrati";
      btnLoader.style.display = "none";
    }
  });
}

resendEmailBtn?.addEventListener("click", async () => {
  const email = localStorage.getItem("email");
  
  if (!email) {
    setStatus("Dati utente incompleti.", "error");
    return;
  }

  try {
    const userQuery = query(collection(db, "users"), where("email", "==", email), limit(1));
    const userSnap = await getDocs(userQuery);

    if (userSnap.empty) {
      setStatus("Utente non trovato.", "error");
      return;
    }

    const userDoc = userSnap.docs[0];
    const userData = userDoc.data();

    if (!userData?.verifyLink || !userData?.email) {
      setStatus("Dati utente incompleti.", "error");
      return;
    }

    const response = await fetch("https://myfrem.api.friuliemergenze.it/api/sendVerificationEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: `${userData.name} ${userData.surname}`,
        userEmail: userData.email,
        htmlContent: buildEmail({ verifyLink: userData.verifyLink, email: userData.email, name: userData.name })
      })
    });

    if (!response.ok) {
      setStatus("Errore reinvio email di verifica.", "error");
      return;
    }

    setStatus("Email reinviata! Controlla la tua casella di posta elettronica.", "success");

  } catch (error) {
    setStatus("Errore durante il reinvio.", "error");
    console.error(error);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (loginForm) document.getElementsByTagName("main")[0].style.display = "grid";
    if (registerForm) document.getElementsByTagName("main")[0].style.display = "grid";
    if (resetForm) document.getElementsByTagName("main")[0].style.display = "grid";

    return
  };

  if (isRegistering || isLoggingIn || isRouting) return

  if (pendingLogin) return

  const path = window.location.pathname;

  const blockedPaths = [
    "/auth/signin/",
    "/auth/signup/",
    "/auth/reset-your-password/",
    "/auth/signin",
    "/auth/signup",
    "/auth/reset-your-password"
  ];

  const isInLoginPage = blockedPaths.some((p) => path.startsWith(p));
  
  if (isInLoginPage) {
    try {
      isRouting = true;
      const userSnap = await getUserDoc(user.uid);

      if (!userSnap.exists()) {
        return;
      }

      const userData = userSnap.data();
      redirectByRole(userData.role, userData);
    } catch (err) {
      console.error(err);
    } finally {
      isRouting = false;
    }
    return;
  }
});

function buildEmail({ verifyLink, email, name }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">

            <table style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
              <tr>
                <td style="padding:35px;text-align:center;">

                  <img
                    src="https://www.friuliemergenze.it/assets/logo.png"
                    style="width:80px;margin-bottom:20px;"
                    loading="lazy"
                  >

                  <h1 style="color:#ff3b3b;margin:0;font-size:28px;">
                    Verifica il tuo account
                  </h1>

                  <p style="font-size:18px;color:#333;margin-top:25px;">
                    Ciao <b>${name}</b>,
                  </p>

                  <p style="color:#555;line-height:1.7;font-size:17px;margin-top:20px;">
                    Benvenuto su <b>MyFrEM</b>.<br><br>

                    Per completare la registrazione e verificare l'indirizzo email
                    <b>${email}</b>,
                    clicca sul pulsante qui sotto.
                  </p>

                  <a
                    href="${verifyLink}"
                    style="
                      display:inline-block;
                      padding:15px 24px;
                      background:#ff3b3b;
                      color:#ffffff;
                      text-decoration:none;
                      border-radius:10px;
                      font-weight:bold;
                      margin-top:25px;
                      font-size:16px;
                    "
                  >
                    Verifica account
                  </a>

                  <p style="color:#888;font-size:13px;margin-top:25px;line-height:1.6;">
                    Se il pulsante non funziona, copia questo link nel browser:
                    <br><br>

                    <a
                      href="${verifyLink}"
                      style="color:#ff3b3b;"
                    >
                      ${verifyLink}
                    </a>
                  </p>

                  <p style="font-size:11px;color:#999;margin-top:25px;line-height:1.5;">
                    MyFrEM · Friuli Emergenze<br>
                    Hai ricevuto questa email perché è stato creato un account con questo indirizzo.<br>
                    Se non sei stato tu, puoi ignorare questa email.
                    <br><br>

                    <a href="https://friuliemergenze.it">
                      friuliemergenze.it
                    </a>

                    ·

                    <a href="mailto:info@friuliemergenze.it">
                      info@friuliemergenze.it
                    </a>
                  </p>

                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildStaffEmail({ name, surname, email, username, phone, verifyLink }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">

            <table style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
              <tr>
                <td style="padding:35px;text-align:center;">

                  <img
                    src="https://www.friuliemergenze.it/assets/logo.png"
                    style="width:80px;margin-bottom:20px;"
                    loading="lazy"
                  >

                  <h1 style="color:#ff3b3b;margin:0;font-size:28px;">
                    Nuovo utente registrato
                  </h1>

                  <p style="font-size:18px;color:#333;margin-top:25px;">
                    <b>Nome:</b> ${name + " " + surname}<br>
                    <b>Email:</b> ${email}<br>
                    <b>Username:</b> ${username}<br>
                    <b>Telefono:</b> ${phone}
                  </p>

                  <p style="color:#888;font-size:13px;margin-top:25px;line-height:1.6;">
                    Il link di conferma che è stato inviato a ${name} utente è:
                    <br><br>

                    <a
                      href="#"
                      style="color:#ff3b3b;"
                    >
                      ${verifyLink}
                    </a>
                  </p>

                  <p style="font-size:11px;color:#999;margin-top:25px;line-height:1.5;">
                    MyFrEM · Friuli Emergenze<br>
                    Hai ricevuto questa email perché è stato creato un account con questo indirizzo.<br>
                    Se non sei stato tu, puoi ignorare questa email.
                    <br><br>

                    <a href="https://friuliemergenze.it">
                      friuliemergenze.it
                    </a>

                    ·

                    <a href="mailto:info@friuliemergenze.it">
                      info@friuliemergenze.it
                    </a>
                  </p>

                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
    </div>
  `;
}