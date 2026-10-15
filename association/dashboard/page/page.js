import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { uploadFile } from "/helpers/uploadFile.js";
import { setStatus } from "/helpers/modals.js";
import { db, clean, EMAIL_RE, initAssociationPage } from "/association/dashboard/common.js";
import { el, initials } from "/association/dashboard/ui.js";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const UPLOAD_FOLDER = "associations-images";

const IMAGES = {
  logo: { field: "logoUrl", maxSide: 512, mime: "image/png", ext: "png", label: "Logo" },
  cover: { field: "copertinaUrl", maxSide: 1600, mime: "image/jpeg", ext: "jpg", label: "Copertina" }
};

const FIELDS = {
  nome: "assocNameInput",
  zona: "assocCity",
  descrizione: "assocDescription",
  email: "assocEmail",
  telefono: "assocPhone",
  sito: "assocSite"
};

const pageForm = document.getElementById("pageForm");
const saveBar = document.getElementById("saveBar");
const saveBtn = document.getElementById("saveBtn");
const btnText = document.getElementById("btnText");
const btnLoader = document.getElementById("btnLoader");

let associationId = null;
let association = null;
let currentUser = null;
let isSaving = false;
let isReferente = false;
let isUploading = false;
let editable = false;
let saved = {};

const input = (key) => document.getElementById(FIELDS[key]);

function isHttps(url) {
  return /^https:\/\//i.test(url || "");
}

function resizeImage(file, maxSide, mime, ext) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Conversione dell'immagine non riuscita"));
          return;
        }

        const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
        resolve(new File([blob], `${baseName}.${ext}`, { type: mime, lastModified: Date.now() }));
      }, mime, 0.9);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossibile leggere l'immagine"));
    };

    img.src = objectUrl;
  });
}

function readForm() {
  return Object.fromEntries(Object.keys(FIELDS).map((key) => [key, input(key).value]));
}

function fillForm(values) {
  Object.entries(values).forEach(([key, value]) => { input(key).value = value; });
  updateCounter();
}

function fromAssociation(a) {
  return {
    nome: a.nome || "",
    zona: a.zona || "",
    descrizione: a.descrizione || "",
    email: a.contatti?.email || "",
    telefono: a.contatti?.telefono || "",
    sito: a.contatti?.sito || ""
  };
}

function isDirty() {
  const current = readForm();
  return Object.keys(FIELDS).some((key) => current[key] !== saved[key]);
}

function updateCounter() {
  document.getElementById("descCounter").textContent = `${input("descrizione").value.length}/1000`;
}

function refreshState() {
  saveBar.hidden = !editable || !isDirty();
  document.body.classList.toggle("has-savebar", !saveBar.hidden);
  renderPreview();
}

function renderPreview() {
  const v = readForm();

  document.getElementById("previewName").textContent = clean(v.nome) || "Nome dell'associazione";
  document.getElementById("previewZone").textContent = clean(v.zona) || "Comune della sede";
  document.getElementById("previewDescription").textContent = v.descrizione.trim() || "Qui comparirà la descrizione della tua associazione.";

  const contacts = [["fa-envelope", v.email], ["fa-phone", v.telefono], ["fa-globe", v.sito]]
    .filter(([, value]) => clean(value))
    .map(([iconName, value]) => {
      const row = el("span");
      const i = el("i", `fa-solid ${iconName}`);
      i.setAttribute("aria-hidden", "true");
      row.append(i, " ", clean(value));
      return row;
    });
  document.getElementById("previewContacts").replaceChildren(...contacts);

  const cover = document.getElementById("previewCover");
  cover.style.backgroundImage = isHttps(association?.copertinaUrl) ? `url("${encodeURI(association.copertinaUrl)}")` : "";

  const logo = document.getElementById("previewLogo");
  if (isHttps(association?.logoUrl)) {
    const img = el("img");
    img.src = association.logoUrl;
    img.alt = "";
    logo.replaceChildren(img);
  } else {
    logo.textContent = initials(v.nome);
  }
}

function showImage(kind, url) {
  const img = document.getElementById(`${kind}Preview`);
  const placeholder = document.getElementById(`${kind}Placeholder`);
  const has = isHttps(url);

  img.hidden = !has;
  placeholder.hidden = has;
  if (has) img.src = url;
}

async function uploadImage(kind, file) {
  if (isUploading || !editable) return;

  const cfg = IMAGES[kind];
  const drop = document.getElementById(`${kind}Drop`);

  if (!file) return;

  if (!ALLOWED_TYPES.includes(file.type)) {
    setStatus("Formato non supportato: usa PNG, JPG o WebP.", "error");
    return;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    setStatus("L'immagine è troppo pesante (massimo 10 MB).", "error");
    return;
  }

  isUploading = true;
  drop.classList.add("is-busy");

  try {
    const resized = await resizeImage(file, cfg.maxSide, cfg.mime, cfg.ext);
    const url = await uploadFile(resized, UPLOAD_FOLDER, currentUser.uid);

    await updateDoc(doc(db, "associations", associationId), {
      [cfg.field]: url,
      aggiornatoAt: serverTimestamp()
    });

    association[cfg.field] = url;
    showImage(kind, url);
    renderPreview();

    setStatus(`${cfg.label} aggiornat${kind === "logo" ? "o" : "a"}`, "success");
  } catch (error) {
    console.error(`Errore upload ${cfg.label}:`, error);

    switch (error.code) {
      case "permission-denied":
        setStatus("Non è stato possibile salvare l'immagine (permessi insufficienti).", "error");
        break;
      default:
        setStatus("C'è stato un errore durante il caricamento dell'immagine.", "error");
    }
  } finally {
    isUploading = false;
    drop.classList.remove("is-busy");
    document.getElementById(`${kind}Input`).value = "";
  }
}

function setupDropzone(kind) {
  const drop = document.getElementById(`${kind}Drop`);
  const fileInput = document.getElementById(`${kind}Input`);

  fileInput.addEventListener("change", () => uploadImage(kind, fileInput.files[0]));

  ["dragenter", "dragover"].forEach((type) => drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.add("is-over");
  }));

  ["dragleave", "drop"].forEach((type) => drop.addEventListener(type, () => drop.classList.remove("is-over")));

  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadImage(kind, e.dataTransfer.files[0]);
  });
}

initAssociationPage(async (ctx) => {
  associationId = ctx.associationId;
  association = ctx.association;
  currentUser = ctx.user;
  isReferente = ctx.isReferente;

  saved = fromAssociation(association);
  fillForm(saved);

  showImage("logo", association.logoUrl);
  showImage("cover", association.copertinaUrl);

  document.getElementById("pageLink").href = `/associations/view/?id=${encodeURIComponent(associationId)}`;

  editable = association.stato === "approvata";

  pageForm.querySelectorAll("input, textarea").forEach((field) => { field.disabled = !editable; });
  ["logoDrop", "coverDrop"].forEach((id) => document.getElementById(id).classList.toggle("is-disabled", !editable));

  const notice = document.getElementById("pageNotice");
  notice.hidden = editable;
  if (!editable) notice.textContent = "La pagina è sospesa: non puoi modificarla. Contatta lo staff di MyFrEM.";

  if (isReferente) {
    input("nome").disabled = true;
    input("zona").disabled = true;
    document.getElementById("identityHint").textContent = "Nome e comune possono essere modificati solo dall'account dell'associazione.";
  }

  refreshState();
}, { allowReferent: true, requirePerm: "pagina" });

setupDropzone("logo");
setupDropzone("cover");

pageForm.addEventListener("input", () => {
  updateCounter();
  refreshState();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  fillForm(saved);
  refreshState();
});

window.addEventListener("beforeunload", (e) => {
  if (editable && isDirty()) e.preventDefault();
});

pageForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isSaving || !editable) return;

  const v = readForm();
  const nome = clean(v.nome);
  const zona = clean(v.zona);
  const descrizione = v.descrizione.trim();
  const email = clean(v.email);
  const telefono = clean(v.telefono);
  const sito = clean(v.sito);

  if (!nome) {
    setStatus("Il nome dell'associazione non può essere vuoto.", "error");
    return;
  }

  if (!zona) {
    setStatus("Devi inserire il comune della sede.", "error");
    return;
  }

  if (email && !EMAIL_RE.test(email)) {
    setStatus("L'email di contatto non è valida.", "error");
    return;
  }

  if (sito && !/^https?:\/\//i.test(sito)) {
    setStatus("Il sito deve iniziare con http:// o https://.", "error");
    return;
  }

  isSaving = true;
  saveBtn.disabled = true;
  btnText.textContent = "Salvataggio...";
  btnLoader.hidden = false;

  try {
    const payload = {
      descrizione,
      contatti: { email, telefono, sito },
      aggiornatoAt: serverTimestamp()
    };

    if (!isReferente) {
      payload.nome = nome;
      payload.zona = zona;
    }

    await updateDoc(doc(db, "associations", associationId), payload);

    association = { ...association, ...(isReferente ? {} : { nome, zona }), descrizione, contatti: { email, telefono, sito } };
    saved = fromAssociation(association);
    fillForm(saved);
    refreshState();

    setStatus("Pagina aggiornata", "success");
  } catch (error) {
    console.error("Errore nel salvataggio della pagina:", error);

    switch (error.code) {
      case "permission-denied":
        setStatus("Non è stato possibile salvare (permessi insufficienti).", "error");
        break;
      default:
        setStatus("C'è stato un errore durante il salvataggio.", "error");
    }
  } finally {
    isSaving = false;
    saveBtn.disabled = false;
    btnText.textContent = "Salva modifiche";
    btnLoader.hidden = true;
  }
});
