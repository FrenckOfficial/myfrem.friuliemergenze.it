import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { supa } from "/configSupabase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const supabase = createClient(supa.url, supa.anonKey);

const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("inp-upl");
const uploadBtn = document.getElementById("btn-upl");
const statusMsg = document.getElementById("statusMsg");
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

function setStatus(msg) {
  console.log("STATUS:", msg);
  statusMsg.textContent = msg;
}

fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    fileNameSpan.textContent = `📸 ${fileInput.files.length} file selezionati`;
  } else {
    fileNameSpan.textContent = "Nessun file";
  }
});

uploadBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!currentUser) return setStatus("❌ Devi essere loggato");

  const files = fileInput.files;
  if (files.length === 0) return setStatus("❌ Seleziona almeno una foto");

  setStatus("⏳ Upload file in corso...");

  let uploadedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `${currentUser.uid}/${Date.now()}-${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("MyFrEM Staff Documents")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      console.error("❌ Upload fallito:", uploadError);
      continue;
    }

    const { data: publicURL } = supabase.storage
      .from("MyFrEM Staff Documents")
      .getPublicUrl(path);

    const fileUrl = publicURL.publicUrl;

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
  }

  setStatus(`✅ Caricati ${uploadedCount}/${files.length} file!`);
  fileInput.value = "";
  fileNameSpan.textContent = "Nessun file";
  uploadForm.reset();
  window.history.back();

  progressText.textContent = "Completato ✅";
  progressBar.value = 100;
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "/login/";
});