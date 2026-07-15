import * as admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(' ')[1];
    
    try {
        await admin.auth().verifyIdToken(token);
    } catch (error) {
        console.error("❌ Token verification failed:", error);
        return res.status(401).json({ error: "Invalid token" });
    }

  try {
    const { email, name, timestamp, userAgent } = req.body;

    if (!email || !name) {
      return res.status(400).json({ 
        error: "Email e nome sono obbligatori" 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Email non valida" });
    }

    if (!process.env.BREVO_API_KEY) {
      console.error("❌ BREVO_API_KEY not configured");
      return res.status(500).json({ error: "Configurazione server errata" });
    }

    const sanitizedName = sanitizeHtml(name);
    const sanitizedEmail = sanitizeHtml(email);
    const sanitizedUserAgent = sanitizeHtml(userAgent || "Informazione non disponibile");

    const formattedDate = timestamp 
      ? new Date(timestamp).toLocaleString('it-IT') 
      : new Date().toLocaleString('it-IT');

    const htmlContent = generateLoginNotificationHtml({
      name: sanitizedName,
      email: sanitizedEmail,
      timestamp: formattedDate,
      userAgent: sanitizedUserAgent
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
        to: [{ email: sanitizedEmail, name: sanitizedName }],
        subject: `🔐 Accesso effettuato a MyFrEM - ${formattedDate}`,
        htmlContent,
        replyTo: { 
          name: "Friuli Emergenze",
          email: "info@friuliemergenze.it" 
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Brevo API error:", errorData);
      return res.status(response.status).json({ 
        error: "Errore nell'invio della notifica" 
      });
    }

    console.log("✅ Login notification inviata a:", sanitizedEmail);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("❌ Server error:", error.message);
    return res.status(500).json({ 
      success: false,
      error: "Errore interno del server"
    });
  }
}

function sanitizeHtml(str) {
  if (typeof str !== 'string') return '';
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, 5000);
}

function generateLoginNotificationHtml({ name, email, timestamp, userAgent }) {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600&display=swap" rel="stylesheet">
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
  color: #333;
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

.security-note strong {
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
</style>
</head>

<body>
<div class="container">
  <div class="header">
    <h1>🔐 Accesso Confermato</h1>
    <p>Notifica di accesso a MyFrEM</p>
  </div>

  <div class="content">
    <div class="greeting">
      Ciao <strong>${name}</strong>,
      <br><br>
      È stato effettuato un accesso al tuo account MyFrEM. Se non sei stato tu, chiama subito il numero 0431/980003.
    </div>

    <div class="info-box">
      <div class="label">📅 Data e Ora</div>
      <div class="value">${timestamp}</div>
    </div>

    <div class="info-box">
      <div class="label">🌐 Dispositivo</div>
      <div class="value">${userAgent}</div>
    </div>

    <div class="security-note">
      <strong>⚠️ Nota di Sicurezza:</strong> Se non hai effettuato tu questo accesso, accedi subito al tuo account e cambia la password. Se hai dubbi sulla sicurezza del tuo account, chiamaci al numero 0431/980003.
    </div>

    <div class="cta-link">
      <a href="https://myfrem.friuliemergenze.it/auth/signin">Accedi a MyFrEM</a>
    </div>
  </div>

  <div class="footer">
    © 2026 Friuli Emergenze - MyFrEM. Questa è una notifica automatica, non rispondere a questa email.
  </div>
</div>
  <script src="/scripts/shinystat.js?USER=SS-55951055-66dfb" style="display:none;"></script>
  <noscript>
    <a href="https://www.shinystat.com/it/" target="_top">
    <img src="//www.shinystat.com/cgi-bin/shinystat.cgi?USER=SS-55951055-66dfb" alt="Statistiche web" style="border:0px" /></a>
  </noscript>
</body>
</html>
`;
}