import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, serverTimestamp } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const utentiSnapshot = await db.collection('users').get();

    for (const doc of utentiSnapshot.docs) {
      const utente = doc.data();
      const utente_id = doc.id;

      await checkIscrizioneLength(utente_id, utente.createdAt);
      await checkFotograficiStandardandSpecial(utente_id);
      await checkPartecipazione(utente_id);
      await checkDivertenti(utente_id);
    }

    return res.status(200).json({ success: true, message: 'Badge assegnati' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

async function checkIscrizioneLength(utente_id, createdAt) {
  const createdAtDate = createdAt?.toDate?.() || new Date(createdAt);
  const giorni_iscritti = Math.floor(
    (Date.now() - createdAtDate) / (1000 * 60 * 60 * 24)
  );

  if (giorni_iscritti >= 365) {
    await assignBadge(utente_id, 'membro-da-1-anno');
  }
  if (giorni_iscritti >= 180) {
    await assignBadge(utente_id, 'membro-da-6-mesi');
  }
  if (giorni_iscritti >= 90) {
    await assignBadge(utente_id, 'membro-da-3-mesi');
  }
  if (giorni_iscritti >= 730) {
    await assignBadge(utente_id, 'membro-fedele');
  }
}

async function checkFotograficiStandardandSpecial(utente_id) {
  try {
    const fotoSnapshot = await db.collection('photos')
      .where('userId', '==', utente_id)
      .where('status', 'in', ['Approvata ✅', 'Approvata'])
      .get();

    const totalFoto = fotoSnapshot.size;

    if (totalFoto >= 1) {
      await assignBadge(utente_id, 'primo-scatto');
    }

    if (totalFoto >= 10) {
      await assignBadge(utente_id, 'fotografo-attivo');
    }

    if (totalFoto >= 50) {
      await assignBadge(utente_id, 'fotografo-esperto');
    }

    const servizi = new Set();
    fotoSnapshot.docs.forEach(doc => {
      servizi.add(doc.data().serviceType);
    });
    if (servizi.size >= 5) {
      await assignBadge(utente_id, 'collezionista');
    }

    for (const fotoDoc of fotoSnapshot.docs) {
      const photoId = fotoDoc.id;
      const votesSnapshot = await db.collection('photos')
        .doc(photoId)
        .collection('votes')
        .get();

      const totalVoti = votesSnapshot.size;
      if (totalVoti >= 100) {
        await assignBadge(utente_id, 'foto-virale');
        break;
      }
    }

    let fotoAmate = 0;
    for (const fotoDoc of fotoSnapshot.docs) {
      const photoId = fotoDoc.id;
      const votesSnapshot = await db.collection('photos')
        .doc(photoId)
        .collection('votes')
        .get();

      if (votesSnapshot.size >= 50) {
        fotoAmate++;
      }
    }
    if (fotoAmate >= 3) {
      await assignBadge(utente_id, 'amato-dalla-comunit');
    }

    let votiTotali = 0;
    for (const fotoDoc of fotoSnapshot.docs) {
      const photoId = fotoDoc.id;
      const votesSnapshot = await db.collection('photos')
        .doc(photoId)
        .collection('votes')
        .get();

      votiTotali += votesSnapshot.size;
    }
    if (votiTotali >= 500) {
      await assignBadge(utente_id, 'fotografo-apprezzato');
    }

  } catch (err) {
    console.error(`Errore check fotografici per ${utente_id}:`, err);
  }
}

async function checkPartecipazione(utente_id) {
  try {
    const sondaggiSnapshot = await db.collection('survey_responses')
      .where('userId', '==', utente_id)
      .get();

    const totalSondaggi = sondaggiSnapshot.size;

    if (totalSondaggi >= 10) {
      await assignBadge(utente_id, 'sondaggista');
    }

    if (totalSondaggi >= 25) {
      await assignBadge(utente_id, 'partecipante-attivo');
    }

    const votiSnapshot = await db.collection('photos')
      .get();

    let votiDati = 0;
    for (const fotoDoc of votiSnapshot.docs) {
      const voteDoc = await db.collection('photos')
        .doc(fotoDoc.id)
        .collection('votes')
        .doc(utente_id)
        .get();

      if (voteDoc.exists) {
        votiDati++;
      }
    }

    const totalInterazioni = totalSondaggi + votiDati;
    if (totalInterazioni >= 100) {
      await assignBadge(utente_id, 'community-hero');
    }

  } catch (err) {
    console.error(`Errore check partecipazione per ${utente_id}:`, err);
  }
}

async function checkDivertenti(utente_id) {
  try {
    let hasVoted = false;
    const allPhotosSnapshot = await db.collection('photos')
      .get();

    for (const fotoDoc of allPhotosSnapshot.docs) {
      const voteDoc = await db.collection('photos')
        .doc(fotoDoc.id)
        .collection('votes')
        .doc(utente_id)
        .get();

      if (voteDoc.exists) {
        hasVoted = true;
        break;
      }
    }

    if (hasVoted) {
      await assignBadge(utente_id, 'primo-voto');
    }

    let votiDati = 0;
    for (const fotoDoc of allPhotosSnapshot.docs) {
      const voteDoc = await db.collection('photos')
        .doc(fotoDoc.id)
        .collection('votes')
        .doc(utente_id)
        .get();

      if (voteDoc.exists) {
        votiDati++;
      }
    }

    if (votiDati >= 100) {
      await assignBadge(utente_id, 'super-voter');
    }

    const fotoSnapshot = await db.collection('photos')
      .where('userId', '==', utente_id)
      .where('status', 'in', ['Approvata ✅', 'Approvata'])
      .get();

    if (fotoSnapshot.size >= 50) {
      await assignBadge(utente_id, 'cicogna-emergenze');
    }

  } catch (err) {
    console.error(`Errore check divertenti per ${utente_id}:`, err);
  }
}

async function assignBadge(utente_id, badge_name) {
  try {
    const badgeRef = db.collection('users')
      .doc(utente_id)
      .collection('badges')
      .doc(badge_name);

    const badgeDoc = await badgeRef.get();

    if (!badgeDoc.exists) {
      await badgeRef.set({
        assignedAt: serverTimestamp(),
        notificationSent: false,
        from: 'system'
      }, { merge: true });
      console.log(`Badge '${badge_name}' assegnato a ${utente_id}`);
    }
  } catch (err) {
    console.error(`Errore assegnazione badge ${badge_name}:`, err);
  }
}