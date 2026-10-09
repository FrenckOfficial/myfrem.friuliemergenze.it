import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js";
import { uploadFile } from "/helpers/uploadFile.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("inp-upl");
const uploadBtn = document.getElementById("btn-upl");
const fileNameSpan = document.getElementById("file-name");
const titleInput = document.getElementById("title");
const descInput = document.getElementById("description");
const progressBar = document.getElementById("progressBar") || { style: {}, value: 0 };
const progressText = document.getElementById("progressText") || { textContent: "" };

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) setStatus("⚠️ Devi essere loggato");
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    fileNameSpan.textContent = `📸 ${fileInput.files.length} file selezionati`;
  } else {
    fileNameSpan.textContent = "Nessun file";
  }
});

uploadBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!currentUser) return setStatus("Devi essere loggato");

  const files = fileInput.files;
  if (files.length === 0) return setStatus("Seleziona almeno un file");

  setStatus("⏳ Upload file in corso...", "info");

  let uploadedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      const fileUrl = await uploadFile(file, "myfrem-staff-docs", currentUser.uid);

      await addDoc(collection(db, "staffDocUploads"), {
        userId: currentUser.uid,
        title: titleInput.value || "",
        description: descInput.value || "",
        name: file.name,
        url: fileUrl,
        createdAt: serverTimestamp()
      });

      uploadedCount++;

      const percent = Math.round(((i + 1) / files.length) * 100);
      progressBar.value = percent;
      progressText.textContent = percent + "%";
    } catch (error) {
      console.error("Errore upload:", error);
    }
  }

  setStatus(`Caricati ${uploadedCount}/${files.length} file!`, "success");
  fileInput.value = "";
  fileNameSpan.textContent = "Nessun file";
  uploadForm.reset();
  window.history.back();

  progressText.textContent = "Completato";
  progressBar.value = 100;
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "/login/";
});