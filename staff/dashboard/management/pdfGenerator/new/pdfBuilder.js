import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "/configFirebase.js";

import { uploadFile } from "/helpers/uploadFile.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "./helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";

import {
  buildPDF,
  downloadPDF
} from "/staff/dashboard/management/pdfGenerator/new/pdfFunctions.js";

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

const form = document.getElementById("pdfForm");

const generateBtn = document.getElementById("generatePdf");
const clearBtn = document.getElementById("clearForm");

const titleInput = document.getElementById("title");
const dateInput = document.getElementById("date");
const typeInput = document.getElementById("type");
const contentInput = document.getElementById("content");
const authorInput = document.getElementById("author");

const prevTitle = document.getElementById("prevTitle");
const prevDate = document.getElementById("prevDate");
const prevContent = document.getElementById("prevContent");
const prevAuthor = document.getElementById("prevAuthor");
const prevType = document.getElementById("prevType");

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (!user) {
    setStatus("⚠️ Devi essere loggato");
    window.location.href = "/login/";
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

function updatePreview() {
  const title = titleInput.value || "Titolo documento";
  const date = dateInput.value || "Data";
  const type = typeInput.value || "Tipo";
  const author = authorInput.value || "Autore";
  const content = contentInput.value || "Contenuto...";

  prevTitle.textContent = title;

  prevDate.textContent = date;
  prevAuthor.textContent = author;
  if (prevType) {
    prevType.textContent = type;
  }

  prevContent.innerHTML = content
    .split('\n')
    .map(line => {
      if (line.trim()) {
        if (line.includes("=>")) {
          return `<span style="display: block; margin-left: 10px; margin-bottom: 4px;">▸ ${escapeHtml(line)}</span>`;
        }
        return escapeHtml(line);
      } else {
        return '<span style="display: block; height: 8px;"></span>';
      }
    })
    .join('<br>');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

titleInput.addEventListener("input", updatePreview);
dateInput.addEventListener("input", updatePreview);
typeInput.addEventListener("input", updatePreview);
contentInput.addEventListener("input", updatePreview);
authorInput.addEventListener("input", updatePreview);

generateBtn.addEventListener("click", async () => {

  if (!currentUser) {
    return setStatus("Devi essere loggato");
  }

  if (!titleInput.value.trim()) {
    return setStatus("Inserisci un titolo");
  }

  setStatus("📄 Generazione PDF...");

  try {

    const pdf = buildPDF({
      title: titleInput.value,
      type: typeInput.value,
      content: contentInput.value || "",
      author: authorInput.value || currentUser.email,
      date:
        dateInput.value ||
        new Date().toLocaleDateString("it-IT"),

      footer: "MyFrEM Staff System"
    });

    const safeTitle = titleInput.value
      .replaceAll(" ", "_")
      .replace(/[^a-zA-Z0-9_-]/g, "");

    const fileName =
      `documento_${safeTitle}_${Date.now()}.pdf`;

    const pdfBlob = pdf.output("blob");

    setStatus("⬆️ Upload PDF...");

    const pdfUrl = await uploadFile(pdfBlob, "myfrem-staff-docs", currentUser.uid);

    setStatus("💾 Salvataggio database...");

    await addDoc(
      collection(db, "generatedDocuments"),
      {
        title: titleInput.value,
        type: typeInput.value,

        content:
          contentInput.value || "",

        author:
          authorInput.value ||
          currentUser.email,

        date:
          dateInput.value ||
          new Date().toLocaleDateString("it-IT"),

        pdfUrl,

        createdAt: serverTimestamp(),

        generatedBy: currentUser.uid
      }
    );

    await addDoc(
      collection(db, "activities"),
      {
        type: "pdf_generated",

        generatedBy:
          currentUser.email,

        documentTitle:
          titleInput.value,

        timestamp:
          serverTimestamp()
      }
    );

    downloadPDF(pdf, {
      title: titleInput.value,
      type: typeInput.value
    });

    setStatus("PDF generato!");

  } catch (err) {

    console.error("ERRORE:", err);

    setStatus("Errore generazione PDF", "error");
  }
});

clearBtn.addEventListener("click", () => {
  form.reset();

  prevTitle.textContent = "Titolo documento";
  prevDate.textContent = "Data";
  prevContent.innerHTML = "Contenuto...";
  prevAuthor.textContent = "Autore";
  if (prevType) {
    prevType.textContent = "Tipo";
  }

  setStatus("🧹 Form pulito");
});