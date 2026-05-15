import { firebaseConfig } from "../configFirebase.js";

console.log("🚀 SCRIPT AVVIATO - auth module loading...");

firebase.initializeApp(firebaseConfig);
console.log("🔥 Firebase inizializzato");

const auth = firebase.auth();
const db = firebase.firestore();

console.log("🔗 Auth & Firestore instance create");

const clg = console.log;
const crr = console.error;

clg("✅ Sistema log attivo");

let isRegistering = false;
let isLoggingIn = false;
let isRouting = false;

const loginForm = document.getElementById("loginForm");
console.log("🔍 loginForm:", loginForm);

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("📨 LOGIN SUBMIT triggerato");

    isLoggingIn = true;
    console.log("🔒 LOGIN LOCK ON");

    const identifier = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    console.log("👤 Identifier:", identifier);
    console.log("🔑 Password length:", password?.length);

    let emailToUse = identifier;

    try {
      console.log("➡️ STEP LOGIN 1: check identifier type");

      if (!identifier.includes("@")) {
        console.log("🔎 Username rilevato, query Firestore...");
        const snap = await db
          .collection("users")
          .where("username", "==", identifier)
          .limit(1)
          .get();

        console.log("📦 Query snapshot empty?", snap.empty);

        if (snap.empty) {
          console.warn("❌ Username non trovato");
          alert("❌ Username non trovato");
          return;
        }

        emailToUse = snap.docs[0].data().email;
        console.log("📧 Email trovata da username:", emailToUse);
      }

      console.log("🔐 STEP LOGIN 2: signInWithEmailAndPassword");
      const cred = await auth.signInWithEmailAndPassword(emailToUse, password);

      console.log("✅ Login eseguito:", cred.user.uid);

      const user = cred.user;

      console.log("🔄 Reload user...");
      await user.reload();

      console.log("📄 STEP LOGIN 3: fetch user doc");
      const userDoc = await db.collection("users").doc(user.uid).get();

      console.log("📦 userDoc exists:", userDoc.exists);

      if (!userDoc.exists) {
        console.warn("❌ Profilo non trovato");
        alert("Profilo non trovato");
        return;
      }

      const userData = userDoc.data();
      console.log("📊 userData:", userData);

      if (userData.emailVerified === false) {
        console.warn("⚠️ Email non verificata");
        alert("❌ Verifica il tuo indirizzo email prima di accedere.");
        await auth.signOut();
        return;
      }

      console.log("🧪 status check:", userData.status);

      if (userData.status === "sospeso") {
        console.warn("⛔ Account sospeso");
        alert("❌ Il tuo account è sospeso. Contatta un amministratore.");
        await auth.signOut();
        return;
      }

      if (userData.status === "eliminato") {
        console.warn("⛔ Account eliminato");
        alert("❌ Il tuo account è stato eliminato.");
        await auth.signOut();
        return;
      }

      console.log("📝 Logging login event...");
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

      console.log("🧭 Role check:", userData.role);

      isLoggingIn = false;
      console.log("🔓 LOGIN LOCK OFF");

      if (allowedRoles.includes(userData.role)) {
        console.log("➡️ Redirect /staff");
        window.location.href = "/staff";
      } else {
        console.log("➡️ Redirect /dashboard");
        window.location.href = "/dashboard";
      }

    } catch (err) {
      isLoggingIn = false;
      console.log("🔓 LOGIN LOCK OFF (ERROR)");

      crr("❌ LOGIN ERROR:", err);
      console.error("🔴 Stack/Details:", err?.stack);
      alert("Errore login: " + err.message);
    }
  });
}

const googleBtn = document.getElementById("googleLoginBtn");
console.log("🔍 googleBtn:", googleBtn);

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    console.log("🔵 GOOGLE LOGIN click");

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);

      const user = result.user;
      console.log("✅ Google login user:", user.uid);

      const userRef = db.collection("users").doc(user.uid);
      const snap = await userRef.get();

      console.log("📄 user doc exists:", snap.exists);

      if (!snap.exists) {
        console.warn("⛔ Accesso negato: account non registrato");
        alert("Accesso negato: crea prima un account.");
        await auth.signOut();
        return;
      }

      const data = snap.data();
      console.log("📊 Google user data:", data);

      if (data.status === "sospeso" || data.status === "eliminato") {
        console.warn("⛔ Account bloccato:", data.status);
        alert("❌ Account non attivo");
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

      console.log("🧭 role:", data.role);

      if (allowedRoles.includes(data.role)) {
        console.log("➡️ redirect staff");
        window.location.href = "/staff";
      } else {
        console.log("➡️ redirect dashboard");
        window.location.href = "/dashboard";
      }

    } catch (err) {
      crr("❌ GOOGLE ERROR:", err);
      console.error("🔴 Google stack:", err?.stack);
      alert("Errore Google: " + err.message);
    }
  });
}

const registerForm = document.getElementById("registerForm");
console.log("🔍 registerForm:", registerForm);

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    console.log("🟢 REGISTER submit");

    isRegistering = true;

    const name = document.getElementById("registerName").value;
    const surname = document.getElementById("registerSurname").value;
    const email = document.getElementById("registerEmail").value;
    const username = document.getElementById("registerUsername").value;
    const password = document.getElementById("registerPassword").value;

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const user = cred.user;

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
      });

      const verifyLink = `https://myfrem.friuliemergenze.it/verify-email?token=${token}`;

      const htmlContent = buildEmail({ verifyLink, name, email });

      await fetch("https://myfrem.friuliemergenze.it/api/sendVerificationEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: email, htmlContent })
      });

      alert("📩 Email di verifica inviata!");

      await auth.signOut();
      window.location.href = "/login";

    } catch (err) {
      crr("❌ REGISTER ERROR:", err);
      alert(err.message);
    } finally {
      isRegistering = false;
    }
  });
}
auth.onAuthStateChanged(async (user) => {
  console.log("👀 auth state changed:", user?.uid || null);

  if (!user) return;
  if (isRegistering) return;
  if (isLoggingIn) {
    console.log("⛔ skip auth listener: login in progress");
    return;
  }

  const currentPath = window.location.pathname;
  console.log("📍 currentPath:", currentPath);

  if (currentPath.startsWith("/login")) {
    console.log("⛔ skip redirect on login page");
    return;
  }

  if (isRouting) {
    console.log("⛔ skip auth listener: routing active");
    return;
  }

  try {
    isRouting = true;
    console.log("🚦 ROUTING LOCK ON");

    const userDoc = await db.collection("users").doc(user.uid).get();

    console.log("📄 auth listener userDoc exists:", userDoc.exists);

    if (!userDoc.exists) return;

    const userData = userDoc.data();
    console.log("📊 auth listener userData:", userData);

    const allowedRoles = [
      "simplestaff",
      "modstaff",
      "advstaff",
      "advstaffplus",
      "superadmin"
    ];

    console.log("🧭 auth redirect role:", userData.role);

    if (allowedRoles.includes(userData.role)) {
      window.location.href = "/staff";
    } else {
      window.location.href = "/dashboard";
    }

  } finally {
    isRouting = false;
    console.log("🚦 ROUTING LOCK OFF");
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