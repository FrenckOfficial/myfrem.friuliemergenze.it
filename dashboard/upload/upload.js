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

  if (user) {
    console.log("✅ Utente loggato:", user.uid);
  } else {
    console.log("❌ Nessun utente loggato");
    setStatus("⚠️ Devi essere loggato");
  }
});

function setStatus(msg) {
  console.log("STATUS:", msg);
  statusMsg.textContent = msg;
}

fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    fileNameSpan.textContent = `✅ ${fileInput.files[0].name}`;
  } else {
    fileNameSpan.textContent = "Nessun file";
  }
});

uploadBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  console.log("📤 Click su upload");

  if (!currentUser) {
    setStatus("❌ Devi essere loggato");
    return;
  }

  const file = fileInput.files[0];

  if (!file) {
    setStatus("❌ Seleziona una foto");
    return;
  }

  const path = `${currentUser.uid}/${Date.now()}-${file.name}`;

  setStatus("⏳ Upload in corso...");

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("MyFrEM Photos")
    .upload(path, file, { upsert: false });

  if (uploadError) {
    console.error("Errore upload Supabase:", uploadError);
    setStatus("❌ Upload fallito: " + uploadError.message);
    return;
  }

  const { data: publicURL } = supabase.storage
    .from("MyFrEM Photos")
    .getPublicUrl(path);

  const fileUrl = publicURL.publicUrl;

  if (!fileUrl) {
    setStatus("❌ Errore: impossibile ottenere URL pubblica");
    return;
  }

  console.log("📸 URL pubblica:", fileUrl);

  progressBar.value = 100;
  progressText.textContent = "100%";

  try {
    console.log("🔥 Salvataggio su Firestore...");

    const activityRef = await addDoc(collection(db, "activities"), {
      userName: currentUser.uid,
      photoTitle: titleInput.value || "-",
      timestamp: serverTimestamp(),
      type: "photo_submission",
    });

    const docRef = await addDoc(collection(db, "photos"), {
      userId: currentUser.uid,
      title: titleInput.value || "",
      description: descInput.value || "",
      name: file.name,
      url: fileUrl,
      status: "Foto in attesa di approvazione ⌛",
      createdAt: serverTimestamp()
    });

    console.log("✅ Salvato! Photo ID:", docRef.id, "Activity ID:", activityRef.id);

    setStatus("✅ Foto caricata e salvata!");
    fileInput.value = "";
    fileNameSpan.textContent = "Nessun file";
    progressText.textContent = "Completato ✅";

  } catch (err) {
    console.error("❌ Errore Firestore:", err);
    setStatus("❌ Errore nel salvataggio DB");
  }

  uploadForm.reset();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  console.log("🚪 Logout...");
  await auth.signOut();
  window.location.href = "/login/";
});