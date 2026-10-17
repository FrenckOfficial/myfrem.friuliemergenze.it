const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BREVO_API_KEY = defineSecret("BREVO_API_KEY");
const SITE = "https://myfrem.friuliemergenze.it";
const MAIL_SENDER = { name: "Friuli Emergenze", email: "autosystem@friuliemergenze.it" };
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

exports.adminResetPassword = onCall({ region: "europe-west1" }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Login richiesto.");

  const callerSnap = await admin.firestore().doc(`users/${req.auth.uid}`).get();
  if (!["advstaffplus", "superadmin"].includes(callerSnap.data()?.role)) {
    throw new HttpsError("permission-denied", "Non autorizzato.");
  }

  const uid = req.data?.uid;
  if (!uid) throw new HttpsError("invalid-argument", "uid mancante.");

  const tempPassword = "pass" + String(crypto.randomInt(0, 10000)).padStart(4, "0");

  await admin.auth().updateUser(uid, { password: tempPassword });
  await admin.firestore().doc(`users/${uid}`).update({ mustChangePassword: true });

  return { tempPassword };
});
 
exports.adminCreateAssociationAccount = onCall({ region: "europe-west1" }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Login richiesto.");
 
  const callerSnap = await admin.firestore().doc(`users/${req.auth.uid}`).get();
  if (!["modstaff", "advstaff", "advstaffplus", "superadmin"].includes(callerSnap.data()?.role)) {
    throw new HttpsError("permission-denied", "Non autorizzato.");
  }
 
  const requestId = req.data?.requestId;
  const associationId = req.data?.associationId;
  const accountEmail = String(req.data?.accountEmail || "").trim().toLowerCase();
 
  if (!requestId || typeof requestId !== "string") {
    throw new HttpsError("invalid-argument", "requestId mancante.");
  }
  if (!associationId || typeof associationId !== "string") {
    throw new HttpsError("invalid-argument", "associationId mancante.");
  }
  if (!EMAIL_RE.test(accountEmail)) {
    throw new HttpsError("invalid-argument", "Email non valida.");
  }
 
  const requestSnap = await admin.firestore().doc(`associationRequests/${requestId}`).get();
  if (!requestSnap.exists) throw new HttpsError("not-found", "Richiesta non trovata.");
 
  const request = requestSnap.data();
  if (request.status !== "in_attesa" || request.verifyStatus !== "verificata" || request.confirmedMail !== true) {
    throw new HttpsError("failed-precondition", "Richiesta non approvabile.");
  }
 
  const tempPassword = "pass" + String(crypto.randomInt(0, 10000)).padStart(4, "0");
 
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email: accountEmail,
      password: tempPassword,
      emailVerified: true,
      displayName: request.name
    });
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Esiste già un account con questa email.");
    }
    if (error.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "Email non valida.");
    }
    console.error("Errore creazione utente Auth:", error);
    throw new HttpsError("internal", "Creazione account non riuscita.");
  }
 
  const uid = userRecord.uid;
  const slug = String(request.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "ente";
  const username = `${slug}-${uid.slice(0, 4).toLowerCase()}`;
 
  try {
    await admin.firestore().doc(`users/${uid}`).set({
      email: accountEmail,
      name: request.name,
      surname: "",
      username,
      phone: request.LAPhone || "",
      role: "association",
      status: "attivo",
      newsSubbed: false,
      emailVerified: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      firstAccess: true,
      twoFactorEnabled: false,
      twoFactorMethod: null,
      mustChangePassword: true,
      accountType: "association",
      associationId,
      createdBy: req.auth.uid
    });
  } catch (error) {
    console.error("Errore creazione documento utente:", error);
    await admin.auth().deleteUser(uid).catch((e) => console.error("Pulizia utente Auth non riuscita:", e));
    throw new HttpsError("internal", "Creazione profilo non riuscita.");
  }
 
  return { uid, tempPassword };
});

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

async function sendBrevoMail({ to, toName, subject, htmlContent }) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": BREVO_API_KEY.value()
    },
    body: JSON.stringify({
      sender: MAIL_SENDER,
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Brevo ha rifiutato l'invio:", response.status, detail);
    throw new Error("Invio email non riuscito");
  }
}

function verificationEmailHtml({ name, email, link }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          <tr><td style="padding:35px;text-align:center;">
            <img src="https://www.friuliemergenze.it/assets/logo.png" style="width:80px;margin-bottom:20px;" loading="lazy">
            <h1 style="color:#ff3b3b;margin:0;font-size:28px;">Verifica il tuo account</h1>
            <p style="font-size:18px;color:#333;margin-top:25px;">Ciao <b>${esc(name)}</b>,</p>
            <p style="color:#555;line-height:1.7;font-size:17px;margin-top:20px;">Benvenuto su <b>MyFrEM</b>.<br><br>Per completare la registrazione e verificare l'indirizzo email <b>${esc(email)}</b>, clicca sul pulsante qui sotto.</p>
            <a href="${link}" style="display:inline-block;padding:15px 24px;background:#ff3b3b;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;margin-top:25px;font-size:16px;">Verifica account</a>
            <p style="color:#888;font-size:13px;margin-top:25px;line-height:1.6;">Se il pulsante non funziona, copia questo link nel browser:<br><br><a href="${link}" style="color:#ff3b3b;">${link}</a></p>
            <p style="font-size:11px;color:#999;margin-top:25px;line-height:1.5;">MyFrEM · Friuli Emergenze<br>Hai ricevuto questa email perché è stato creato un account con questo indirizzo.<br>Se non sei stato tu, puoi ignorare questa email.<br><br><a href="https://friuliemergenze.it">friuliemergenze.it</a> · <a href="mailto:info@friuliemergenze.it">info@friuliemergenze.it</a></p>
          </td></tr>
        </table>
      </td></tr></table>
    </div>`;
}

function verifiedEmailHtml({ userId }) {
  const profileLink = `${SITE}/profile?userid=${encodeURIComponent(userId)}`;

  return `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          <tr><td style="padding:35px;text-align:center;">
            <img src="https://www.friuliemergenze.it/assets/logo.png" style="width:80px;margin-bottom:20px;" loading="lazy">
            <h1 style="color:#00bcd4;margin:0;font-size:28px;">Account verificato</h1>
            <p style="font-size:18px;color:#333;margin-top:25px;">Ciao,</p>
            <p style="color:#555;line-height:1.7;font-size:17px;margin-top:20px;">Il tuo account <b>MyFrEM</b> è stato verificato con successo.<br><br>Da ora puoi accedere al tuo profilo personale e visualizzare tutte le informazioni del tuo account.</p>
            <a href="${profileLink}" style="display:inline-block;padding:15px 24px;background:#00bcd4;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;margin-top:25px;font-size:16px;">Vai al tuo profilo</a>
            <p style="color:#888;font-size:13px;margin-top:25px;line-height:1.6;">Se il pulsante non funziona, copia questo link nel browser:<br><br><a href="${profileLink}" style="color:#00bcd4;">${profileLink}</a></p>
            <p style="font-size:11px;color:#999;margin-top:25px;line-height:1.5;">MyFrEM · Friuli Emergenze<br>Questa email conferma che il tuo account è stato verificato correttamente.<br><br><a href="https://friuliemergenze.it">friuliemergenze.it</a> · <a href="mailto:info@friuliemergenze.it">info@friuliemergenze.it</a></p>
          </td></tr>
        </table>
      </td></tr></table>
    </div>`;
}

async function issueVerification(uid, user) {
  const db = admin.firestore();
  const token = crypto.randomBytes(32).toString("hex");

  await db.doc(`emailVerifications/${token}`).set({
    userId: uid,
    email: user.email,
    expiresAt: Date.now() + VERIFY_TTL_MS,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await db.doc(`users/${uid}`).update({ verifyEmailSentAt: Date.now() });

  const name = `${user.name || ""} ${user.surname || ""}`.trim() || "utente";

  try {
    await sendBrevoMail({
      to: user.email,
      toName: name,
      subject: "Verifica il tuo account MyFrEM",
      htmlContent: verificationEmailHtml({ name, email: user.email, link: `${SITE}/verify-email?token=${token}` })
    });
  } catch (error) {
    await Promise.all([
      db.doc(`users/${uid}`).update({ verifyEmailSentAt: user.verifyEmailSentAt || 0 }),
      db.doc(`emailVerifications/${token}`).delete()
    ]).catch((rollbackError) => console.error("Rollback verifica non riuscito:", rollbackError));
    throw error;
  }
}

exports.sendVerificationEmail = onCall({ region: "europe-west1", secrets: [BREVO_API_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Login richiesto.");

  const snap = await admin.firestore().doc(`users/${req.auth.uid}`).get();
  const user = snap.data();

  if (!user || !user.email) throw new HttpsError("not-found", "Profilo non trovato.");

  await notifyStaffNewUser(req.auth.uid).catch((error) => console.error("Avviso nuovo utente non riuscito:", error));

  if (user.emailVerified !== false) return { ok: true, alreadyVerified: true };
  if (Date.now() - (user.verifyEmailSentAt || 0) < RESEND_COOLDOWN_MS) return { ok: true, throttled: true };

  try {
    await issueVerification(req.auth.uid, user);
  } catch (error) {
    console.error("Errore invio email di verifica:", error);
    throw new HttpsError("internal", "Invio email non riuscito.");
  }

  return { ok: true };
});

exports.resendVerificationEmail = onCall({ region: "europe-west1", secrets: [BREVO_API_KEY], maxInstances: 5 }, async (req) => {
  const email = String(req.data?.email || "").trim();

  if (!EMAIL_RE.test(email) || email.length > 120) {
    throw new HttpsError("invalid-argument", "Email non valida.");
  }

  const db = admin.firestore();
  let snap = await db.collection("users").where("email", "==", email).limit(1).get();

  if (snap.empty && email !== email.toLowerCase()) {
    snap = await db.collection("users").where("email", "==", email.toLowerCase()).limit(1).get();
  }

  if (!snap.empty) {
    const userDoc = snap.docs[0];
    const user = userDoc.data();

    const eligible = user.emailVerified === false
      && !["sospeso", "eliminato"].includes(user.status)
      && Date.now() - (user.verifyEmailSentAt || 0) >= RESEND_COOLDOWN_MS;

    if (eligible) {
      try {
        await issueVerification(userDoc.id, user);
      } catch (error) {
        console.error("Errore nel rinvio dell'email di verifica:", error);
      }
    }
  }

  return { ok: true };
});

exports.verifyEmail = onCall({ region: "europe-west1", secrets: [BREVO_API_KEY] }, async (req) => {
  const token = String(req.data?.token || "");

  if (!/^[A-Za-z0-9-]{16,128}$/.test(token)) {
    throw new HttpsError("invalid-argument", "Token non valido.");
  }

  const db = admin.firestore();
  const tokenRef = db.doc(`emailVerifications/${token}`);

  const result = await db.runTransaction(async (tx) => {
    const tokenSnap = await tx.get(tokenRef);
    if (!tokenSnap.exists) return { error: "not-found" };

    const data = tokenSnap.data();
    if (data.used) return { error: "used" };
    if (Date.now() > data.expiresAt) return { error: "expired" };

    const userRef = db.doc(`users/${data.userId}`);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return { error: "no-user" };

    const update = {
      emailVerified: true,
      verifyLink: admin.firestore.FieldValue.delete()
    };

    if (userSnap.data().status === "inattivo") update.status = "attivo";

    tx.update(userRef, update);
    tx.update(tokenRef, { used: true, usedAt: Date.now() });

    return { ok: true, userId: data.userId, email: userSnap.data().email };
  });

  if (result.error === "used") throw new HttpsError("failed-precondition", "Token già utilizzato.");
  if (result.error === "expired") throw new HttpsError("failed-precondition", "Token scaduto.");
  if (result.error) throw new HttpsError("not-found", "Token non valido o già usato.");

  try {
    await sendBrevoMail({
      to: result.email,
      subject: "Il link personale per il tuo profilo MyFrEM",
      htmlContent: verifiedEmailHtml({ userId: result.userId })
    });
  } catch (error) {
    console.error("Errore invio email di account verificato:", error);
  }

  return { ok: true };
});

const STAFF_GROUP = "GruppoMembriStaff@gruppi.friuliemergenze.it";

function staffNewUserHtml(user) {
  const row = (label, value) => `<b>${label}:</b> ${esc(value || "-")}<br>`;

  return `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          <tr><td style="padding:35px;text-align:center;">
            <img src="https://www.friuliemergenze.it/assets/logo.png" style="width:80px;margin-bottom:20px;" loading="lazy">
            <h1 style="color:#ff3b3b;margin:0;font-size:28px;">Nuovo utente registrato</h1>
            <p style="font-size:16px;color:#333;margin-top:25px;text-align:left;line-height:1.7;">
              ${row("Nome", `${user.name || ""} ${user.surname || ""}`.trim())}
              ${row("Email", user.email)}
              ${row("Username", user.username)}
              ${row("Telefono", user.phone)}
            </p>
            <p style="font-size:11px;color:#999;margin-top:25px;line-height:1.5;">MyFrEM · Friuli Emergenze<br><a href="https://friuliemergenze.it">friuliemergenze.it</a> · <a href="mailto:info@friuliemergenze.it">info@friuliemergenze.it</a></p>
          </td></tr>
        </table>
      </td></tr></table>
    </div>`;
}

async function notifyStaffNewUser(uid) {
  const ref = admin.firestore().doc(`users/${uid}`);

  const user = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data || data.staffNewUserNotifiedAt) return null;
    tx.update(ref, { staffNewUserNotifiedAt: admin.firestore.FieldValue.serverTimestamp() });
    return data;
  });

  if (!user) return;

  const name = `${user.name || ""} ${user.surname || ""}`.trim() || user.username || "Utente";

  try {
    await sendBrevoMail({
      to: STAFF_GROUP,
      toName: STAFF_GROUP,
      subject: `Nuovo utente registrato: ${name}`.replace(/[\r\n]+/g, " ").slice(0, 200),
      htmlContent: staffNewUserHtml(user)
    });
  } catch (error) {
    console.error("Errore invio avviso nuovo utente allo staff:", error);
  }
}

const TWOFA_PURPOSES = ["login", "setup", "manage"];
const TWOFA_TTL_MS = 10 * 60 * 1000;
const TWOFA_COOLDOWN_MS = 60 * 1000;
const TWOFA_MAX_ATTEMPTS = 5;

function twoFAHash(uid, purpose, code) {
  return crypto.createHash("sha256").update(`${uid}:${purpose}:${code}`).digest("hex");
}

function twoFAEmailHtml({ name, ip, code }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          <tr><td style="padding:35px;text-align:center;">
            <img src="https://www.friuliemergenze.it/assets/logo.png" style="width:80px;margin-bottom:20px;" loading="lazy">
            <h1 style="color:#ff7b00;margin:0;font-size:26px;">Codice di verifica</h1>
            <p style="font-size:16px;color:#333;margin-top:25px;">Ciao <b>${esc(name)}</b>, ecco il tuo codice per l'autenticazione a due fattori di MyFrEM:</p>
            <p style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#333;margin:25px 0;">${esc(code)}</p>
            <p style="color:#666;font-size:14px;line-height:1.6;">Il codice scade tra 10 minuti.${ip ? `<br>Richiesta da IP: ${esc(ip)}` : ""}</p>
            <p style="color:#888;font-size:13px;margin-top:25px;line-height:1.6;">Se non sei stato tu, cambia subito la password e scrivi a info@friuliemergenze.it.</p>
            <p style="font-size:11px;color:#999;margin-top:25px;line-height:1.5;">MyFrEM · Friuli Emergenze<br><a href="https://friuliemergenze.it">friuliemergenze.it</a> · <a href="mailto:info@friuliemergenze.it">info@friuliemergenze.it</a></p>
          </td></tr>
        </table>
      </td></tr></table>
    </div>`;
}

function readPurpose(data) {
  const purpose = String(data?.purpose || "");
  if (!TWOFA_PURPOSES.includes(purpose)) throw new HttpsError("invalid-argument", "Operazione non valida.");
  return purpose;
}

exports.send2FACode = onCall({ region: "europe-west1", secrets: [BREVO_API_KEY], maxInstances: 5 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Login richiesto.");

  const purpose = readPurpose(req.data);
  const uid = req.auth.uid;
  const db = admin.firestore();

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.data();
  const email = user?.email || req.auth.token.email;
  if (!user || !email) throw new HttpsError("not-found", "Profilo non trovato.");

  const usesEmail2FA = user.twoFactorEnabled === true && user.twoFactorMethod === "email";
  if (purpose === "setup" && user.twoFactorEnabled === true) throw new HttpsError("failed-precondition", "La 2FA è già attiva.");
  if (purpose !== "setup" && !usesEmail2FA) throw new HttpsError("failed-precondition", "La 2FA via email non è attiva.");

  const ref = db.doc(`twoFactorChallenges/${uid}`);
  const previous = (await ref.get()).data();
  if (previous && Date.now() - (previous.sentAt || 0) < TWOFA_COOLDOWN_MS) {
    throw new HttpsError("resource-exhausted", "Attendi un minuto prima di richiedere un nuovo codice.");
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");

  await ref.set({
    hash: twoFAHash(uid, purpose, code),
    purpose,
    attempts: 0,
    sentAt: Date.now(),
    expiresAt: Date.now() + TWOFA_TTL_MS
  });

  const forwarded = String(req.rawRequest?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  const name = `${user.name || ""} ${user.surname || ""}`.trim() || "utente";

  try {
    await sendBrevoMail({
      to: email,
      toName: name,
      subject: "Il tuo codice di verifica MyFrEM",
      htmlContent: twoFAEmailHtml({ name, ip: forwarded || req.rawRequest?.ip || "", code })
    });
  } catch (error) {
    await ref.delete().catch(() => {});
    console.error("Errore invio codice 2FA:", error);
    throw new HttpsError("internal", "Invio del codice non riuscito.");
  }

  return { ok: true };
});

exports.verify2FACode = onCall({ region: "europe-west1", maxInstances: 5 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Login richiesto.");

  const purpose = readPurpose(req.data);
  const code = String(req.data?.code || "").trim();
  if (!/^\d{6}$/.test(code)) throw new HttpsError("invalid-argument", "Il codice è di 6 cifre.");

  const uid = req.auth.uid;
  const ref = admin.firestore().doc(`twoFactorChallenges/${uid}`);

  const result = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();

    if (!data || data.purpose !== purpose) return "missing";
    if (Date.now() > data.expiresAt) {
      tx.delete(ref);
      return "expired";
    }
    if (data.attempts >= TWOFA_MAX_ATTEMPTS) {
      tx.delete(ref);
      return "locked";
    }

    const expected = Buffer.from(data.hash, "hex");
    const received = Buffer.from(twoFAHash(uid, purpose, code), "hex");

    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      tx.update(ref, { attempts: data.attempts + 1 });
      return "wrong";
    }

    tx.delete(ref);
    return "ok";
  });

  const messages = {
    missing: "Nessun codice attivo: richiedine uno nuovo.",
    expired: "Il codice è scaduto: richiedine uno nuovo.",
    locked: "Troppi tentativi: richiedi un nuovo codice.",
    wrong: "Codice non corretto."
  };

  if (result !== "ok") throw new HttpsError("permission-denied", messages[result]);
  return { ok: true };
});

const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  return name && domain ? `${name.slice(0, 3)}***@${domain}` : "";
}

function isPrivateUser(user) {
  return user.publicProfile === true || user.privateProfile === true;
}

function buildPublicProfile(user) {
  const isPrivate = isPrivateUser(user);
  const role = STAFF_ROLES.includes(user.role) ? user.role : (user.accountType === "association" ? "association" : "user");

  const profile = {
    name: String(user.name || "").slice(0, 80),
    surname: String(user.surname || "").slice(0, 80),
    username: String(user.username || "").slice(0, 40),
    photoURL: /^https:\/\//i.test(user.photoURL || "") ? user.photoURL : "",
    role,
    isStaff: STAFF_ROLES.includes(user.role),
    accountType: user.accountType === "association" ? "association" : "user",
    private: isPrivate,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (!isPrivate) {
    profile.bio = String(user.bio || "").slice(0, 1000);
    profile.createdAt = user.createdAt || null;
    profile.status = ["attivo", "inattivo", "sospeso"].includes(user.status) ? user.status : "attivo";
    profile.emailMasked = maskEmail(user.email);
  }

  return profile;
}

const VOL_QUALIFICHE = {
  blsd: "BLSD",
  pblsd: "PBLSD (pediatrico)",
  ptc: "PTC / trauma",
  soccorritore: "Soccorritore certificato",
  autista: "Autista soccorritore",
  patente_c: "Patente C",
  radio: "Operatore radio",
  aib: "Antincendio boschivo (AIB)",
  pc_base: "Protezione civile – corso base",
  motosega: "Uso della motosega"
};

const VOL_MANSIONI = {
  soccorritore: "Soccorritore",
  autista: "Autista",
  centralino: "Centralino e radio",
  logistica: "Logistica e magazzino",
  segreteria: "Segreteria",
  formazione: "Formazione",
  caposquadra: "Capo squadra"
};

const VOL_DAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
const VOL_SLOTS = ["mattina", "pomeriggio", "notte"];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanLine(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitizeVolunteer(v) {
  const seen = new Set();
  const qualifiche = (Array.isArray(v.qualifiche) ? v.qualifiche : [])
    .slice(0, 20)
    .map((q) => {
      const id = q && (Object.hasOwn(VOL_QUALIFICHE, q.id) || q.id === "altro") ? q.id : null;
      if (!id) return null;
      const nome = id === "altro" ? cleanLine(q.nome, 60) : VOL_QUALIFICHE[id];
      const key = id === "altro" ? `altro:${nome.toLowerCase()}` : id;
      if (!nome || seen.has(key)) return null;
      seen.add(key);
      return { id, nome, scadenza: ISO_DATE_RE.test(q.scadenza || "") ? q.scadenza : "" };
    })
    .filter(Boolean);

  const mansioni = [...new Set(Array.isArray(v.mansioni) ? v.mansioni : [])].filter((m) => Object.hasOwn(VOL_MANSIONI, m));

  const disponibilita = {};
  VOL_DAYS.forEach((day) => {
    const slots = Array.isArray(v.disponibilita?.[day]) ? VOL_SLOTS.filter((s) => v.disponibilita[day].includes(s)) : [];
    if (slots.length) disponibilita[day] = slots;
  });

  const pubblico = v.pubblico || {};

  return {
    qualifiche,
    mansioni,
    disponibilita,
    disponibileFino: v.disponibileFino instanceof admin.firestore.Timestamp ? v.disponibileFino : null,
    telefono: cleanLine(v.telefono, 30),
    note: String(v.note || "").trim().slice(0, 500),
    pubblico: {
      qualifiche: pubblico.qualifiche !== false,
      mansioni: pubblico.mansioni !== false,
      associazioni: pubblico.associazioni !== false
    }
  };
}

function romeDate(offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(Date.now() + offsetDays * 86400000));
}

function memberCopy(vol) {
  return {
    qualifiche: vol.qualifiche,
    mansioni: vol.mansioni,
    disponibilita: vol.disponibilita,
    disponibileFino: vol.disponibileFino,
    telefono: vol.telefono,
    note: vol.note,
    aggiornatoAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function publicVolunteer(vol, associationNames) {
  const today = romeDate();
  const qualifiche = vol.pubblico.qualifiche
    ? vol.qualifiche.filter((q) => !q.scadenza || q.scadenza >= today).map((q) => q.nome)
    : [];
  const mansioni = vol.pubblico.mansioni ? vol.mansioni.map((m) => VOL_MANSIONI[m]) : [];
  const associazioni = vol.pubblico.associazioni ? associationNames.filter(Boolean) : [];

  return qualifiche.length || mansioni.length || associazioni.length ? { qualifiche, mansioni, associazioni } : null;
}

async function membershipsOf(uid) {
  const db = admin.firestore();
  const assocs = await db.collection("associations").where("stato", "==", "approvata").get();
  if (assocs.empty) return [];

  const snaps = await db.getAll(...assocs.docs.map((a) => a.ref.collection("members").doc(uid)));

  return snaps
    .map((snap, i) => {
      if (!snap.exists || snap.data().role === "associazione") return null;
      return {
        ref: snap.ref,
        name: String(assocs.docs[i].data().nome || ""),
        confirmed: snap.data().stato === "confermata",
        hasCopy: snap.data().volontario !== undefined
      };
    })
    .filter(Boolean);
}

async function refreshVolunteer(uid) {
  const db = admin.firestore();
  const [volSnap, userSnap, memberships] = await Promise.all([
    db.doc(`volunteers/${uid}`).get(),
    db.doc(`users/${uid}`).get(),
    membershipsOf(uid)
  ]);

  const vol = volSnap.exists ? sanitizeVolunteer(volSnap.data()) : null;
  const batch = db.batch();

  memberships.forEach((m) => {
    if (m.confirmed && vol) batch.update(m.ref, { volontario: memberCopy(vol) });
    else if (m.hasCopy) batch.update(m.ref, { volontario: admin.firestore.FieldValue.delete() });
  });

  const user = userSnap.exists ? userSnap.data() : null;
  if (user && user.status !== "eliminato") {
    const pub = vol && !isPrivateUser(user)
      ? publicVolunteer(vol, memberships.filter((m) => m.confirmed).map((m) => m.name))
      : null;
    batch.set(db.doc(`publicProfiles/${uid}`), { volontario: pub || admin.firestore.FieldValue.delete() }, { merge: true });
  }

  await batch.commit();
}

exports.syncPublicProfile = onDocumentWritten({ document: "users/{uid}", region: "us-central1" }, async (event) => {
  const uid = event.params.uid;
  const ref = admin.firestore().doc(`publicProfiles/${uid}`);
  const after = event.data?.after?.exists ? event.data.after.data() : null;

  if (!after || after.status === "eliminato") {
    await ref.delete().catch(() => {});
    return;
  }

  const profile = buildPublicProfile(after);
  const current = await ref.get();
  const wasPublic = current.exists && current.data().private !== true;

  if (!profile.private && wasPublic && current.data().volontario) profile.volontario = current.data().volontario;

  await ref.set(profile);

  if (!profile.private && !wasPublic) await refreshVolunteer(uid);
});

exports.syncVolunteerProfile = onDocumentWritten({ document: "volunteers/{uid}", region: "us-central1" }, async (event) => {
  await refreshVolunteer(event.params.uid);
});

exports.syncVolunteerMembership = onDocumentWritten({ document: "associations/{assocId}/members/{uid}", region: "us-central1" }, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;

  if ((before?.stato === "confermata") === (after?.stato === "confermata")) return;
  if ((after || before)?.role === "associazione") return;

  await refreshVolunteer(event.params.uid);
});

exports.notifyExpiringQualifications = onSchedule({ schedule: "0 8 * * *", timeZone: "Europe/Rome", region: "europe-west1" }, async () => {
  const db = admin.firestore();
  const today = romeDate();
  const inAMonth = romeDate(30);
  const volunteers = await db.collection("volunteers").get();

  let batch = db.batch();
  let pending = 0;

  for (const volDoc of volunteers.docs) {
    for (const q of sanitizeVolunteer(volDoc.data()).qualifiche) {
      if (q.scadenza !== today && q.scadenza !== inAMonth) continue;

      const expiresToday = q.scadenza === today;
      batch.set(db.collection("notifications").doc(), {
        userId: volDoc.id,
        title: expiresToday ? "Qualifica scaduta" : "Qualifica in scadenza",
        message: expiresToday
          ? `${q.nome} scade oggi. Quando la rinnovi aggiorna la data nel profilo volontario.`
          : `${q.nome} scade tra 30 giorni. Ricordati di prenotare il retraining.`,
        icon: expiresToday ? "⚠️" : "⏳",
        actionUrl: "/dashboard/volunteers/profile/",
        actionLabel: "Profilo volontario",
        type: "volunteer_qualification_expiry",
        associationId: "",
        read: false,
        archived: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      pending++;
      if (pending % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
  }

  if (pending % 400 !== 0) await batch.commit();
});

exports.backfillPublicProfiles = onCall({ region: "europe-west1", timeoutSeconds: 540 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Login richiesto.");

  const db = admin.firestore();
  const caller = (await db.doc(`users/${req.auth.uid}`).get()).data();
  if (caller?.role !== "superadmin") throw new HttpsError("permission-denied", "Riservato ai superadmin.");

  const [users, volunteers, assocs] = await Promise.all([
    db.collection("users").get(),
    db.collection("volunteers").get(),
    db.collection("associations").where("stato", "==", "approvata").get()
  ]);

  const volunteerById = new Map(volunteers.docs.map((d) => [d.id, sanitizeVolunteer(d.data())]));
  const assocNamesByUid = new Map();

  await Promise.all(assocs.docs.map(async (a) => {
    const members = await a.ref.collection("members").where("stato", "==", "confermata").get();
    members.docs.forEach((m) => {
      if (m.data().role === "associazione") return;
      assocNamesByUid.set(m.id, [...(assocNamesByUid.get(m.id) || []), String(a.data().nome || "")]);
    });
  }));

  let written = 0;
  let batch = db.batch();

  for (const userDoc of users.docs) {
    const user = userDoc.data();
    const ref = db.doc(`publicProfiles/${userDoc.id}`);

    if (user.status === "eliminato") {
      batch.delete(ref);
    } else {
      const profile = buildPublicProfile(user);
      const vol = volunteerById.get(userDoc.id);
      const pub = vol && !profile.private ? publicVolunteer(vol, assocNamesByUid.get(userDoc.id) || []) : null;
      if (pub) profile.volontario = pub;
      batch.set(ref, profile);
    }

    written++;
    if (written % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  await batch.commit();
  return { ok: true, written };
});

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

function readUsername(data) {
  const username = String(data?.username || "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new HttpsError("invalid-argument", "Username non valido.");
  return username;
}

exports.resolveLoginEmail = onCall({ region: "europe-west1", maxInstances: 5 }, async (req) => {
  const typed = String(req.data?.username || "").trim();
  if (!typed || typed.length > 60 || /[\s/@]/.test(typed)) throw new HttpsError("not-found", "Credenziali errate.");

  const users = admin.firestore().collection("users");
  let snap = await users.where("username", "==", typed).limit(1).get();
  if (snap.empty && typed !== typed.toLowerCase()) {
    snap = await users.where("username", "==", typed.toLowerCase()).limit(1).get();
  }

  const email = snap.empty ? "" : snap.docs[0].data().email;
  if (!email) throw new HttpsError("not-found", "Credenziali errate.");
  return { email };
});

exports.checkUsernameAvailable = onCall({ region: "europe-west1", maxInstances: 5 }, async (req) => {
  const username = readUsername(req.data);
  const snap = await admin.firestore().collection("users").where("username", "==", username).limit(1).get();
  return { available: snap.empty };
});

const FEED_REPORT_THRESHOLD = 3;
const TRIGGER_REGION = "us-central1";

function writeDelta(event) {
  const before = event.data?.before?.exists;
  const after = event.data?.after?.exists;
  if (after && !before) return 1;
  if (before && !after) return -1;
  return 0;
}

function notificationDoc({ userId, title, message, icon, actionUrl, actionLabel, type, associationId = "" }) {
  return {
    userId,
    title,
    message,
    icon,
    actionUrl,
    actionLabel,
    type,
    associationId,
    read: false,
    archived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

async function addNotifications(docs) {
  const db = admin.firestore();
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.set(db.collection("notifications").doc(), d));
    await batch.commit();
  }
}

async function confirmedMemberIds(assocId, roles = ["membro", "referente"]) {
  const snap = await admin.firestore().collection(`associations/${assocId}/members`).where("stato", "==", "confermata").get();
  return snap.docs.filter((d) => roles.includes(d.data().role)).map((d) => d.id);
}

exports.feedLikeCounter = onDocumentWritten({ document: "feedPosts/{postId}/likes/{uid}", region: TRIGGER_REGION }, async (event) => {
  const delta = writeDelta(event);
  if (!delta) return;
  await admin.firestore().doc(`feedPosts/${event.params.postId}`)
    .update({ likeCount: admin.firestore.FieldValue.increment(delta) })
    .catch(() => {});
});

exports.feedCommentCounter = onDocumentWritten({ document: "feedPosts/{postId}/comments/{commentId}", region: TRIGGER_REGION }, async (event) => {
  const delta = writeDelta(event);
  if (!delta) return;

  const ref = admin.firestore().doc(`feedPosts/${event.params.postId}`);
  await ref.update({ commentCount: admin.firestore.FieldValue.increment(delta) }).catch(() => {});
  if (delta !== 1) return;

  const comment = event.data.after.data();
  const post = (await ref.get()).data();
  if (!post || post.authorUid === comment.authorUid) return;

  await addNotifications([notificationDoc({
    userId: post.authorUid,
    title: "Nuovo commento",
    message: `${cleanLine(comment.authorName, 80) || "Qualcuno"} ha commentato il tuo post.`,
    icon: "💬",
    actionUrl: "/dashboard/volunteers/",
    actionLabel: "Apri il feed",
    type: "feed_comment",
    associationId: post.associationId || ""
  })]);
});

exports.feedReportCounter = onDocumentWritten({ document: "feedPosts/{postId}/reports/{uid}", region: TRIGGER_REGION }, async (event) => {
  if (writeDelta(event) !== 1) return;

  const db = admin.firestore();
  const ref = db.doc(`feedPosts/${event.params.postId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;

    const post = snap.data();
    const reportCount = (post.reportCount || 0) + 1;
    const update = { reportCount };
    if (reportCount >= FEED_REPORT_THRESHOLD && !post.hidden) {
      update.hidden = true;
      update.autoHidden = true;
    }
    tx.update(ref, update);
  });
});

exports.feedPostLifecycle = onDocumentWritten({ document: "feedPosts/{postId}", region: TRIGGER_REGION }, async (event) => {
  const db = admin.firestore();
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;

  if (before && !after) {
    await db.recursiveDelete(db.doc(`feedPosts/${event.params.postId}`));
    return;
  }

  if (before || !after || !after.official || !after.associationId) return;

  const recipients = (await confirmedMemberIds(after.associationId)).filter((uid) => uid !== after.authorUid);
  await addNotifications(recipients.map((userId) => notificationDoc({
    userId,
    title: `Comunicazione da ${cleanLine(after.associationName, 80) || "la tua associazione"}`,
    message: cleanLine(after.text, 140) || "È stata pubblicata una nuova comunicazione ufficiale.",
    icon: "📣",
    actionUrl: "/dashboard/volunteers/",
    actionLabel: "Leggi",
    type: "feed_official",
    associationId: after.associationId
  })));
});

exports.migrateBoardPosts = onCall({ region: "europe-west1", timeoutSeconds: 540 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Login richiesto.");

  const db = admin.firestore();
  const caller = (await db.doc(`users/${req.auth.uid}`).get()).data();
  if (caller?.role !== "superadmin") throw new HttpsError("permission-denied", "Riservato ai superadmin.");

  const assocs = await db.collection("associations").get();
  let migrated = 0;
  let skipped = 0;

  for (const assoc of assocs.docs) {
    const posts = await assoc.ref.collection("posts").get();
    if (posts.empty) continue;

    const targets = posts.docs.map((p) => db.doc(`feedPosts/legacy_${assoc.id}_${p.id}`));
    const existing = await db.getAll(...targets);
    let batch = db.batch();
    let pending = 0;

    for (let i = 0; i < posts.docs.length; i++) {
      if (existing[i].exists) {
        skipped++;
        continue;
      }

      const p = posts.docs[i].data();
      batch.set(targets[i], {
        authorUid: String(p.authorUid || ""),
        authorName: cleanLine(p.authorName, 120) || "Associazione",
        authorPhoto: "",
        authorRole: ["associazione", "referente"].includes(p.authorRole) ? p.authorRole : "associazione",
        associationId: assoc.id,
        associationName: cleanLine(assoc.data().nome, 120),
        visibility: "association",
        official: true,
        text: String(p.text || "").slice(0, 2000),
        media: /^https:\/\//i.test(p.imageUrl || "") ? [{ type: "image", url: p.imageUrl }] : [],
        hidden: false,
        likeCount: 0,
        commentCount: 0,
        reportCount: 0,
        legacy: true,
        createdAt: p.createdAt || admin.firestore.FieldValue.serverTimestamp()
      });

      migrated++;
      pending++;
      if (pending === 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }

    if (pending) await batch.commit();
  }

  return { ok: true, migrated, skipped };
});

function shiftHours(inizio, fine) {
  const toMinutes = (t) => {
    const [h, m] = String(t || "").split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  const start = toMinutes(inizio);
  const end = toMinutes(fine);
  if (start === null || end === null) return 0;
  let minutes = end - start;
  if (minutes <= 0) minutes += 1440;
  return Math.round(minutes / 15) / 4;
}

async function syncShiftItem(assocId, shiftId, uid) {
  const db = admin.firestore();
  const shiftRef = db.doc(`associations/${assocId}/shifts/${shiftId}`);
  const itemRef = db.doc(`volunteerShifts/${uid}/turni/${assocId}_${shiftId}`);

  const [shiftSnap, signupSnap, assocSnap] = await Promise.all([
    shiftRef.get(),
    shiftRef.collection("signups").doc(uid).get(),
    db.doc(`associations/${assocId}`).get()
  ]);

  if (!shiftSnap.exists || !signupSnap.exists) {
    await itemRef.delete().catch(() => {});
    return;
  }

  const shift = shiftSnap.data();
  const signup = signupSnap.data();

  await itemRef.set({
    associationId: assocId,
    associationName: cleanLine(assocSnap.data()?.nome, 120),
    shiftId,
    titolo: cleanLine(shift.titolo, 80),
    data: shift.data,
    inizio: shift.inizio,
    fine: shift.fine,
    luogo: cleanLine(shift.luogo, 120),
    ore: shiftHours(shift.inizio, shift.fine),
    statoTurno: shift.stato,
    stato: signup.stato,
    presente: signup.presente !== false,
    aggiornatoAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function refreshShiftCounts(assocId, shiftId) {
  const ref = admin.firestore().doc(`associations/${assocId}/shifts/${shiftId}`);
  const signups = await ref.collection("signups").get();
  const count = (stato) => signups.docs.filter((d) => d.data().stato === stato).length;
  await ref.update({ candidati: count("candidato"), confermati: count("confermato") }).catch(() => {});
}

function shiftWhen(shift) {
  const date = ISO_DATE_RE.test(shift.data || "")
    ? new Date(`${shift.data}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    : "";
  return `${date} ${shift.inizio || ""}-${shift.fine || ""}`.trim();
}

exports.syncShiftSignup = onDocumentWritten({ document: "associations/{assocId}/shifts/{shiftId}/signups/{uid}", region: TRIGGER_REGION }, async (event) => {
  const { assocId, shiftId, uid } = event.params;
  await Promise.all([syncShiftItem(assocId, shiftId, uid), refreshShiftCounts(assocId, shiftId)]);

  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  if (!after || after.stato === before?.stato || !["confermato", "rifiutato"].includes(after.stato)) return;

  const shift = (await admin.firestore().doc(`associations/${assocId}/shifts/${shiftId}`).get()).data();
  if (!shift) return;

  const confirmed = after.stato === "confermato";
  await addNotifications([notificationDoc({
    userId: uid,
    title: confirmed ? "Turno confermato" : "Candidatura non accettata",
    message: confirmed
      ? `Sei confermato per "${cleanLine(shift.titolo, 80)}", ${shiftWhen(shift)}.`
      : `La tua candidatura per "${cleanLine(shift.titolo, 80)}" non è stata accettata.`,
    icon: confirmed ? "✅" : "ℹ️",
    actionUrl: "/dashboard/volunteers/shifts/",
    actionLabel: "I miei turni",
    type: "shift_decision",
    associationId: assocId
  })]);
});

exports.syncShift = onDocumentWritten({ document: "associations/{assocId}/shifts/{shiftId}", region: TRIGGER_REGION }, async (event) => {
  const db = admin.firestore();
  const { assocId, shiftId } = event.params;
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const signupsRef = db.collection(`associations/${assocId}/shifts/${shiftId}/signups`);

  if (!after) {
    const signups = await signupsRef.get();
    await Promise.all(signups.docs.map((d) => db.doc(`volunteerShifts/${d.id}/turni/${assocId}_${shiftId}`).delete().catch(() => {})));
    await db.recursiveDelete(db.doc(`associations/${assocId}/shifts/${shiftId}`));
    return;
  }

  if (!before) {
    const assocName = cleanLine((await db.doc(`associations/${assocId}`).get()).data()?.nome, 80);
    const recipients = (await confirmedMemberIds(assocId)).filter((uid) => uid !== after.creatoDa);
    await addNotifications(recipients.map((userId) => notificationDoc({
      userId,
      title: "Nuovo turno disponibile",
      message: `${assocName || "La tua associazione"}: "${cleanLine(after.titolo, 80)}", ${shiftWhen(after)}.`,
      icon: "🗓️",
      actionUrl: "/dashboard/volunteers/shifts/",
      actionLabel: "Candidati",
      type: "shift_new",
      associationId: assocId
    })));
    return;
  }

  const changed = ["titolo", "data", "inizio", "fine", "luogo", "stato"].some((k) => before[k] !== after[k]);
  if (!changed) return;

  const signups = await signupsRef.get();
  await Promise.all(signups.docs.map((d) => syncShiftItem(assocId, shiftId, d.id)));

  if (before.stato !== "annullato" && after.stato === "annullato") {
    await addNotifications(signups.docs
      .filter((d) => ["candidato", "confermato"].includes(d.data().stato))
      .map((d) => notificationDoc({
        userId: d.id,
        title: "Turno annullato",
        message: `Il turno "${cleanLine(after.titolo, 80)}" di ${shiftWhen(after)} è stato annullato.`,
        icon: "⚠️",
        actionUrl: "/dashboard/volunteers/shifts/",
        actionLabel: "I miei turni",
        type: "shift_cancelled",
        associationId: assocId
      })));
  }
});

const VOLUNTEER_BADGES = {
  "volontario-primo-turno": { name: "Primo turno", description: "Ha svolto il primo turno di servizio con la sua associazione." },
  "volontario-10-turni": { name: "10 turni", description: "Ha svolto 10 turni di servizio." },
  "volontario-50-turni": { name: "50 turni", description: "Ha svolto 50 turni di servizio." },
  "volontario-50-ore": { name: "50 ore di servizio", description: "Ha raggiunto 50 ore di servizio confermate." },
  "volontario-100-ore": { name: "100 ore di servizio", description: "Ha raggiunto 100 ore di servizio confermate." },
  "volontario-500-ore": { name: "500 ore di servizio", description: "Ha raggiunto 500 ore di servizio confermate." },
  "volontario-1-anno": { name: "Un anno in associazione", description: "Fa parte della sua associazione da almeno un anno." },
  "volontario-primo-post": { name: "Primo post", description: "Ha pubblicato il primo post nel feed della community." }
};

exports.assignVolunteerBadges = onSchedule({ schedule: "30 3 * * *", timeZone: "Europe/Rome", region: "europe-west1", timeoutSeconds: 540 }, async () => {
  const db = admin.firestore();

  const metaRefs = Object.keys(VOLUNTEER_BADGES).map((id) => db.doc(`badges/${id}`));
  const metaSnaps = await db.getAll(...metaRefs);
  const metaBatch = db.batch();
  metaSnaps.forEach((snap, i) => {
    if (snap.exists) return;
    const id = metaRefs[i].id;
    metaBatch.set(metaRefs[i], {
      id,
      ...VOLUNTEER_BADGES[id],
      color: "#1fc8db",
      icon: "/assets/badges/default.svg",
      criteria: { type: "volunteer", threshold: 0 },
      enabled: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await metaBatch.commit();

  const earned = new Map();
  const give = (uid, badge) => {
    if (!uid) return;
    if (!earned.has(uid)) earned.set(uid, new Set());
    earned.get(uid).add(badge);
  };

  const today = romeDate();
  const owners = await db.collection("volunteerShifts").listDocuments();
  for (const owner of owners) {
    const items = await owner.collection("turni").where("stato", "==", "confermato").get();
    const done = items.docs.map((d) => d.data()).filter((i) => i.presente !== false && i.statoTurno !== "annullato" && i.data < today);
    const hours = done.reduce((sum, i) => sum + (Number(i.ore) || 0), 0);

    if (done.length >= 1) give(owner.id, "volontario-primo-turno");
    if (done.length >= 10) give(owner.id, "volontario-10-turni");
    if (done.length >= 50) give(owner.id, "volontario-50-turni");
    if (hours >= 50) give(owner.id, "volontario-50-ore");
    if (hours >= 100) give(owner.id, "volontario-100-ore");
    if (hours >= 500) give(owner.id, "volontario-500-ore");
  }

  const posts = await db.collection("feedPosts").select("authorUid").get();
  posts.docs.forEach((d) => give(d.get("authorUid"), "volontario-primo-post"));

  const yearAgo = Date.now() - 365 * 86400000;
  const assocs = await db.collection("associations").where("stato", "==", "approvata").get();
  for (const assoc of assocs.docs) {
    const members = await assoc.ref.collection("members").where("stato", "==", "confermata").get();
    members.docs.forEach((m) => {
      const since = m.data().createdAt?.toMillis?.();
      if (m.data().role !== "associazione" && since && since <= yearAgo) give(m.id, "volontario-1-anno");
    });
  }

  for (const [uid, badges] of earned) {
    const userRef = db.doc(`users/${uid}`);
    const [userSnap, existing] = await Promise.all([userRef.get(), userRef.collection("badges").select().get()]);
    if (!userSnap.exists) continue;

    const have = new Set(existing.docs.map((d) => d.id));
    const fresh = [...badges].filter((b) => !have.has(b));
    if (!fresh.length) continue;

    const batch = db.batch();
    fresh.forEach((badge) => batch.set(userRef.collection("badges").doc(badge), {
      assignedAt: admin.firestore.FieldValue.serverTimestamp(),
      notificationSent: false,
      from: "system"
    }, { merge: true }));
    await batch.commit();

    await addNotifications(fresh.map((badge) => notificationDoc({
      userId: uid,
      title: "Nuovo badge",
      message: `Hai ottenuto il badge "${VOLUNTEER_BADGES[badge].name}".`,
      icon: "🏅",
      actionUrl: "/dashboard/settings/",
      actionLabel: "Vedi i badge",
      type: "badge_earned"
    })));
  }
});

const ACCOUNT_RETENTION_DAYS = 30;

async function purgeUser(uid, user) {
  const db = admin.firestore();

  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }

  const memberships = await membershipsOf(uid);
  const notifications = await db.collection("notifications").where("userId", "==", uid).get();

  await Promise.all([
    ...memberships.map((m) => m.ref.delete()),
    ...notifications.docs.map((d) => d.ref.delete()),
    db.doc(`volunteers/${uid}`).delete(),
    db.doc(`twoFactorChallenges/${uid}`).delete(),
    db.recursiveDelete(db.doc(`volunteerShifts/${uid}`))
  ]);

  await db.recursiveDelete(db.doc(`users/${uid}`));
  await db.doc(`publicProfiles/${uid}`).delete();

  await db.collection("activities").add({
    type: "user_permanent_deletion",
    userId: uid,
    userName: `${user.name || ""} ${user.surname || ""}`.trim() || user.username || uid,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
}

exports.purgeDeletedUsers = onSchedule({ schedule: "15 4 * * *", timeZone: "Europe/Rome", region: "europe-west1", timeoutSeconds: 540 }, async () => {
  const db = admin.firestore();
  const cutoff = Date.now() - ACCOUNT_RETENTION_DAYS * 86400000;
  const snap = await db.collection("users").where("status", "==", "eliminato").get();

  let purged = 0;
  for (const userDoc of snap.docs) {
    const user = userDoc.data();
    const deletedAt = user.deletedAt?.toMillis?.();

    if (!deletedAt) {
      await userDoc.ref.update({ deletedAt: admin.firestore.FieldValue.serverTimestamp() });
      continue;
    }
    if (deletedAt > cutoff) continue;

    try {
      await purgeUser(userDoc.id, user);
      purged++;
    } catch (error) {
      console.error(`Eliminazione definitiva non riuscita per ${userDoc.id}:`, error);
    }
  }

  console.log(`Account eliminati definitivamente: ${purged}`);
});

const NEWSLETTER_SITE = "https://www.friuliemergenze.it";
const NEWSLETTER_RESEND_MS = 2 * 60 * 1000;

function newsletterEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 200 || !EMAIL_RE.test(email)) throw new HttpsError("invalid-argument", "Indirizzo email non valido.");
  return email;
}

function newsletterConfirmHtml({ name, link }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          <tr><td style="padding:35px;text-align:center;">
            <img src="https://www.friuliemergenze.it/assets/logo.png" style="width:80px;margin-bottom:20px;" loading="lazy">
            <h1 style="color:#ff3b3b;margin:0;font-size:28px;">Conferma l'iscrizione</h1>
            <p style="font-size:18px;color:#333;margin-top:25px;">Ciao <b>${esc(name || "")}</b>,</p>
            <p style="color:#555;line-height:1.7;font-size:17px;margin-top:20px;">Grazie per esserti iscritto alla newsletter di <b>Friuli Emergenze</b>.<br><br>Per iniziare a riceverla conferma il tuo indirizzo email con il pulsante qui sotto.</p>
            <a href="${link}" style="display:inline-block;padding:15px 24px;background:#ff3b3b;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;margin-top:25px;font-size:16px;">Conferma iscrizione</a>
            <p style="color:#888;font-size:13px;margin-top:25px;line-height:1.6;">Se il pulsante non funziona, copia questo link nel browser:<br><br><a href="${link}" style="color:#ff3b3b;">${link}</a></p>
            <p style="font-size:11px;color:#999;margin-top:25px;line-height:1.5;">Friuli Emergenze<br>Hai ricevuto questa email perché qualcuno ha iscritto questo indirizzo alla newsletter.<br>Se non sei stato tu, ignora questa email: senza conferma non riceverai nulla.<br><br><a href="https://friuliemergenze.it">friuliemergenze.it</a> · <a href="mailto:info@friuliemergenze.it">info@friuliemergenze.it</a></p>
          </td></tr>
        </table>
      </td></tr></table>
    </div>`;
}

async function findSubscription(field, value) {
  const snap = await admin.firestore().collection("newsletterSubs").where(field, "==", value).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

async function setUserNewsletterFlag(email, subscribed) {
  const users = await admin.firestore().collection("users").where("email", "==", email).limit(5).get();
  await Promise.all(users.docs.map((d) => d.ref.update({ newsSubbed: subscribed }).catch(() => {})));
}

exports.newsletterSubscribe = onCall({ region: "europe-west1", secrets: [BREVO_API_KEY], maxInstances: 5 }, async (req) => {
  const email = newsletterEmail(req.data?.email);
  const name = cleanLine(req.data?.name, 80);
  const existing = await findSubscription("email", email);

  if (existing?.data().subscribed) return { status: "already" };

  if (existing && Date.now() - (existing.data().lastMailAt?.toMillis?.() || 0) < NEWSLETTER_RESEND_MS) {
    return { status: "sent" };
  }

  const token = crypto.randomUUID();
  const fields = {
    email,
    name: name || existing?.data().name || "",
    verified: false,
    subscribed: false,
    verifiedAt: null,
    token,
    lastMailAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (existing) await existing.ref.update(fields);
  else await admin.firestore().collection("newsletterSubs").add({ ...fields, createdAt: admin.firestore.FieldValue.serverTimestamp() });

  await sendBrevoMail({
    to: email,
    toName: fields.name,
    subject: "Conferma l'iscrizione alla newsletter di Friuli Emergenze",
    htmlContent: newsletterConfirmHtml({ name: fields.name, link: `${NEWSLETTER_SITE}/newsletter/confirm/?token=${encodeURIComponent(token)}` })
  });

  return { status: "sent" };
});

exports.newsletterConfirm = onCall({ region: "europe-west1", maxInstances: 5 }, async (req) => {
  const token = String(req.data?.token || "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { status: "invalid" };

  const sub = await findSubscription("token", token);
  if (!sub) return { status: "invalid" };

  if (!sub.data().subscribed) {
    await sub.ref.update({
      subscribed: true,
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await setUserNewsletterFlag(sub.data().email, true);
  }

  return { status: "confirmed" };
});

exports.newsletterStatus = onCall({ region: "europe-west1", maxInstances: 5 }, async (req) => {
  const sub = await findSubscription("email", newsletterEmail(req.data?.email));
  if (!sub) return { found: false };
  return { found: true, verified: sub.data().verified === true, subscribed: sub.data().subscribed === true };
});

exports.newsletterUnsubscribe = onCall({ region: "europe-west1", maxInstances: 5 }, async (req) => {
  const email = newsletterEmail(req.data?.email);
  const sub = await findSubscription("email", email);
  if (!sub) return { status: "not_found" };

  await sub.ref.update({
    subscribed: false,
    unsubscribedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await setUserNewsletterFlag(email, false);

  return { status: "unsubscribed" };
});
