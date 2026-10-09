import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { uploadFile } from "/helpers/uploadFile.js";
import { setStatus } from "/helpers/modals.js";
import { db, clean, EMAIL_RE, initAssociationPage } from "/association/dashboard/common.js";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const UPLOAD_FOLDER = "associations-images";

const IMAGES = {
  logo: { field: "logoUrl", maxSide: 512, mime: "image/png", ext: "png", label: "logo" },
  cover: { field: "copertinaUrl", maxSide: 1600, mime: "image/jpeg", ext: "jpg", label: "copertina" }
};

const pageForm = document.getElementById("pageForm");
const saveBtn = document.getElementById("saveBtn");
const btnText = document.getElementById("btnText");
const btnLoader = document.getElementById("btnLoader");

let associationId = null;
let association = null;
let currentUser = null;
let isSaving = false;
let isUploading = false;

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

function showPreview(kind, url) {
  const el = document.getElementById(`${kind}Preview`);
  if (!url) return;
  el.src = url;
  el.hidden = false;
}

async function uploadImage(kind) {
  if (isUploading) return;

  const cfg = IMAGES[kind];
  const input = document.getElementById(`${kind}Input`);
  const btn = document.getElementById(`${kind}Btn`);
  const file = input.files[0];

  if (!file) {
    setStatus(`Seleziona prima un'immagine per il ${cfg.label}.`, "error");
    return;
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    setStatus("Formato non supportato: usa PNG, JPG o WebP.", "error");
    return;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    setStatus("L'immagine è troppo pesante (massimo 10 MB).", "error");
    return;
  }

  isUploading = true;
  btn.disabled = true;
  btn.textContent = "Caricamento in corso...";

  try {
    const resized = await resizeImage(file, cfg.maxSide, cfg.mime, cfg.ext);
    const url = await uploadFile(resized, UPLOAD_FOLDER, currentUser.uid);

    await updateDoc(doc(db, "associations", associationId), {
      [cfg.field]: url,
      aggiornatoAt: serverTimestamp()
    });

    association[cfg.field] = url;
    showPreview(kind, url);
    input.value = "";

    setStatus(`${cfg.label.charAt(0).toUpperCase()}${cfg.label.slice(1)} aggiornato`, "success");
  } catch (error) {
    console.error(`Errore upload ${cfg.label}:`, error);

    switch (error.code) {
      case "permission-denied":
        setStatus("Non è stato possibile salvare l'immagine (permessi insufficienti).", "error");
        break;
      default:
        setStatus(`C'è stato un errore durante il caricamento del ${cfg.label}.`, "error");
    }
  } finally {
    isUploading = false;
    btn.disabled = association.stato !== "approvata";
    btn.textContent = `Carica ${cfg.label}`;
  }
}

initAssociationPage(async (ctx) => {
  associationId = ctx.associationId;
  association = ctx.association;
  currentUser = ctx.user;

  document.getElementById("assocNameInput").value = association.nome || "";
  document.getElementById("assocCity").value = association.zona || "";
  document.getElementById("assocDescription").value = association.descrizione || "";
  document.getElementById("assocEmail").value = association.contatti?.email || "";
  document.getElementById("assocPhone").value = association.contatti?.telefono || "";
  document.getElementById("assocSite").value = association.contatti?.sito || "";

  showPreview("logo", association.logoUrl);
  showPreview("cover", association.copertinaUrl);

  // Le regole permettono di modificare la pagina solo se è approvata
  const editable = association.stato === "approvata";

  document.querySelectorAll("#pageForm input, #pageForm textarea, .image-box input[type=file]").forEach((el) => {
    el.disabled = !editable;
  });
  saveBtn.disabled = !editable;
  document.getElementById("logoBtn").disabled = !editable;
  document.getElementById("coverBtn").disabled = !editable;

  const notice = document.getElementById("pageNotice");
  notice.hidden = editable;
  if (!editable) notice.textContent = "La pagina è sospesa: non puoi modificarla. Contatta lo staff di MyFrEM.";
});

document.getElementById("logoBtn").addEventListener("click", () => uploadImage("logo"));
document.getElementById("coverBtn").addEventListener("click", () => uploadImage("cover"));

pageForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isSaving) return;

  const nome = clean(document.getElementById("assocNameInput").value);
  const zona = clean(document.getElementById("assocCity").value);
  const descrizione = document.getElementById("assocDescription").value.trim();
  const email = clean(document.getElementById("assocEmail").value);
  const telefono = clean(document.getElementById("assocPhone").value);
  const sito = clean(document.getElementById("assocSite").value);

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
  btnText.textContent = "Salvataggio in corso...";
  btnLoader.style.display = "inline-block";

  try {
    await updateDoc(doc(db, "associations", associationId), {
      nome,
      zona,
      descrizione,
      contatti: { email, telefono, sito },
      aggiornatoAt: serverTimestamp()
    });

    association = { ...association, nome, zona, descrizione, contatti: { email, telefono, sito } };

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
    saveBtn.disabled = association.stato !== "approvata";
    btnText.textContent = "Salva modifiche";
    btnLoader.style.display = "none";
  }
});