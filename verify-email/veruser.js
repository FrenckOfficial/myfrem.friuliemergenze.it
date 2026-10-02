import { firebaseConfig } from "../configFirebase.js";

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

const statusBox = document.getElementById("statusBox");

const token = new URLSearchParams(window.location.search).get("token");

async function verifyEmail() {

  if (!token) {
    console.warn("Token mancante");
    statusBox.innerText = "Token mancante";
    statusBox.style.color = "red";
    return;
  }

  try {

    const tokenRef = db.collection("emailVerifications").doc(token);

    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists) {
      statusBox.innerText = "Token non valido o già usato";
      statusBox.style.color = "red";
      return;
    }

    const data = tokenDoc.data();

    if (data.used) {
      statusBox.innerText = "Token già utilizzato";
      statusBox.style.color = "red";
      return;
    }

    if (Date.now() > data.expiresAt) {
      statusBox.innerText = "Token scaduto";
      statusBox.style.color = "red";
      return;
    }

    const userSnap = await db
      .collection("users")
      .where("email", "==", data.email)
      .limit(1)
      .get();

    if (userSnap.empty) {
      statusBox.innerText = "Utente non trovato";
      statusBox.style.color = "red";
      return;
    }

    const userRef = userSnap.docs[0].ref;

    await userRef.update({
      emailVerified: true,
      status: "attivo"
    });

    await tokenRef.update({
      used: true,
      usedAt: Date.now()
    });

    statusBox.innerText = "Email verificata con successo!";
    statusBox.style.color = "green";

    setTimeout(() => {
      window.location.href = "/login/signin";
    }, 2000);

    sendPersonalLinkEmail();

  } catch (err) {
    statusBox.innerText = "Errore server";
    statusBox.style.color = "red";
  }
}

async function sendPersonalLinkEmail() {
  try {
    const tokenRef = db.collection("emailVerifications").doc(token);
    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists) {
      console.warn("Token non valido per email link");
      return;
    }

    const data = tokenDoc.data();

    const response = await fetch("https://myfrem.api.friuliemergenze.it/api/sendPersonalLinkEmail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userEmail: data.email,
        title: "Il link personale per il tuo profilo MyFrEM",
        htmlContent: `
          <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
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
                          src="https://www.friuliemergenze.it/assets/logo.png"
                          style="width:80px;margin-bottom:20px;"
                          loading="lazy"
                        >

                        <h1 style="
                          color:#00bcd4;
                          margin:0;
                          font-size:28px;
                        ">
                          Account verificato
                        </h1>

                        <p style="
                          font-size:18px;
                          color:#333;
                          margin-top:25px;
                        ">
                          Ciao,
                        </p>

                        <p style="
                          color:#555;
                          line-height:1.7;
                          font-size:17px;
                          margin-top:20px;
                        ">
                          Il tuo account <b>MyFrEM</b> è stato verificato con successo.
                          <br><br>

                          Da ora puoi accedere al tuo profilo personale
                          e visualizzare tutte le informazioni del tuo account.
                        </p>

                        <a
                          href="https://myfrem.friuliemergenze.it/profile?userid=${encodeURIComponent(data.userId)}"
                          style="
                            display:inline-block;
                            padding:15px 24px;
                            background:#00bcd4;
                            color:#ffffff;
                            text-decoration:none;
                            border-radius:10px;
                            font-weight:bold;
                            margin-top:25px;
                            font-size:16px;
                          "
                        >
                          Vai al tuo profilo
                        </a>

                        <p style="
                          color:#888;
                          font-size:13px;
                          margin-top:25px;
                          line-height:1.6;
                        ">
                          Se il pulsante non funziona, copia questo link nel browser:
                          <br><br>

                          <a
                            href="https://myfrem.friuliemergenze.it/profile?userid=${encodeURIComponent(data.userId)}"
                            style="color:#00bcd4;"
                          >
                            https://myfrem.friuliemergenze.it/profile?userid=${encodeURIComponent(data.userId)}
                          </a>
                        </p>

                        <p style="
                          font-size:11px;
                          color:#999;
                          margin-top:25px;
                          line-height:1.5;
                        ">
                          MyFrEM · Friuli Emergenze<br>
                          Questa email conferma che il tuo account è stato verificato correttamente.
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
          `
      })
    });

    const result = await response.json();

    if (!result.success) {
      console.error("Errore invio email:", result);
      return;
    }

  } catch (err) {
    console.error("Errore sendPersonalLinkEmail:", err);
  }
}

verifyEmail();