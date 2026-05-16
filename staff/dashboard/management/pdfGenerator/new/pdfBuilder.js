import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "/configFirebase.js";

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { supa } from "/configSupabase.js";

import {
  buildPDF,
  downloadPDF
} from "/staff/dashboard/management/pdfGenerator/new/pdfFunctions.js";

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

const supabase = createClient(
  supa.url,
  supa.anonKey
);

let currentUser = null;

const form = document.getElementById("pdfForm");

const generateBtn = document.getElementById("generatePdf");
const clearBtn = document.getElementById("clearForm");

const titleInput = document.getElementById("title");
const dateInput = document.getElementById("date");
const typeInput = document.getElementById("type");
const contentInput = document.getElementById("content");
const authorInput = document.getElementById("author");

const statusMsg = document.getElementById("statusMsg");

const prevTitle = document.getElementById("prevTitle");
const prevDate = document.getElementById("prevDate");
const prevContent = document.getElementById("prevContent");
const prevAuthor = document.getElementById("prevAuthor");

console.log({
  titleInput,
  dateInput,
  typeInput,
  contentInput,
  authorInput,
  prevTitle,
  prevDate,
  prevContent,
  prevAuthor
});


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

function setStatus(msg) {
  console.log("📢 STATUS:", msg);
  statusMsg.textContent = msg;
}

titleInput.addEventListener("input", () => {
  prevTitle.textContent =
    titleInput.value || "Titolo documento";
});

dateInput.addEventListener("input", () => {
  prevDate.textContent =
    dateInput.value || "Data";
});

contentInput.addEventListener("input", () => {
  prevContent.textContent =
    contentInput.value || "Contenuto...";
});

authorInput.addEventListener("input", () => {
  prevAuthor.textContent =
    authorInput.value || "Autore";
});

generateBtn.addEventListener("click", async () => {

  if (!currentUser) {
    return setStatus("❌ Devi essere loggato");
  }

  if (!titleInput.value.trim()) {
    return setStatus("❌ Inserisci un titolo");
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

    const path = `${currentUser.uid}/${typeInput.value}/${fileName}`;

    const { error } = await supabase.storage
      .from("MyFrEM Staff Documents")
      .upload(path, pdfBlob, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false
      });

    if (error) {
      console.error("❌ Upload error:", error);
      return setStatus("❌ Errore upload PDF");
    }

    const { data: publicUrlData } =
      supabase.storage
        .from("MyFrEM Staff Documents")
        .getPublicUrl(path);

    const pdfUrl =
      publicUrlData.publicUrl;

    console.log("📄 PDF URL:", pdfUrl);

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

    setStatus("✅ PDF generato!");

  } catch (err) {

    console.error("❌ ERRORE:", err);

    setStatus(
      "❌ Errore generazione PDF"
    );
  }
});

clearBtn.addEventListener("click", () => {

  form.reset();

  prevTitle.textContent =
    "Titolo documento";

  prevDate.textContent =
    "Data";

  prevContent.textContent =
    "Contenuto...";

  prevAuthor.textContent =
    "Autore";

  setStatus("🧹 Form pulito");
});
document
  .getElementById("logoutBtn")
  .addEventListener("click", async () => {

    await auth.signOut();

    window.location.href = "/login/";
});