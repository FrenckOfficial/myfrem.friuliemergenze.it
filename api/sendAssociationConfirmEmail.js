import { createHash, randomBytes } from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const SITE_URL = process.env.SITE_URL || "https://myfrem.friuliemergenze.it";
const ALLOWED_ORIGINS = [SITE_URL];
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const GUEST_WINDOW_MS = 15 * 60 * 1000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

  return initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.BREVO_API_KEY || !process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.error("BREVO_API_KEY o FIREBASE_SERVICE_ACCOUNT non configurate");
      return res.status(500).json({ error: "Configurazione server errata" });
    }

    const adminApp = getAdminApp();

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    let uid = null;

    if (idToken) {
      try {
        const decoded = await getAuth(adminApp).verifyIdToken(idToken);
        uid = decoded.uid;
      } catch (err) {
        return res.status(401).json({ error: "Token non valido" });
      }
    }

    const { requestId } = req.body || {};

    if (typeof requestId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(requestId)) {
      return res.status(400).json({ error: "requestId non valido" });
    }

    const db = getFirestore(adminApp);
    const ref = db.collection("associationRequests").doc(requestId);

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists) {
        throw new HttpError(404, "Richiesta non trovata");
      }

      const d = snap.data();
      const lastSent = d.confirmSentAt?.toMillis?.() || 0;

      if (d.requesterUid) {
        if (!uid) throw new HttpError(401, "Non autenticato");
        if (d.requesterUid !== uid) throw new HttpError(403, "Non autorizzato");

        if (Date.now() - lastSent < RESEND_COOLDOWN_MS) {
          throw new HttpError(429, "Attendi un minuto prima di richiedere un nuovo invio");
        }
      } else {
        const createdAt = d.createdAt?.toMillis?.() || 0;

        if (!createdAt || Date.now() - createdAt > GUEST_WINDOW_MS) {
          throw new HttpError(403, "Tempo scaduto per l'invio automatico");
        }

        if (lastSent) {
          throw new HttpError(429, "Link di conferma già inviato");
        }
      }

      if (d.status !== "in_attesa") {
        throw new HttpError(409, "La richiesta non è in attesa");
      }

      if (d.confirmedMail === true) {
        return { alreadyConfirmed: true };
      }

      const toEmail = typeof d.LAMail === "string" ? d.LAMail.trim() : "";

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
        throw new HttpError(400, "Email dell'ente non valida");
      }

      tx.update(ref, {
        confirmTokenHash: tokenHash,
        confirmTokenExpiresAt: Timestamp.fromMillis(Date.now() + TOKEN_TTL_MS),
        confirmSentAt: FieldValue.serverTimestamp()
      });

      return { data: d, toEmail };
    });

    if (result.alreadyConfirmed) {
      return res.status(200).json({ success: true, alreadyConfirmed: true });
    }

    const { data, toEmail } = result;

    const confirmUrl = `${SITE_URL}/conferma-email-associazione/?id=${encodeURIComponent(requestId)}&token=${token}`;

    const rawAssociationName = String(data.name || "").slice(0, 120);
    const associationName = sanitizeHtml(rawAssociationName);
    const requesterName = sanitizeHtml(data.requesterNome, 120) || "un utente MyFrEM";

    const htmlContent = generateMailHtml({
      associationName,
      requesterName,
      confirmUrl: sanitizeHtml(confirmUrl)
    });

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: "Friuli Emergenze",
          email: "autosystem@friuliemergenze.it"
        },
        to: [{ email: toEmail, name: rawAssociationName || toEmail }],
        subject: "Conferma l'indirizzo email della tua associazione su MyFrEM",
        htmlContent,
        replyTo: {
          name: "Friuli Emergenze",
          email: "info@friuliemergenze.it"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Brevo API error:", errorData);

      await ref.update({ confirmSentAt: FieldValue.delete() }).catch(() => {});

      return res.status(502).json({ error: "Errore nell'invio dell'email di conferma" });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error("Server error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Errore interno del server"
    });
  }
}

function sanitizeHtml(str, max = 5000) {
  if (typeof str !== "string") return "";

  return str
    .slice(0, max)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function generateMailHtml({ associationName, requesterName, confirmUrl }) {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Lexend', Arial, sans-serif;
  background: #f5f5f5;
  padding: 20px;
}

.container {
  max-width: 600px;
  margin: auto;
  background: white;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.header {
  background: linear-gradient(135deg, #ff7b00 0%, #ff9933 100%);
  color: white;
  text-align: center;
  padding: 30px;
}

.header h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.header p {
  font-size: 14px;
  opacity: 0.95;
}

.content {
  padding: 30px;
}

.greeting {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
  line-height: 1.6;
}

.info-box {
  background: #fff5e8;
  border-left: 4px solid #ff7b00;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.info-box .label {
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  color: #999;
}

.info-box .value {
  color: #555;
  font-size: 14px;
  word-break: break-word;
}

.security-note {
  background: #f0f0f0;
  border-left: 4px solid #999;
  padding: 15px;
  border-radius: 8px;
  margin-top: 20px;
  font-size: 13px;
  color: #666;
  line-height: 1.6;
}

.security-note b {
  color: #333;
}

.footer {
  text-align: center;
  color: #999;
  padding: 20px;
  border-top: 1px solid #eee;
  font-size: 12px;
}

.cta-link {
  text-align: center;
  margin-top: 20px;
}

.cta-link a {
  display: inline-block;
  background: #ff7b00;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
}

.fallback {
  margin-top: 16px;
  font-size: 12px;
  color: #999;
  word-break: break-all;
  text-align: center;
}
</style>
</head>

<body>
<div class="container">
  <div class="header">
    <h1>Conferma la tua email</h1>
    <p>Richiesta account associazione su MyFrEM</p>
  </div>

  <div class="content">
    <div class="greeting">
      Buongiorno,
      <br><br>
      <b>${requesterName}</b> ha chiesto di gestire su MyFrEM la pagina di questa associazione o ente, indicando questo indirizzo email come contatto ufficiale.
    </div>

    <div class="info-box">
      <div class="label">Associazione / ente</div>
      <div class="value">${associationName}</div>
    </div>

    <div class="greeting">
      Se la richiesta è corretta, conferma l'indirizzo con il pulsante qui sotto. Il link è valido per 48 ore. Dopo la conferma lo staff verificherà la richiesta contattando direttamente l'ente.
    </div>

    <div class="cta-link">
      <a href="${confirmUrl}">Conferma l'indirizzo email</a>
    </div>

    <div class="fallback">
      Se il pulsante non funziona, copia questo indirizzo nel browser:<br>
      ${confirmUrl}
    </div>

    <div class="security-note">
      <b>Nota di Sicurezza:</b> Se non riconosci questa richiesta, ignora questa email: senza conferma non verrà attivato nulla. Se vuoi segnalarci l'errore scrivi a info@friuliemergenze.it, grazie!
    </div>
  </div>

  <div class="footer">
    © 2026 Friuli Emergenze - MyFrEM. Questa è una notifica automatica, non rispondere a questa email.
  </div>
</div>
</body>
</html>
`;
}