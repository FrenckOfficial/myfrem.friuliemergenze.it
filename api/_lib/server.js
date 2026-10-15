import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const STAFF_ROLES = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];
export const MAIL_SENDER = { name: "Friuli Emergenze", email: "autosystem@friuliemergenze.it" };
export const MAIL_REPLY_TO = { name: "Friuli Emergenze", email: "info@friuliemergenze.it" };

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

  return initializeApp({ credential: cert(serviceAccount) });
}

export function db() {
  return getFirestore(getAdminApp());
}

export function escapeHtml(value, max = 5000) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .substring(0, max);
}

export function plainText(value, max = 150) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().substring(0, max);
}

export function preflight(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return false;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return false;
  }

  return true;
}

export async function requireUser(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) throw new HttpError(401, "Login richiesto");

  try {
    return await getAuth(getAdminApp()).verifyIdToken(header.slice(7));
  } catch {
    throw new HttpError(401, "Token non valido");
  }
}

export async function getUser(uid) {
  const snap = await db().doc(`users/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

export async function requireStaff(req) {
  const decoded = await requireUser(req);
  const user = await getUser(decoded.uid);
  if (!user || !STAFF_ROLES.includes(user.role)) throw new HttpError(403, "Riservato allo staff");
  return { decoded, user };
}

export async function getPhoto(photoId) {
  if (typeof photoId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(photoId)) {
    throw new HttpError(400, "Foto non valida");
  }

  const ref = db().doc(`photos/${photoId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Foto non trovata");
  return { ref, photo: snap.data() };
}

export function photoStatus(photo) {
  const status = String(photo?.status || "").toLowerCase();
  if (status.includes("approvat")) return "approved";
  if (status.includes("rifiutat")) return "rejected";
  return "pending";
}

export function fullName(user) {
  return `${user?.name || ""} ${user?.surname || ""}`.trim() || user?.username || "Utente";
}

export async function sendMail({ to, toName, subject, htmlContent }) {
  if (!process.env.BREVO_API_KEY) throw new HttpError(500, "Configurazione server errata");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": process.env.BREVO_API_KEY },
    body: JSON.stringify({
      sender: MAIL_SENDER,
      to: [{ email: to, name: toName || to }],
      subject: plainText(subject, 200),
      htmlContent,
      replyTo: MAIL_REPLY_TO
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Brevo ha rifiutato l'invio:", response.status, detail);
    throw new HttpError(502, "Errore nell'invio dell'email");
  }
}

export function fail(res, error) {
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  console.error("Errore interno:", error);
  return res.status(500).json({ error: "Errore interno del server" });
}
