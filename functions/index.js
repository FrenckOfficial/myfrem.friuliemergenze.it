const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      role: "user",
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