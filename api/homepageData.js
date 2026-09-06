import * as admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [stats, recentPhotos] = await Promise.all([
      getStats(),
      getRecentPhotos()
    ]);

    return res.status(200).json({
      stats: {
        totalUsers: stats.count,
        approvedPhotos: stats.approvedCount,
        avgApprovalTime: stats.avgTime,
        lastUploadTime: stats.lastUpload
      },
      recentPhotos: recentPhotos
    });

  } catch (error) {
    console.error("❌ Errore /api/homepage-data:", error.message);
    return res.status(500).json({
      error: "Errore caricamento dati homepage"
    });
  }
}

async function getStats() {
  const db = admin.firestore();

  try {
    const usersSnapshot = await db.collection('users')
      .where('status', '==', 'attivo')
      .get();
    const totalUsers = usersSnapshot.size;

    const photosSnapshot = await db.collection('photos')
      .where('status', '==', 'approved')
      .get();
    const approvedPhotos = photosSnapshot.size;

    let totalTimeMs = 0;
    let count = 0;

    photosSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdAt && data.approvedAt) {
        const createdAt = data.createdAt.toDate();
        const approvedAt = data.approvedAt.toDate();
        totalTimeMs += (approvedAt - createdAt);
        count++;
      }
    });

    let avgApprovalTime = 'N/A';
    if (count > 0) {
      const avgHours = Math.round(totalTimeMs / count / 3600000);
      if (avgHours < 24) {
        avgApprovalTime = `${avgHours}h`;
      } else {
        avgApprovalTime = `${Math.round(avgHours / 24)} giorni`;
      }
    }

    const lastPhotoSnapshot = await db.collection('photos')
      .where('status', '==', 'approved')
      .orderBy('approvedAt', 'desc')
      .limit(1)
      .get();

    let lastUploadTime = 'N/A';
    if (!lastPhotoSnapshot.empty) {
      const lastPhoto = lastPhotoSnapshot.docs[0].data();
      const approvedAt = lastPhoto.approvedAt.toDate();
      const now = new Date();
      const diffMinutes = Math.round((now - approvedAt) / 60000);

      if (diffMinutes < 60) {
        lastUploadTime = `${diffMinutes}m fa`;
      } else if (diffMinutes < 1440) {
        lastUploadTime = `${Math.round(diffMinutes / 60)}h fa`;
      } else if (diffMinutes < 10080) {
        lastUploadTime = `${Math.round(diffMinutes / 1440)}g fa`;
      } else {
        lastUploadTime = 'Più di una settimana fa';
      }
    }

    return {
      count: totalUsers,
      approvedCount: approvedPhotos,
      avgTime: avgApprovalTime,
      lastUpload: lastUploadTime
    };

  } catch (error) {
    console.error("❌ Errore getStats:", error);
    return {
      count: 0,
      approvedCount: 0,
      avgTime: 'N/A',
      lastUpload: 'N/A'
    };
  }
}

async function getRecentPhotos() {
  const db = admin.firestore();

  try {
    const photosSnapshot = await db.collection('photos')
      .where('status', '==', 'approved')
      .orderBy('approvedAt', 'desc')
      .limit(4)
      .get();

    const photos = [];

    for (const photoDoc of photosSnapshot.docs) {
      const photoData = photoDoc.data();

      let userName = 'Anonimo';
      if (photoData.userId) {
        const userDoc = await db.collection('users').doc(photoData.userId).get();
        if (userDoc.exists) {
          userName = userDoc.data().name || 'Anonimo';
        }
      }

      photos.push({
        userName: sanitizeHtml(userName),
        serviceType: photoData.serviceType || 'unknown',
        uploadedAt: photoData.approvedAt.toDate().toISOString()
      });
    }

    return photos;

  } catch (error) {
    console.error("❌ Errore getRecentPhotos:", error);
    return [];
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
    .substring(0, 500);
}