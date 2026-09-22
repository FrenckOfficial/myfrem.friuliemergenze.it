import admin from "firebase-admin";
import { Octokit } from "@octokit/rest";

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

console.log("Avvio pushVehicle.mjs");

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

console.log("Verifica repository...");

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

  console.log("Draft:", draftId);

  const draftSnapshot = await db
    .collection("vehiclesDraft")
    .doc(draftId)
    .get();

  if (!draftSnapshot.exists) {
    throw new Error(`Bozza ${draftId} non trovata`);
  }

  const draft = draftSnapshot.data();

  console.log("Bozza caricata:", draft.fileName);

  const stafferId = draft.updatedBy || draft.createdBy || "github-action";
  const vehicleData = draft.data || {};
  const sourcePhotoId = draft.sourcePhotoId || "";
  const slug = draft.slug || vehicleData.slug || "";

  if (!slug) {
    throw new Error("Slug mancante: impossibile pubblicare il veicolo senza uno slug valido");
  }

  const photoUrl = draft.photoUrl || "";

  await updateGalleryJson(vehicleData, slug, photoUrl);

  console.log("gallery.json aggiornato");

  await createVehicleDetailsPage(stafferId, vehicleData, sourcePhotoId, slug, photoUrl);

  console.log("Pagina HTML creata");

  const vehicleRef = db.collection("vehiclesDraft").doc(draftId);

  await vehicleRef.update({
    status: "published",
    publishedAt: admin.firestore.Timestamp.now(),
    publishedBy: "github-action",
  });

  if (sourcePhotoId) {
    const sourcePhotoRef = db.collection("photos").doc(sourcePhotoId);
    const sourcePhotoSnap = await sourcePhotoRef.get();

    if (sourcePhotoSnap.exists) {
      await sourcePhotoRef.update({
        published: true,
        publishedAt: admin.firestore.Timestamp.now(),
        publishedBy: "github-action",
      });
    } else {
      console.warn(`sourcePhotoId "${sourcePhotoId}" non trovato in "photos", salto l'aggiornamento`);
    }
  } else {
    console.warn("Nessun sourcePhotoId presente sulla bozza, salto l'aggiornamento della foto sorgente");
  }

  console.log("Pubblicazione completata");
}

async function updateGalleryJson(vehicleData, slug, photoUrl) {
  console.log("Lettura gallery.json");

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

  console.log("Salvataggio gallery.json");
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

async function createVehicleDetailsPage(staffId, vehicleData, sourcePhotoId, slug, photoUrl) {
  const html = await generateVehicleHtml(staffId, vehicleData, sourcePhotoId, slug, photoUrl);

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
      message: `Update vehicle ${vehicleData.title}`,
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
      message: `Add vehicle ${vehicleData.title}`,
      content: Buffer
        .from(html)
        .toString("base64"),
      branch: GITHUB_BRANCH,
    });
  }
}

function getServiceLabel(service) {
  switch (service) {
    case "ordine-pubblico":
      return "Ordine Pubblico";

    case "carabinieri":
      return "Carabinieri";

    case "polizia-locale":
      return "Polizia Locale / Municipale";

    case "polizia-di-stato":
      return "Polizia di Stato";

    case "soccorso-alpino":
      return "Soccorso Alpino e Speleologico";

    case "corpo-forestale-regionale":
      return "Corpo Forestale Regionale";

    case "guardia-di-finanza":
      return "Guardia di Finanza";

    case "emergenza-sanitaria":
      return "Soccorso Sanitario";

    case "ambulanza":
      return "Soccorso Sanitario";

    case "pompieri":
      return "Vigili del Fuoco";

    case "guardia-costiera":
      return "Guardia Costiera";

    case "protezione-civile":
      return "Protezione Civile";

    default:
      return service || "N/A";
  }
}

async function generateVehicleHtml(staffId, vehicleData, sourcePhotoId, slug, photoUrl) {
  const pageUrl = `https://friuliemergenze.it/gallery/scheda/${slug}`;
  const service = getServiceLabel(vehicleData.service);
  let author = "Utente sconosciuto";

  if (sourcePhotoId && typeof sourcePhotoId === "string") {
    const imageDoc = await db.collection("photos").doc(sourcePhotoId).get();

    if (imageDoc.exists) {
      const imageDocData = imageDoc.data();
      const userId = imageDocData.userId;

      if (userId) {
        const userDoc = await db.collection("users").doc(userId).get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          const fullName = `${userData.name || ""} ${userData.surname || ""}`.trim();
          author = fullName || author;
        }
      }

      await imageDoc.ref.update({
        vehicleModel: vehicleData.title,
        sponsor: vehicleData.builder,
        licensePlate: vehicleData.plate,
        service: vehicleData.service,
        headquarters: vehicleData.headquarters,
        updater: staffId,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    } else {
      console.warn(`Foto sorgente "${sourcePhotoId}" non trovata, salto l'aggiornamento e uso autore di default`);
    }
  } else {
    console.warn("Nessun sourcePhotoId valido fornito, salto la lettura della foto sorgente");
  }

  return `<!doctype html>
<html lang="it">
  <head>
  <link rel="stylesheet" href="/modals.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.min.css">
    <script src="https://embeds.iubenda.com/widgets/46908651-d6da-462f-b037-e6ef97c84795.js"><\/script>
    <script src="/heading.js"><\/script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html;charset=UTF-8" />
    <title>${escapeHtml(vehicleData.title)} | Friuli Emergenze</title>
  </head>
  <body>
    <div id="donate-float" style="position: fixed !important; bottom: 2rem !important; left: 2rem !important; z-index: 999999 !important; display: block !important; width: auto !important; height: auto !important;">
      <a href="https://www.friuliemergenze.it/sostienici/donate" 
        target="_blank" 
        rel="noopener noreferrer"
        class="donate-btn"
        style="display: flex !important; align-items: center !important; gap: 0.5rem; padding: 0.875rem 1.5rem; background: #ff7b00 !important; color: white; border: none; border-radius: 50px; font-weight: 600; font-size: 1rem; cursor: pointer; text-decoration: none; font-family: Lexend, sans-serif;">
        Sostieni
      <\/a>
    <\/div>
    <nav class="navbar">
      <div class="navbar-container">
        <a href="/" class="logo">Friuli Emergenze</a>
        <button class="menu-toggle" aria-label="Menu">
          <i class="fas fa-bars"><\/i>
        </button>
        <ul class="nav-links">
          <li><a href="/" class="nav-link">Home</a></li>
          <li><a href="/chi-sono" class="nav-link">Chi sono</a></li>
          <li><a href="/gallery" class="nav-link active">Galleria</a></li>
          <li><a href="/photobook" class="nav-link">Photobooks</a></li>
          <li><a href="/sostienici" class="nav-link">Sostienici</a></li>
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
          <li><b>Marca:<\/b> ${escapeHtml(vehicleData.brand)}<\/li>
          <li><b>Modello:<\/b> ${escapeHtml(vehicleData.model)}<\/li>
          <li><b>Allestimento:<\/b> ${escapeHtml(vehicleData.builder ? vehicleData.builder : "N/A")}<\/li>
          <li><b>Targa:<\/b> ${escapeHtml(vehicleData.plate ? vehicleData.plate : "N/A")}<\/li>
          <li><b>Servizio:<\/b> ${escapeHtml(service)}<\/li>
          <li><b>Sede:<\/b> ${escapeHtml(vehicleData.headquarters)}<\/li>
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
            <a href="/mappa-del-sito" target="_blank" id="linkFooterBtn">Mappa del sito<\/a>
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
          Versione 2.8.0.0
        <\/p>
      <\/div>
    <\/footer>

    <script src="/scripts/shinystat.js?USER=SS-53595029-55bae" style="display: none;"><\/script>
    <noscript>
      <a href="https://www.shinystat.com/it/" target="_top" style="display: none;">
      <img src="//www.shinystat.com/cgi-bin/shinystat.cgi?USER=SS-53595029-55bae" alt="Statistiche web" style="border:0px; display: none;" /><\/a>
    <\/noscript>

    <script>
      document.querySelector(".menu-toggle").addEventListener("click", () => {
        document.querySelector(".nav-links").classList.toggle("open");
        const liMyFrEM = document.querySelector(".nav-links a[href='/piattaforma-myfrem']");

        if(liMyFrEM) {
          console.log("MyFrEM link found, updating innerHTML.");
          liMyFrEM.innerHTML = ${`<a href="/piattaforma-myfrem" target="_blank" class="nav-icon" aria-label="MyFrEM" style="margin-left:0;">MyFrEM</a>`}
        }
      });

      window.addEventListener("load", () => {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.register("/scripts/sw.js");
        }
      });
    <\/script>
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
    console.log("Fine workflow");
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