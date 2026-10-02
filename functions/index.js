const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

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