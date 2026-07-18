import { firebaseConfig } from "../configFirebase.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const statusMsg = document.getElementById("statusMsg");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');

const resetForm = document.getElementById("resetForm");
const resetEmail = document.getElementById("resetEmail");
const resetError = document.getElementById("error");
const resetSuccess = document.getElementById("success");
const resetButton = document.getElementById("resetEmailButton");

function redirectByRole(role) {
  if (allowedRoles.includes(role)) {
    window.location.href = "/staff";
  } else {
    window.location.href = "/dashboard";
  }
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
        if (!userData) throw new Error("Username non trovato.");
        email = userData.email;
      }

      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      await user.reload();

      const userSnap = await getUserDoc(user.uid);
      const userData = userSnap.data();

      if (userData.emailVerified === false) {
        await signOut(auth);
        throw new Error("Verifica il tuo indirizzo email prima di accedere.");
      }

      if (!userSnap.exists()) {
        await signOut(auth);
        throw new Error("Profilo non trovato.");
      }

      await validateAccount(userData);

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
            name: userData.name + " " + userData.surname || "Utente",
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          })
        });
      } catch (error) {
        console.error("Errore notifica:", error);
      }

      await createLoginLog(user);

      redirectByRole(userData.role);

      btnText.style.display = 'inline-block';
      btnLoader.style.display = 'none';

    } catch (err) {
      btnText.textContent = "Accedi";
      switch (err.code) {
        case "auth/user-not-found":
          setStatus("Username non trovato.", "error");
          break;
        case "auth/wrong-password":
          setStatus("Password errata.", "error");
          break;
        case "auth/invalid-credential":
          setStatus("Username o password errati.", "error");
          break;
        default:
          setStatus(err.message, "error");
          break;
      }
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

      const userSnap = await getUserDoc(user.uid);

      if (!userSnap.exists()) {
        await signOut(auth);
        throw new Error(
          "Accesso negato. Crea prima un account."
        );
      }

      const userData = userSnap.data();

      await validateAccount(userData);

      await createLoginLog(user);

      redirectByRole(userData.role);

      try {
        const token = await auth.currentUser.getIdToken();

        await fetch("/api/sendLoginMail",  {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            email: user.email,
            name: userData.nome || "Utente",
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          })
        });
      } catch (error) {
        console.error("Errore nell'invio della notifica di login:", error);
      }
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
  let currentStep = 1;
  const totalSteps = 6;
  const steps = document.querySelectorAll(".step");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const submitBtn = document.getElementById("submitBtn");
  const reviewContainer = document.getElementById("reviewContainer");

  function showStep(step) {
    steps.forEach(s => {
      s.style.display = "none";
    });

    document.querySelector(`[data-step="${step}"]`).style.display = "block";
    document.getElementById("stepCounter").textContent = `Passo ${step} di ${totalSteps}`;
    document.querySelector(".step-progress").style.width = `${(step / totalSteps) * 100}%`;

    prevBtn.style.display = step === 1 ? "none" : "block";

    if (step === totalSteps) {
      nextBtn.style.display = "none";
      submitBtn.style.display = "block";

      reviewContainer.innerHTML = `
        <div><strong>Nome:</strong> ${registerName.value} ${registerSurname.value}</div>
        <div><strong>Username:</strong> ${registerUsername.value}</div>
        <div><strong>Email:</strong> ${registerEmail.value}</div>
        <div><strong>Telefono:</strong> ${registerPhone?.value || "Non inserito"}</div>
      `;
    } else {
      nextBtn.style.display = "block";
      submitBtn.style.display = "none";
    }
  }

  async function validateStep() {
    if (currentStep === 1) {
      if (!registerName.value.trim() || !registerSurname.value.trim()) {
        setStatus( "Inserisci nome e cognome", "error");
        return false;
      }
    }

    if (currentStep === 2) {
      const username = registerUsername.value.trim();
      if (!username) {
        setStatus("Inserisci un username", "error");
        return false;
      }
      const usernameQuery = query(collection(db, "users"), where("username", "==", username), limit(1));
      const usernameSnap = await getDocs(usernameQuery);
      if (!usernameSnap.empty) {
        setStatus("Username già utilizzato", "error");
        return false;
      }
    }

    if (currentStep === 3) {
      if (!registerEmail.value.trim()) {
        setStatus("Inserisci una email", "error");
        return false;
      }
    }

    if (currentStep === 5) {
      if (registerPassword.value !== registerConfirmPassword.value) {
        setStatus("Le password non coincidono", "error");
        return false;
      }
    } return true;
  }

  nextBtn.addEventListener("click", async () => {
    const valid = await validateStep();
    if (!valid) return;
    currentStep++;
    showStep(currentStep);
  });

  prevBtn.addEventListener("click", () => {
    currentStep--;
    showStep(currentStep);
  });

  showStep(1);

  registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      submitBtn.disabled = true;
      btnText.textContent = "Registrazione in corso...";

      btnLoader.style.display = "inline-block";

      if (isRegistering) return;
      isRegistering = true;

      try {
        const name = registerName.value.trim();
        const surname = registerSurname.value.trim();
        const email = registerEmail.value.trim();
        const username = registerUsername.value.trim();
        const password = registerPassword.value;
        const phone = registerPhone?.value.trim() || "";

        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const user = cred.user;

        await setDoc(doc(db, "users", user.uid), {
          email,
          name,
          surname,
          username,
          phone,
          role: "user",
          status: "attivo",
          newsSubbed: false,
          emailVerified: false,
          createdAt: serverTimestamp()
        });

        const token = crypto.randomUUID();

        await setDoc(doc(db, "emailVerifications", token), {
          email,
          userId: user.uid,
          expiresAt: Date.now() + 86400000,
          used: false
        });

        await addDoc(collection(db, "activities"), {
          type: "user_creation",
          userName: `${name} ${surname}`,
          timestamp: serverTimestamp()
        });

        const verifyLink = `https://myfrem.friuliemergenze.it/verify-email?token=${token}`;

        const htmlContent = buildEmail({ verifyLink, email, name});

        const response = await fetch("https://myfrem.api.friuliemergenze.it/api/sendVerificationEmail", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userEmail: email,
            htmlContent
          })
        });

        if (!response.ok) {
          throw new Error("Errore invio email di verifica.");
        }

        setStatus("Email di verifica inviata.", "success");

        await signOut(auth);
        window.location.href ="/auth/confirm-email";

      } catch (err) {
        btnText.textContent = "Registrazione fallita";
        switch (err.code) {
          case "auth/email-already-in-use":
            setStatus("Email già in uso.", "error");
            break;
          case "auth/invalid-email":
            setStatus("Email non valida.", "error");
            break;
          case "auth/weak-password":
            setStatus("Password debole.", "error");
            break;
          default:
            setStatus("Errore durante la registrazione.", "error");
        }
        console.error(err);
      } finally {
        isRegistering = false;
        submitBtn.disabled = false;
        btnText.textContent = "Crea account";
        btnLoader.style.display = "none";
      }
    }
  );
}

function setStatus(message, type = "info") {
  const classNameBox = document.querySelector(".statusBox");
  statusMsg.textContent = message;
  classNameBox.className = `${"statusBox" + " " + type}`;
  classNameBox.style.display = "block";
  const closeBtn = document.getElementById("closeSMsg");
  closeBtn.onclick = () => {
    classNameBox.style.display = "none";
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  if (isRegistering || isLoggingIn || isRouting) {
    return;
  }

  const path = window.location.pathname;

  const blockedPaths = [
    "/login/signin/",
    "/login/signup",
    "/login/reset-your-password"
  ];

  if (blockedPaths.some((p) => path.startsWith(p))) {
    return;
  }

  try {
    isRouting = true;

    const userSnap = await getUserDoc(user.uid);

    if (!userSnap.exists()) {
      return;
    }

    const userData = userSnap.data();

    redirectByRole(userData.role);

  } catch (err) {
    console.error(err);

  } finally {
    isRouting = false;
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