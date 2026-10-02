import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

let db;

function getDb() {
  if (db) return db;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Variabile d'ambiente FIREBASE_SERVICE_ACCOUNT mancante");
  }

  const serviceAccount = JSON.parse(raw);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert(serviceAccount) });

  db = getFirestore(app);
  return db;
}

const STATI_APPROVATI = ['Approvata ✅', 'Approvata'];

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const oraRoma = Number(
    new Intl.DateTimeFormat('it-IT', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Europe/Rome',
    }).format(new Date())
  );

  if (oraRoma !== 15) {
    return res.status(200).json({ skipped: true, message: `Ora locale ${oraRoma}, non eseguo` });
  }

  try {
    const db = getDb();

    const [utentiSnapshot, fotoSnapshot, sondaggiSnapshot] = await Promise.all([
      db.collection('users').get(),
      db.collection('photos').get(),
      db.collection('survey_responses').select('userId').get(),
    ]);

    const sondaggiPerUtente = new Map();
    sondaggiSnapshot.docs.forEach((d) => {
      const uid = d.get('userId');
      if (uid) sondaggiPerUtente.set(uid, (sondaggiPerUtente.get(uid) || 0) + 1);
    });

    const foto = fotoSnapshot.docs.map((d) => ({
      id: d.id,
      userId: d.get('userId'),
      status: d.get('status'),
      serviceType: d.get('serviceType'),
      voti: 0,
    }));

    const votiDatiPerUtente = new Map();
    const CHUNK = 25;
    for (let i = 0; i < foto.length; i += CHUNK) {
      const chunk = foto.slice(i, i + CHUNK);
      await Promise.all(
        chunk.map(async (f) => {
          const votesSnap = await db
            .collection('photos')
            .doc(f.id)
            .collection('votes')
            .select()
            .get();
          f.voti = votesSnap.size;
          votesSnap.docs.forEach((v) => {
            votiDatiPerUtente.set(v.id, (votiDatiPerUtente.get(v.id) || 0) + 1);
          });
        })
      );
    }

    const fotoApprovatePerUtente = new Map();
    foto.forEach((f) => {
      if (!f.userId || !STATI_APPROVATI.includes(f.status)) return;
      if (!fotoApprovatePerUtente.has(f.userId)) fotoApprovatePerUtente.set(f.userId, []);
      fotoApprovatePerUtente.get(f.userId).push(f);
    });

    let assegnati = 0;

    for (const doc of utentiSnapshot.docs) {
      const utente_id = doc.id;
      const utente = doc.data();

      try {
        const guadagnati = new Set();

        checkIscrizioneLength(utente.createdAt, guadagnati);
        checkFotografici(fotoApprovatePerUtente.get(utente_id) || [], guadagnati);
        checkPartecipazione(
          sondaggiPerUtente.get(utente_id) || 0,
          votiDatiPerUtente.get(utente_id) || 0,
          fotoApprovatePerUtente.get(utente_id) || [],
          guadagnati
        );

        assegnati += await assignBadges(db, utente_id, guadagnati);
      } catch (err) {
        console.error(`Errore badge per utente ${utente_id}:`, err);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Badge assegnati',
      nuoviBadge: assegnati,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

function checkIscrizioneLength(createdAt, guadagnati) {
  if (!createdAt) return;

  const createdAtDate = createdAt?.toDate?.() || new Date(createdAt);
  if (Number.isNaN(createdAtDate.getTime())) return;

  const giorni = Math.floor((Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24));

  if (giorni >= 90) guadagnati.add('membro-da-3-mesi');
  if (giorni >= 180) guadagnati.add('membro-da-6-mesi');
  if (giorni >= 365) guadagnati.add('membro-da-1-anno');
  if (giorni >= 730) guadagnati.add('membro-fedele');
}

function checkFotografici(fotoUtente, guadagnati) {
  const totalFoto = fotoUtente.length;

  if (totalFoto >= 1) guadagnati.add('primo-scatto');
  if (totalFoto >= 10) guadagnati.add('fotografo-attivo');
  if (totalFoto >= 50) guadagnati.add('fotografo-esperto');

  const servizi = new Set(fotoUtente.map((f) => f.serviceType).filter(Boolean));
  if (servizi.size >= 5) guadagnati.add('collezionista');

  if (fotoUtente.some((f) => f.voti >= 100)) guadagnati.add('foto-virale');

  const fotoAmate = fotoUtente.filter((f) => f.voti >= 50).length;
  if (fotoAmate >= 3) guadagnati.add('amato-dalla-comunit');

  const votiTotali = fotoUtente.reduce((somma, f) => somma + f.voti, 0);
  if (votiTotali >= 500) guadagnati.add('fotografo-apprezzato');
}

function checkPartecipazione(totalSondaggi, votiDati, fotoUtente, guadagnati) {
  if (totalSondaggi >= 10) guadagnati.add('sondaggista');
  if (totalSondaggi >= 25) guadagnati.add('partecipante-attivo');
  if (totalSondaggi + votiDati >= 100) guadagnati.add('community-hero');

  if (votiDati >= 1) guadagnati.add('primo-voto');
  if (votiDati >= 100) guadagnati.add('super-voter');
  if (fotoUtente.length >= 50) guadagnati.add('cicogna-emergenze');
}

async function assignBadges(db, utente_id, guadagnati) {
  if (guadagnati.size === 0) return 0;

  const badgesRef = db.collection('users').doc(utente_id).collection('badges');

  const esistentiSnap = await badgesRef.select().get();
  const esistenti = new Set(esistentiSnap.docs.map((d) => d.id));

  const nuovi = [...guadagnati].filter((b) => !esistenti.has(b));
  if (nuovi.length === 0) return 0;

  const batch = db.batch();
  nuovi.forEach((badge_name) => {
    batch.set(
      badgesRef.doc(badge_name),
      {
        assignedAt: FieldValue.serverTimestamp(),
        notificationSent: false,
        from: 'system',
      },
      { merge: true }
    );
  });
  await batch.commit();
  
  return nuovi.length;
}