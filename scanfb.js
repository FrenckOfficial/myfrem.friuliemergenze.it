#!/usr/bin/env node

import admin from "firebase-admin";
import fs from "fs";
import readline from "readline";

// Carica Firebase config
const serviceAccount = {
  type: "service_account",
  project_id: "friuli-emergenze",
  private_key_id: "8f1e67b6fc9ce557c5d604bebd3d41f113303a30",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCtW/46gdR4EjOO\niDpGeg5SNkQX+2iHwJT+PSOjD3S0NsI2FhhhxIsFUvIcXHjYZhN2Bz0tN3JmMsHL\nYkZsYViNpKY6GQzqtaodF8f8pDSnx0KuC4INGk0o/lJh0xrRXPY/wr35z5KgkJxb\n4WyBknUNt10g3856bexthI82UGAIq0Zm9YI3RBaui/CsX4Nghze2g1bJ0JjOVkp8\n2Ugeq/9t/Tj7fb4mJIZ/ryGrtzhS7dAB334/hXtwgt6sUG0f3Ah6+Uki+JkrF9Ui\n+BzVQzlJP07ndtzj8sW+6gu0OBNzaWuqaCF0eYXdIb9TSRHwhot1ARQRrWIMD46K\n6E3x/KinAgMBAAECggEAQtuWqYPGqGQEpDSfnOyXt1ccXc9k2e4IyCBWLR3Z2WLA\n9dEBqDr/jpcVrqBvLq33VW6nRlf687UhjkmhdUz5tO7J+OAOXjqfl8bDJwlBEW/E\npJDloB4DogqrRPUAg7wBcEevsrc+ClSbKMhAa5xLLnYIIZSO8iKQqxATl1PaJZ0d\njroyc8Js77invLJGAkwXW1DPcDz8czM1JqeyBuuvRLOz9vAdW2IQ/TNpg8vZgSbe\nBBaEJ33wAFik30UIPG4v885/SgwK0ypC1vzPuoRzSmqiKv5HIOs72zYjH8pyJ2Xt\nj0G3lOtTQXpExUOMoanjRnBHIONp6/VDENtSrvwyuQKBgQDh7RrkiIQAX8K1WLke\nPH5xOgMrhUmkKaH+uLKd5d/C8DNbQKyoWrUypM4NK2I3+8S6uMSHFtkKx9SOuWQb\nPVy0KXfuST4AZPIX9w2jX1TgrvZFpzNNVp4H8Y7/Nn/yH+Mh2aDBt751x2MGMm6U\ng02xBCkCYP2VhIv10adis0FC2wKBgQDEb5DY/v1/9SHIBPX9DbrpB+N431aa3Jjn\nmyRWrNBD+4ub7Y9l9Rbmt376PFr7+Zvt8lQOzx2fPMZI0buTc9kySVEciK/NDkB/\npeNL0WPuSMVt9AWDBWGoWv5t+r2hbI/E5XA1gTS5wtElAKQueN/0jyINfDHkdZ1v\nMft9/CCtJQKBgDYq5BTBCm0QiJ10PUYbmPFKyHHJzkM23Ck3XVPwRnr1nkqVsg/X\nV7RhwSl1KmJj0eI25J/DAZzNFpB1sKO7TZvAiYmvM9diXI0UZcey1qXcLR28HdfA\nGbmr1+4mwfxqWsnF5P4tMNQKTxqwQsUGyjzT04VHfeU4V1pDvw8yDUabAoGBAJRD\nRMeTxlAi++lVXTkveMjUDGu53ksqfzooTcghzVvSa3A4YMhqsWtYSj2i+mU+4+M3\nyRwYVVpP67Ugn/xOLzwWPGNWA6K4xBPUaHdcRpmeUW2JBfP7RtdkPq9R1nkVUHoj\nVor7x4kBswvDrSfqUdbrhZ86AwpVf4ti5VgUybEFAoGBAI5eZ49QFer85jVpDWzc\nXZQcfg6YujPgUWivoH5F5T2yvfTbrz2wy9A90b8tBk583Lah/+RLWCGcg0fU6DPE\nt9U5LjRbrSXuQwYoi5TnyRgBSdzpRuYtFenLpUG3OND7YCbdyQOfK2HxsAzkq7Dl\na4W74s2k88iA5cGAq7U/cnp0\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@friuli-emergenze.iam.gserviceaccount.com",
  client_id: "105043248113167744382",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url:
    "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40friuli-emergenze.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const SUPABASE_URL = "https://cldkthlfzxcdswwtcjyw.supabase.co";
const CDN_URL = "https://cdn.friuliemergenze.it";

// Funzione per chiedere conferma
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

// Funzione per impostare valore nested
function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
}

// Funzione per ottenere valore nested
function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

async function convertUrl(oldUrl) {
  // Estrae il path dalla URL Supabase e converte ai domini personalizzati
  // Es: https://cldkthlfzxcdswwtcjyw.supabase.co/storage/v1/object/public/MyFrEM%20Photos/uid/file.jpg
  // Risultato: https://cdn.friuliemergenze.it/uid/file.jpg

  // Bucket mapping con dominio personalizzato
  const bucketMap = {
    profilePic: { domain: "https://profilepics.cdn.friuliemergenze.it" },
    "MyFrEM Staff Documents": {
      domain: "https://staffdocs.cdn.friuliemergenze.it",
    },
    "MyFrEM%20Staff%20Documents": {
      domain: "https://staffdocs.cdn.friuliemergenze.it",
    },
    "MyFrEM Reports": { domain: "https://rpt.cdn.friuliemergenze.it" },
    "MyFrEM%20Reports": { domain: "https://rpt.cdn.friuliemergenze.it" },
    "MyFrEM Photos": { domain: "https://cdn.friuliemergenze.it" },
    "MyFrEM%20Photos": { domain: "https://cdn.friuliemergenze.it" },
  };

  // Estrae il path dopo /object/public/ o /object/authenticated/
  const match = oldUrl.match(
    /\/object\/(public|authenticated)\/([^\/]+)\/(.*)/
  );
  if (!match) {
    console.warn(`⚠️  URL non parseable: ${oldUrl}`);
    return oldUrl;
  }

  const originalBucket = match[2];
  const fullPath = match[3];

  // Mappa il bucket
  const bucketConfig = bucketMap[originalBucket];
  if (!bucketConfig) {
    console.warn(
      `⚠️  Bucket non mappato: ${originalBucket}, uso il nome decodificato`
    );
    return `https://cdn.friuliemergenze.it/${decodeURIComponent(originalBucket)}/${fullPath}`;
  }

  return `${bucketConfig.domain}/${fullPath}`;
}

async function update() {
  console.log("📋 Bulk Update Firestore URLs\n");

  // Leggi il report precedente
  if (!fs.existsSync("./firestore-urls-report.json")) {
    console.error(
      "❌ File report non trovato. Run scan-firestore-urls.js prima!\n"
    );
    process.exit(1);
  }

  const report = JSON.parse(
    fs.readFileSync("./firestore-urls-report.json", "utf-8")
  );

  let totalUrls = 0;
  let changes = [];

  for (const [collection, urls] of Object.entries(report)) {
    for (const { docId, field, url } of urls) {
      totalUrls++;
      const newUrl = await convertUrl(url);
      changes.push({
        collection,
        docId,
        field,
        oldUrl: url.substring(0, 60) + "...",
        newUrl: newUrl.substring(0, 60) + "...",
      });
    }
  }

  // Mostra preview
  console.log(`📊 Verranno aggiornati ${totalUrls} URL:\n`);
  changes.slice(0, 5).forEach((change) => {
    console.log(`  ${change.collection}/${change.docId}.${change.field}`);
    console.log(`    OLD: ${change.oldUrl}`);
    console.log(`    NEW: ${change.newUrl}\n`);
  });

  if (changes.length > 5) {
    console.log(`  ... e ${changes.length - 5} altri URL\n`);
  }

  // Chiedi conferma
  const answer = await askQuestion(
    "❓ Procedi con l'update? (yes/no): "
  );

  if (answer.toLowerCase() !== "yes") {
    console.log("❌ Annullato.\n");
    process.exit(0);
  }

  console.log("\n🚀 Inizio update...\n");

  let success = 0;
  let failed = 0;

  for (const [collection, urls] of Object.entries(report)) {
    console.log(`\n📦 ${collection}`);
    console.log("─".repeat(40));

    // Raggruppa per doc
    const byDoc = {};
    for (const item of urls) {
      if (!byDoc[item.docId]) byDoc[item.docId] = [];
      byDoc[item.docId].push(item);
    }

    for (const [docId, docUrls] of Object.entries(byDoc)) {
      try {
        const docRef = db.collection(collection).doc(docId);
        const docSnapshot = await docRef.get();
        const data = docSnapshot.data();

        const updates = {};
        for (const { field, url } of docUrls) {
          const oldValue = getNestedValue(data, field);

          if (typeof oldValue === "string") {
            const newUrl = await convertUrl(url);
            setNestedValue(updates, field, newUrl);
          }
        }

        await docRef.update(updates);
        console.log(`  ✅ ${docId}`);
        success++;
      } catch (error) {
        console.log(`  ❌ ${docId}: ${error.message}`);
        failed++;
      }
    }
  }

  console.log("\n" + "═".repeat(40));
  console.log(`\n✅ Completato!`);
  console.log(`   Aggiornati: ${success}`);
  console.log(`   Falliti: ${failed}\n`);

  await admin.app().delete();
}

update().catch((error) => {
  console.error("❌ Errore:", error);
  process.exit(1);
});