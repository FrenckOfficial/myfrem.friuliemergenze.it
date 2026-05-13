import { firebaseConfig } from "../configFirebase.js";

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const clg = console.log;
const crr = console.error;

clg("✅ Firebase inizializzato");
let isRegistering = false;

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const identifier = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    let emailToUse = identifier;

    try {
      if (!identifier.includes("@")) {
        const snap = await db
          .collection("users")
          .where("username", "==", identifier)
          .limit(1)
          .get();

        if (snap.empty) {
          alert("❌ Username non trovato");
          return;
        }

        emailToUse = snap.docs[0].data().email;
      }

      const cred = await auth.signInWithEmailAndPassword(emailToUse, password);
      const user = cred.user;

      await user.reload();

      const userDoc = await db.collection("users").doc(user.uid).get();

      if (!userDoc.exists) {
        alert("Profilo non trovato");
        return;
      }

      const userData = userDoc.data();

      if (userData.emailVerified === false) {
        alert("❌ Verifica il tuo indirizzo email prima di accedere.");
        await auth.signOut();
        return;
      }

      if (userData.status === "sospeso") {
        alert("❌ Il tuo account è sospeso. Contatta un amministratore.");
        await auth.signOut();
        return;
      }

      if (userData.status === "eliminato") {
        alert("❌ Il tuo account è stato eliminato.");
        await auth.signOut();
        return;
      }

      await db.collection("logins").add({
        userId: user.uid,
        email: user.email,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      const allowedRoles = [
        "simplestaff",
        "modstaff",
        "advstaff",
        "advstaffplus",
        "superadmin"
      ];

      if (allowedRoles.includes(userData.role)) {
        window.location.href = "/staff";
      } else {
        window.location.href = "/dashboard";
      }

    } catch (err) {
      crr("❌ Errore login:", err);
      alert("Errore login: " + err.message);
    }
  });
}

const googleBtn = document.getElementById("googleLoginBtn");

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();

      const result = await auth.signInWithPopup(provider);
      const user = result.user;

      const userRef = db.collection("users").doc(user.uid);
      const snap = await userRef.get();

      if (!snap.exists) {
        alert("Accesso negato: crea prima un account.");
        await auth.signOut();
        return;
      }

      const data = snap.data();

      if (data.status === "sospeso") {
        alert("❌ Il tuo account è sospeso.");
        await auth.signOut();
        return;
      }

      if (data.status === "eliminato") {
        alert("❌ Il tuo account è stato eliminato.");
        await auth.signOut();
        return;
      }

      await db.collection("logins").add({
        userId: user.uid,
        email: user.email,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      const allowedRoles = [
        "simplestaff",
        "modstaff",
        "advstaff",
        "advstaffplus",
        "superadmin"
      ];

      if (allowedRoles.includes(data.role)) {
        window.location.href = "/staff";
      } else {
        window.location.href = "/dashboard";
      }

    } catch (err) {
      crr("❌ Errore Google:", err);
      alert("Errore Google: " + err.message);
    }
  });
}

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("registerName").value;
  const surname = document.getElementById("registerSurname").value;
  const email = document.getElementById("registerEmail").value;
  const username = document.getElementById("registerUsername").value;
  const password = document.getElementById("registerPassword").value;

  isRegistering = true;

  try {
    console.log("👉 STEP 1: create user auth");
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const user = cred.user;

    console.log("👉 STEP 2: write users doc");
    await db.collection("users").doc(user.uid).set({
      email,
      name,
      surname,
      username,
      role: "user",
      status: "attivo",
      emailVerified: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const token = crypto.randomUUID();

    await db.collection("emailVerifications").doc(token).set({
      email,
      userId: user.uid,
      expiresAt: Date.now() + 86400000,
      used: false
    });

    await db.collection("activities").add({
      type: "user_creation",
      userName: `${name} ${surname}`,
      timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    })

    const verifyLink = `https://myfrem.friuliemergenze.it/verify-email?token=${token}`;

    const htmlContent = buildEmail({ verifyLink, name, email });

    await fetch("https://myfrem.friuliemergenze.it/api/sendVerificationEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail: email, htmlContent })
    });

    alert("📩 Email di verifica inviata! Controlla la tua casella di posta. Ci raccomandiamo di controllare anche la cartella spam!");

    await auth.signOut();

    alert("✅ Registrazione avvenuta!");
    window.location.href = "/login";

    } catch (err) {
      crr(err);
      alert(err.message);
    } finally {
      isRegistering = false;
    }
  });
}

const resetForm = document.getElementById("resetForm");

if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = e.target["resetEmail"].value;

    try {
      await auth.sendPasswordResetEmail(email);
      alert("📩 Email di reset inviata!");
    } catch (err) {
      crr("❌ Reset error:", err);
      alert("Errore reset: " + err.message);
    }
  });
}

auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  if (isRegistering) return;

  const currentPath = window.location.pathname;

  if (currentPath === "/staff" || currentPath === "/dashboard") return;

  const userDoc = await db.collection("users").doc(user.uid).get();
  if (!userDoc.exists) return;

  const userData = userDoc.data();

  const allowedRoles = [
    "simplestaff",
    "modstaff",
    "advstaff",
    "advstaffplus",
    "superadmin"
  ];

  if (allowedRoles.includes(userData.role)) {
    window.location.href = "/staff";
  } else {
    window.location.href = "/dashboard";
  }
});

function buildEmail({ verifyLink, email, name }) {

  const footer = `
    <p style="font-size:11px;color:#999;margin-top:25px;line-height:1.5;">
      MyFrEM · Friuli Emergenze<br>
      Hai ricevuto questa email perché è stato creato un account con questo indirizzo.<br>
      Se non sei stato tu, puoi ignorare questa email.
      <br><br>
      <a href="https://friuliemergenze.it">
        friuliemergenze.it
      </a>
      ·
      <a href="mailto:soem@friuliemergenze.it">
        soem@friuliemergenze.it
      </a>
    </p>
  `;

  return `
    <div style="
      font-family:Arial,sans-serif;
      background:#f5f5f5;
      padding:20px;
    ">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">

            <table style="
              max-width:520px;
              width:100%;
              background:#ffffff;
              border-radius:14px;
              overflow:hidden;
              box-shadow:0 2px 10px rgba(0,0,0,0.05);
            ">

              <tr>
                <td style="padding:35px;text-align:center;">

                  <img
                    src="https://friuliemergenze.it/assets/logo.png"
                    style="width:80px;margin-bottom:20px;"
                  >

                  <h1 style="
                    color:#ff3b3b;
                    margin:0;
                    font-size:28px;
                  ">
                    Verifica il tuo account
                  </h1>

                  ${name ? `
                    <p style="
                      font-size:18px;
                      color:#333;
                      margin-top:25px;
                      margin-bottom:10px;
                    ">
                      Ciao <b>${name}</b>,
                    </p>
                  ` : ""}

                  <p style="
                    color:#555;
                    line-height:1.7;
                    font-size:17px;
                    margin-top:20px;
                  ">
                    Benvenuto su <b>MyFrEM</b> 👋<br><br>

                    Per completare la registrazione del tuo account
                    e confermare il tuo indirizzo email
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

                  <p style="
                    color:#888;
                    font-size:13px;
                    margin-top:25px;
                    line-height:1.6;
                  ">
                    Se il pulsante non funziona, copia e incolla questo link nel browser:
                    <br><br>
                    <a href="${verifyLink}" style="color:#ff3b3b;">
                      ${verifyLink}
                    </a>
                  </p>

                  ${footer}

                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </div>
  `;
}