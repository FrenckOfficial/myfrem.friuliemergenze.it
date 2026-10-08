import { createHash, timingSafeEqual } from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const SITE_URL = process.env.SITE_URL || "https://myfrem.friuliemergenze.it";
const ALLOWED_ORIGINS = [SITE_URL];

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

function tokenMatches(token, storedHashHex) {
  if (typeof storedHashHex !== "string" || !/^[a-f0-9]{64}$/.test(storedHashHex)) return false;

  const incoming = createHash("sha256").update(token).digest();
  const stored = Buffer.from(storedHashHex, "hex");

  return incoming.length === stored.length && timingSafeEqual(incoming, stored);
}

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.error("FIREBASE_SERVICE_ACCOUNT non configurata");
      return res.status(500).json({ error: "Configurazione server errata" });
    }

    const { requestId, token } = req.body || {};

    if (typeof requestId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(requestId)) {
      return res.status(400).json({ error: "Link non valido" });
    }

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ error: "Link non valido" });
    }

    const db = getFirestore(getAdminApp());
    const ref = db.collection("associationRequests").doc(requestId);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists) {
        throw new HttpError(404, "Richiesta non trovata");
      }

      const d = snap.data();

      if (d.confirmedMail === true) {
        return { alreadyConfirmed: true };
      }

      if (d.status !== "in_attesa") {
        throw new HttpError(409, "La richiesta non è più in attesa");
      }

      if (!d.confirmTokenHash || !tokenMatches(token, d.confirmTokenHash)) {
        throw new HttpError(403, "Link non valido o sostituito da uno più recente");
      }

      const expiresAt = d.confirmTokenExpiresAt?.toMillis?.() || 0;

      if (!expiresAt || Date.now() > expiresAt) {
        throw new HttpError(410, "Link scaduto. Invia una nuova richiesta o scrivi a info@friuliemergenze.it");
      }

      tx.update(ref, {
        confirmedMail: true,
        confirmedAt: FieldValue.serverTimestamp(),
        confirmTokenHash: FieldValue.delete(),
        confirmTokenExpiresAt: FieldValue.delete()
      });

      return { alreadyConfirmed: false };
    });

    return res.status(200).json({ success: true, alreadyConfirmed: result.alreadyConfirmed });

  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ success: false, error: error.message });
    }

    console.error("Server error:", error.message);
    return res.status(500).json({ success: false, error: "Errore interno del server" });
  }
}