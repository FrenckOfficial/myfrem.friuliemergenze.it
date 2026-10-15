import { FieldValue } from "firebase-admin/firestore";
import { preflight, requireUser, getUser, getPhoto, sendMail, fullName, fail, HttpError } from "./_lib/server.js";

export default async function handler(req, res) {
  if (!preflight(req, res)) return;

  try {
    const decoded = await requireUser(req);
    const { ref, photo } = await getPhoto(req.body?.photoId);

    if (photo.userId !== decoded.uid) throw new HttpError(403, "Puoi ricevere conferme solo per le tue foto");

    const user = await getUser(decoded.uid);
    if (user?.emailNotifications !== true) return res.status(200).json({ success: true, skipped: true });

    const to = user.email || decoded.email;
    if (!to) throw new HttpError(400, "Nessuna email associata all'account");

    const claimed = await ref.firestore.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      if (fresh.data()?.uploadMailSentAt) return false;
      tx.update(ref, { uploadMailSentAt: FieldValue.serverTimestamp() });
      return true;
    });

    if (!claimed) return res.status(200).json({ success: true, alreadySent: true });

    const created = photo.createdAt?.toDate ? photo.createdAt.toDate() : new Date();
    const formattedDate = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(created);

    const photoLabel = [photo.vehicleModel, photo.licensePlate, photo.location]
      .map((v) => String(v || "").trim())
      .filter((v) => v && v !== "-")
      .join(" - ") || "Foto";

    await sendMail({
      to,
      toName: fullName(user),
      subject: `${photoLabel}: Foto caricata correttamente!`,
      htmlContent: generateMailHtml({
        name: sanitizeHtml(fullName(user)),
        photoName: sanitizeHtml(photoLabel),
        uploadedAt: formattedDate
      })
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return fail(res, error);
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

function generateMailHtml({ name, photoName, uploadedAt }) {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <link rel="stylesheet" href="/modals.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.min.css">
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
</style>
</head>

<body>
<div class="container">
  <div class="header">
    <h1>Aggiornamento sulla foto</h1>
    <p>Sistemi di notifica Friuli Emergenze</p>
  </div>

  <div class="content">
    <div class="greeting">
      Ciao <b>${name}</b>,
      <br><br>
      Hai caricato correttamente la tua foto su MyFrEM!
    </div>

    <div class="info-box">
      <div class="label">Nome della foto</div>
      <div class="value">${photoName}</div>
    </div>

    <div class="info-box">
      <div class="label">Stato della foto</div>
      <div class="value"><b>In attesa di approvazione</b></div>
    </div>

    <div class="info-box">
      <div class="label">Foto caricata in data:</div>
      <div class="value">${uploadedAt}</div>
    </div>

    <div class="security-note">
      <b>⚠️ Nota di Sicurezza:</b> Se hai ricevuto questa mail per errore inoltrala a info@friuliemergenze.it spiegando l'errore, grazie!
    </div>

    <div class="cta-link">
      <a href="https://myfrem.friuliemergenze.it/auth/signin">Accedi a MyFrEM</a>
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