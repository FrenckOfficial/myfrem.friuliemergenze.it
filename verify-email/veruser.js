import { firebaseConfig } from "../configFirebase.js";

firebase.initializeApp(firebaseConfig);

console.log("🔥 Firebase inizializzato");

const db = firebase.firestore();

console.log("📦 Firestore inizializzato");

const statusBox = document.getElementById("statusBox");

const token = new URLSearchParams(window.location.search).get("token");

console.log("🔑 Token ricevuto:", token);

async function verifyEmail() {
  console.log("🚀 verifyEmail() avviata");

  if (!token) {
    console.warn("❌ Token mancante");
    statusBox.innerText = "❌ Token mancante";
    statusBox.style.color = "red";
    return;
  }

  try {
    console.log("📡 Lettura token da Firestore...");

    const tokenRef = db.collection("emailVerifications").doc(token);

    console.log("📄 DocRef creato:", tokenRef.path);

    const tokenDoc = await tokenRef.get();

    console.log("📥 Token snapshot ricevuto");
    console.log("📊 Exists:", tokenDoc.exists);

    if (!tokenDoc.exists) {
      console.warn("❌ Token non trovato nel DB");
      statusBox.innerText = "❌ Token non valido o già usato";
      statusBox.style.color = "red";
      return;
    }

    const data = tokenDoc.data();

    console.log("📦 Dati token:", data);

    if (data.used) {
      console.warn("⚠️ Token già usato");
      statusBox.innerText = "❌ Token già utilizzato";
      statusBox.style.color = "red";
      return;
    }

    console.log("⏱ Controllo scadenza...");
    console.log("Now:", Date.now(), "Expires:", data.expiresAt);

    if (Date.now() > data.expiresAt) {
      console.warn("⏳ Token scaduto");
      statusBox.innerText = "❌ Token scaduto";
      statusBox.style.color = "red";
      return;
    }

    console.log("👤 Cercando utente con email:", data.email);

    const userSnap = await db
      .collection("users")
      .where("email", "==", data.email)
      .limit(1)
      .get();

    console.log("👥 Query utenti eseguita");
    console.log("👥 Empty:", userSnap.empty);

    if (userSnap.empty) {
      console.error("❌ Utente non trovato per email:", data.email);
      statusBox.innerText = "❌ Utente non trovato";
      statusBox.style.color = "red";
      return;
    }

    const userRef = userSnap.docs[0].ref;

    console.log("✏️ Aggiornamento user emailVerified...");

    await userRef.update({
      emailVerified: true
    });

    console.log("✅ User aggiornato");

    console.log("🧹 Marcatura token come usato...");

    await tokenRef.update({
      used: true,
      usedAt: Date.now()
    });

    console.log("✅ Token aggiornato");

    statusBox.innerText = "✅ Email verificata con successo!";
    statusBox.style.color = "green";

    console.log("🎉 Verifica completata");

    setTimeout(() => {
      console.log("🔁 Redirect login...");
      window.location.href = "/login/signin";
    }, 2000);

    sendPersonalLinkEmail();

  } catch (err) {
    console.error("💥 ERRORE GENERALE VERIFY:", err);
    statusBox.innerText = "❌ Errore server";
    statusBox.style.color = "red";
  }
}

async function sendPersonalLinkEmail() {
  try {
    console.log("📨 Invio email link personale...");

    const tokenRef = db.collection("emailVerifications").doc(token);
    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists) {
      console.warn("❌ Token non valido per email link");
      return;
    }

    const data = tokenDoc.data();

    const response = await fetch("https://myfrem.api.friuliemergenze.it/sendPersonalLinkEmail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userEmail: data.email,
        title: "Il link personale per il tuo profilo MyFrEM",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Ciao 👋</h2>
            <p>Il tuo account MyFrEM è stato verificato con successo.</p>

            <p>
              Da ora puoi accedere al tuo <strong>link personale</strong> per visualizzare le informazioni del tuo profilo.
            </p>

            <a href="https://myfrem.friuliemergenze.it/profile?email=${encodeURIComponent(data.userId)}"
               style="display:inline-block;padding:10px 20px;background:#00bcd4;color:#fff;border-radius:8px;text-decoration:none;">
              Vai al tuo profilo
            </a>

            <p style="margin-top:20px;font-size:12px;color:#777;">
              Friuli Emergenze - MyFrEM
            </p>
          </div>
        `
      })
    });

    const result = await response.json();

    if (!result.success) {
      console.error("❌ Errore invio email:", result);
      return;
    }

    console.log("✅ Email link personale inviata");

  } catch (err) {
    console.error("💥 Errore sendPersonalLinkEmail:", err);
  }
}

verifyEmail();