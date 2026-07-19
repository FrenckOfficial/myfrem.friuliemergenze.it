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

console.log("🚀 Avvio pushVehicle.mjs");

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

console.log("Inizializzazione Firebase");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
console.log("Firebase inizializzato");

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

async function pushVehicleToGithub() {
  const draftId = process.env.DRAFT_ID;

  if (!draftId) {
    throw new Error("DRAFT_ID non fornito");
  }

  console.log("📦 Draft:", draftId);

  const draftSnapshot = await db
    .collection("vehiclesDraft")
    .doc(draftId)
    .get();

  if (!draftSnapshot.exists) {
    throw new Error(`Bozza ${draftId} non trovata`);
  }

  const draft = draftSnapshot.data();

  console.log("✅ Bozza caricata:", draft.fileName);

  const fileName = draft.fileName.replace(/\.[^.]+$/, "");
  const vehicleData = draft.data || {};
  const sourcePhotoId = draft.sourcePhotoId || "";
  const slug = draft.slug || fileName;

  await updateGalleryJson(
    fileName,
    vehicleData,
    slug,
    draft.photoUrl
  );

  console.log("✅ gallery.json aggiornato");

  await createVehicleDetailsPage(
    fileName,
    vehicleData,
    sourcePhotoId,
    slug,
    draft.photoUrl
  );

  console.log("✅ Pagina HTML creata");

  await db.collection("vehiclesDraft")
    .doc(draftId)
    .update({
      status: "published",
      publishedAt: admin.firestore.Timestamp.now(),
      publishedBy: "github-action"
    });

  console.log("🎉 Pubblicazione completata");
}

async function updateGalleryJson(
  fileName,
  vehicleData,
  slug,
  photoUrl
) {
  console.log("📖 Lettura gallery.json");

  const response =
    await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: "gallery.json",
    });

  const content = JSON.parse(
    Buffer.from(
      response.data.content,
      "base64"
    ).toString()
  );

  if (!Array.isArray(content)) {
    throw new Error("gallery.json non è un array");
  }

  const service = getServiceLabel(vehicleData.service);

  const imageName = photoUrl
    ? photoUrl.split("/").pop()
    : "";

  const vehicle = {
    title: vehicleData.title || "",
    image: photoUrl || "",
    category: service || "",
    spotter: "",
    link: `/gallery/scheda/${slug}/`,
  };

  const existingIndex = content.findIndex((v) => v.link === `/gallery/scheda/${slug}/`);

  if (existingIndex >= 0) {
    content[existingIndex] = vehicle;
  } else {
    content.push(vehicle);
  }

  console.log("💾 Salvataggio gallery.json");
  console.log(JSON.stringify(content, null, 2));

  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: "gallery.json",
    message: `🚗 Add vehicle ${vehicleData.title}`,
    content: Buffer
      .from(JSON.stringify(content, null, 2))
      .toString("base64"),
    sha: response.data.sha,
    branch: GITHUB_BRANCH,
  });
}

async function createVehicleDetailsPage(
  fileName,
  vehicleData,
  sourcePhotoId,
  slug,
  photoUrl
) {
  const html =
    await generateVehicleHtml(
      vehicleData,
      fileName,
      sourcePhotoId,
      slug,
      photoUrl
    );

  try {
    const existing =
      await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: `gallery/scheda/${slug}/index.html`,
      });

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: `gallery/scheda/${slug}/index.html`,
      message: `📄 Update vehicle ${vehicleData.title}`,
      content: Buffer
        .from(html)
        .toString("base64"),
      sha: existing.data.sha,
      branch: GITHUB_BRANCH,
    });

  } catch {
    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: `gallery/scheda/${slug}/index.html`,
      message: `📄 Add vehicle ${vehicleData.title}`,
      content: Buffer
        .from(html)
        .toString("base64"),
      branch: GITHUB_BRANCH,
    });
  }
}

function getServiceLabel(service) {
  switch (service) {
    case "ambulanza":
      return "Soccorso Sanitario";

    case "pompieri":
      return "Soccorso Tecnico Urgente";

    case "protezione_civile":
      return "Protezione Civile";

    case "soccorso_alpino":
      return "Soccorso Alpino";

    case "guardia_costiera":
      return "Guardia Costiera";

    case "polizia_di_stato":
      return "Polizia di Stato";

    case "carabinieri":
      return "Carabinieri";

    case "guardia_di_finanza":
      return "Guardia di Finanza";
      
    case "polizia_locale":
      return "Polizia Locale";

    default:
      return service || "N/A";
  }
}

async function generateVehicleHtml(vehicleData, fileName, sourcePhotoId, slug, photoUrl) {
  const imageFileName = vehicleData.imageFileName || `${fileName}.jpg`;
  const pageUrl = `https://friuliemergenze.it/gallery/scheda/${slug}`;
  const service = getServiceLabel(vehicleData.service);
  const imageDoc = await db.collection("photos").doc(sourcePhotoId).get();
  const imageDocData = imageDoc.data();
  const userId = imageDocData.userId;
  const userDoc = await db.collection("users").doc(userId).get();
  const userData = userDoc.data();
  const author = userData.name + " " + userData.surname || "Utente sconosciuto";

  return `<!doctype html>
<html lang="it">
  <head>
    <script src="https://embeds.iubenda.com/widgets/46908651-d6da-462f-b037-e6ef97c84795.js"><\/script>
    <script src="/heading.js"><\/script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html;charset=UTF-8" />
    <title>${escapeHtml(vehicleData.title)} | Friuli Emergenze</title>
    <script src="/heading.js"><\/script>

    <link rel="stylesheet" href="/style.css" />
    <link href="https://fonts.googleapis.com/css2?family=Lexend&display=swap" rel="stylesheet">
    <link rel="shortcut icon" href="/assets/logo.png" type="image/png" />
    <link
      href="https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.11.4/css/lightbox.min.css"
      rel="stylesheet"
    />
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
    />
  </head>
  <body class="fade-in">
    <nav class="navbar">
      <div class="navbar-container">
        <a href="/" class="logo">🚨 Friuli Emergenze</a>
        <button class="menu-toggle" aria-label="Menu">
          <i class="fas fa-bars"><\/i>
        </button>
        <ul class="nav-links">
          <li><a href="/" class="nav-link">Home</a></li>
          <li><a href="/chi-sono" class="nav-link">Chi sono</a></li>
          <li><a href="/gallery" class="nav-link active">Galleria</a></li>
          <li><a href="/photobook" class="nav-link">Photobooks</a></li>
          <li><a href="/news" class="nav-link">Notizie</a></li>
          <li><a href="/piattaforma-myfrem" class="nav-icon" aria-label="MyFrEM">Piattaforma MyFrEM</a></li>
          <li><a href="/contact-us" class="nav-link">Contatti</a></li>
          <li><a href="https://www.friuliemergenze.it/social/instagram" target="_blank" class="nav-icon" aria-label="Instagram"><i class="fab fa-instagram"></i></a></li>
          <li><a href="https://www.friuliemergenze.it/social/whatsapp" target="_blank" class="nav-icon"><i class="fab fa-whatsapp"></i></a></li>
        <\/ul>
      <\/div>
    <\/nav>

    <main class="scheda-mezzo">
      <h1>${escapeHtml(vehicleData.title)}<\/h1>
      <img
        src="${photoUrl}"
        alt="${escapeHtml(vehicleData.title)}"
        loading="lazy"
      />

      <section class="dettagli-mezzo">
        <h2>Dati Tecnici<\/h2>
        <ul>
          <li><strong>Marca:<\/strong> ${escapeHtml(vehicleData.brand)}<\/li>
          <li><strong>Modello:<\/strong> ${escapeHtml(vehicleData.model)}<\/li>
          <li><strong>Allestimento:<\/strong> ${escapeHtml(vehicleData.builder ? vehicleData.builder : "N/A")}<\/li>
          <li><strong>Targa:<\/strong> ${escapeHtml(vehicleData.plate ? vehicleData.plate : "N/A")}<\/li>
          <li><strong>Servizio:<\/strong> ${escapeHtml(service)}<\/li>
          <li><strong>Sede:<\/strong> ${escapeHtml(vehicleData.headquarters)}<\/li>
        <\/ul>
        <p id="galleryRecognition">
          Photo by <em>${escapeHtml(author)}</em> from
          <a href="https://myfrem.friuliemergenze.it">MyFrEM</a>
        <\/p>
      <\/section>

      <div class="share">
        <span>Condividi su:<\/span>
        <!-- Facebook -->
        <div class="share-box">
          <a
            href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}"
            target="_blank"
            aria-label="Condividi su Facebook"
          >
            <i class="fab fa-facebook"><\/i> - Facebook
          <\/a>
        <\/div>
      <\/div>

      <div style="text-align: center; margin-top: 2rem">
        <a
          href="/gallery"
          style="
            display: inline-block;
            background-color: #00bcd4;
            color: white;
            padding: 0.8rem 1.5rem;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            transition: background-color 0.3s;
          "
        >
          ⬅ Torna alla galleria
        <\/a>
      <\/div>
    <\/main>

    <footer class="footer-clean">
      <div class="footer-container">
        <div class="footer-col">
          <p class="footer-brand">
            <a href="/"><i class="fa-regular fa-copyright"><\/i> 2026 Friuli Emergenze<\/a>
          <\/p>
          <p class="footer-desc">
            Pagina di condivisione foto e video di mezzi di soccorso. Ti diamo il benvenuto nel nostro sito ufficiale!
          <\/p>
        <\/div>

        <div class="footer-col">
          <p class="footer-paragraph">Vedi altre parti del nostro progetto!<\/p>
          <p class="footer-links">
            <a href="https://myfrem.friuliemergenze.it/" target="_blank" id="linkFooterBtn">MyFrEM<\/a>
            <span>·<\/span>
            <a href="/chi-sono" target="_blank" id="linkFooterBtn">Chi sono<\/a>
            <span>·<\/span>
            <a href="/contact-us" target="_blank" id="linkFooterBtn">Contatti<\/a>
          <\/p>
        <\/div>

        <div class="footer-col">
          <p class="footer-paragraph">Seguici sui nostri canali social<\/p>
          <p class="footer-social">
            <a href="/social/facebook" target="_blank"><i class="fa-brands fa-facebook"><\/i><\/a>
            <span>·<\/span>
            <a href="/social/instagram" target="_blank"><i class="fa-brands fa-instagram"><\/i><\/a>
            <span>·<\/span>
            <a href="/social/tiktok" target="_blank"><i class="fa-brands fa-tiktok"><\/i><\/a>
            <span>·<\/span>
            <a href="/social/whatsapp" target="_blank"><i class="fa-brands fa-whatsapp"><\/i><\/a>
          <\/p>
        <\/div>

        <div class="footer-col">
          <p class="footer-paragraph">Inviaci una mail<\/p>
          <p class="footer-extra" style="display:flex;align-items:center;justify-content:center;">
            <a href="mailto:info@friuliemergenze.it">
              <i class="fa-regular fa-envelope"><\/i>
            <\/a>
          <\/p>
        <\/div>
      <\/div>

      <div class="footer-bottom">
        <p class="footer-legal">
          <a href="https://www.friuliemergenze.it/policies/privacy">Privacy Policy<\/a>
          <span>·<\/span>
          <a href="https://www.friuliemergenze.it/policies/cookie">Cookie Policy<\/a>
        <\/p>
        <p class="footer-extra"> 
          Versione 2.6.0.0
        <\/p>
      <\/div>
    <\/footer>

    <script src="/scripts/shinystat.js?USER=SS-53595029-55bae" style="display: none;"><\/script>
    <noscript>
      <a href="https://www.shinystat.com/it/" target="_top" style="display: none;">
      <img src="//www.shinystat.com/cgi-bin/shinystat.cgi?USER=SS-53595029-55bae" alt="Statistiche web" style="border:0px; display: none;" /><\/a>
    <\/noscript>
  <\/body>
<\/html>`;
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

pushVehicleToGithub()
  .then(() => {
    console.log("✅ Fine workflow");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("❌ ERRORE:", error);

    try {
      const draftId = process.env.DRAFT_ID;

      if (draftId) {
        await db.collection("vehiclesDraft")
          .doc(draftId)
          .update({
            status: "error",
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
