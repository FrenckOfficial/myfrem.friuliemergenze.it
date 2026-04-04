import { firebaseConfig } from "../configFirebase.js";

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const clg = console.log;
const crr = console.error;

clg("✅ Firebase inizializzato");

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const identifier = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    let emailToUse = identifier;

    try {
      if (!identifier.includes("@")) {
        clg("🔍 Cerco username:", identifier);

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
        clg("✅ Username risolto in email:", emailToUse);
      }

      const cred = await auth.signInWithEmailAndPassword(emailToUse, password);
      const user = cred.user;

      const loginsRef = db.collection("logins");
      await loginsRef.add({
        userId: user.uid,
        email: user.email,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      clg("✅ Login riuscito:", user.username || user.email);
      clg("🔑 Stato account:", user.status);

      const userDoc = await db.collection("users").doc(user.uid).get();

      if (!userDoc.exists) {
        alert("Profilo non trovato");
        return;
      }

      const userData = userDoc.data();

      if (userData.status === "sospeso") {
        alert("❌ Il tuo account è sospeso. Contatta un amministratore.");
        await auth.signOut();
        return;
      }

      if (userData.status === "eliminato") {
        alert("❌ Il tuo account è stato eliminato. E' possibile riattivarlo entro 60 giorni dall'eliminazione contattando un amministratore.");
        await auth.signOut();
        return;
      }

      if (!userData.emailVerified) {
        alert("⚠️ Attenzione: email non verificata. Verifica la tua email per accedere.");
        await auth.signOut();
        return;
      }

      const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus"];
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

      clg("✅ Login Google:", user.uid);

      const userRef = db.collection("users").doc(user.uid);
      const snap = await userRef.get();

      if (!snap.exists) {
        await userRef.set({
          email: user.email,
          name: user.displayName || "",
          role: "user",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      await db.collection("logins").add({
        userId: user.uid,
        email: user.email,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      const finalDoc = await userRef.get();
      const data = finalDoc.data();
      const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus"];

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
    const reb = document.getElementById("resetEmailButton");

    try {
      const existing = await db
        .collection("users")
        .where("username", "==", username)
        .limit(1)
        .get();

      if (!existing.empty) {
        alert("❌ Username già in uso");
        return;
      }

      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const user = cred.user;

      clg("✅ Registrazione OK:", user.uid);

      await user.sendEmailVerification({
        url: "https://myfrem.friuliemergenze.it/login/",
        linkDomain: "https://link.myfrem.friuliemergenze.it/"
      });

      await db.collection("activities").add({
        type: "user_creation",
        userName: name + " " + surname,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

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

      reb.addEventListener("submit", () => {
        db.collection("users").doc(user.uid).set({
          emailVerified: true
        })
      })

      await auth.signOut();

      window.location.href = "/login/signup/verify-email/";

    } catch (err) {
      crr("❌ Errore registrazione:", err);
      alert("Errore registrazione: " + err.message);
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
  if (user) {

    clg("👤 Utente loggato:", user.uid);

    const token = await user.getIdToken();
    localStorage.setItem("userToken", token);

    const userDoc = await db.collection("users").doc(user.uid).get();

    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus"];

    if (allowedRoles.includes(userData.role)) {
      window.location.href = "/staff";
    } else {
      window.location.href = "/dashboard"
    }
  } else {
    clg("⚠️ Nessun utente loggato");
  }
});