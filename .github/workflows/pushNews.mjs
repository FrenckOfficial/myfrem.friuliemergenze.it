import admin from "firebase-admin";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

console.log("🚀 Avvio pushNews.mjs");

console.log("FIREBASE_PROJECT_ID:", !!process.env.FIREBASE_PROJECT_ID);
console.log("FIREBASE_CLIENT_EMAIL:", !!process.env.FIREBASE_CLIENT_EMAIL);
console.log("FIREBASE_PRIVATE_KEY:", !!process.env.FIREBASE_PRIVATE_KEY);
console.log("GITHUB_TOKEN:", !!process.env.GITHUB_TOKEN);
console.log("DRAFT_ID:", process.env.DRAFT_ID);

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const GITHUB_OWNER = "FrenckOfficial";
const GITHUB_REPO = "friuliemergenze.it";
const GITHUB_BRANCH = "main";

console.log("🔍 Verifica repository...");

const repoInfo = await octokit.repos.get({
  owner: GITHUB_OWNER,
  repo: GITHUB_REPO,
});

console.log("Repository trovato:", repoInfo.data.full_name);

async function pushNewsToGithub() {
  const draftId = process.env.DRAFT_ID;

  if (!draftId) {
    throw new Error("DRAFT_ID non fornito");
  }

  console.log("📦 Draft:", draftId);

  const draftSnapshot = await db
    .collection("newsDrafts")
    .doc(draftId)
    .get();

  if (!draftSnapshot.exists) {
    throw new Error(`Notizia ${draftId} non trovata`);
  }

  const draft = draftSnapshot.data();

  console.log("✅ Notizia caricata:", draft.title);

  const title = draft.title || {};
  const date = draft.createdAt || {};
  const link = draft.link || {};

  await updateNewsJson(
    title,
    date,
    link,
    draft.imageUrl
  );

  console.log("✅ news.json aggiornato");

  console.log("✅ Pagina HTML creata");

  draftSnapshot.ref.update({
      status: "published",
      publishedAt: admin.firestore.Timestamp.now(),
      publishedBy: "github-action"
    });

  console.log("🎉 Pubblicazione completata");
}

async function updateNewsJson(
  title,
  date,
  link,
  photoUrl
) {
  console.log("📖 Lettura news.json");

  const response =
    await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: "news.json",
    });

  const content = JSON.parse(
    Buffer.from(
      response.data.content,
      "base64"
    ).toString()
  );

  if (!Array.isArray(content)) {
    throw new Error("news.json non è un array");
  }

  const news = {
    title: newsData.title || "",
    image: photoUrl || "",
    date: newsData.date || "",
    link: newsData.link || "",
  };

  console.log("💾 Salvataggio news.json");
  console.log(JSON.stringify(content, null, 2));

  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: "news.json",
    message: `Add news ${newsData.title}`,
    content: Buffer
      .from(JSON.stringify(content, null, 2))
      .toString("base64"),
    sha: response.data.sha,
    branch: GITHUB_BRANCH,
  });
}

function escapeHtml(text) {
  if (text === null || text === undefined) {
    return "";
  }

  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return String(text)
    .replace(/[&<>"']/g, (m) => map[m]);
}

pushNewsToGithub()
  .then(() => {
    console.log("✅ Fine workflow");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("❌ ERRORE:", error);

    try {
      const draftId = process.env.DRAFT_ID;

      if (draftId) {
        await db.collection("newsDrafts")
          .doc(draftId)
          .update({
            properStatus: "error",
            errorMessage: error.message,
            errorAt:
              admin.firestore.Timestamp.now(),
          });
      }
    } catch (e) {
      console.error(
        "Errore aggiornamento Firestore:",
        e
      );
    }

    process.exit(1);
  });
