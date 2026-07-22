import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { supa } from "/configSupabase.js";
import { firebaseConfig } from "/configFirebase.js";

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
const licensePlateInput = document.getElementById("licensePlate");
const sponsorInput = document.getElementById("sponsor");
const locationInput = document.getElementById("location");
const serviceTypeInput = document.getElementById("serviceType");
const notesInput = document.getElementById("notes");

const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const previewContainer = document.getElementById("previewContainer");
const preview = document.getElementById("preview");
const deletePreviewBtn = document.getElementById("deletePreviewBtn");

let currentUser = null;
let isReadOnlyMode = false;

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  
  if (!user) {
    setStatus("⚠️ Devi essere loggato");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
    window.location.href = "/login/";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("⏱️ Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }, 5000);

  try {
    const userDocSnap = await getDoc(doc(db, "users", user.uid));
    
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      
      if (userData.role === "testacc") {
        isReadOnlyMode = true;
        document.body.classList.add("read-only-mode");
        uploadBtn.disabled = true;
        uploadBtn.style.opacity = "0.5";
        uploadBtn.style.cursor = "not-allowed";
        uploadBtn.title = "Non disponibile in modalità sola lettura";
        setStatus("📖 Modalità sola lettura: puoi solo visualizzare i contenuti");
        fileInput.disabled = true;
      }
    }

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;

  } catch (err) {
    console.error("❌ Errore caricamento auth:", err);
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }
});

function setStatus(msg) {
  console.log("STATUS:", msg);
  statusMsg.textContent = msg;
}

fileInput.addEventListener("change", async () => {
  if (fileInput.files.length > 0) {
    fileNameSpan.textContent = `📸 ${fileInput.files.length} foto selezionate`;
    
    try {
      const firstFile = fileInput.files[0];
      const watermarkedFile = await addWatermarkToImage(firstFile, "/assets/icons/logo.png");
      
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        previewContainer.style.display = "flex";
      };
      reader.readAsDataURL(watermarkedFile);
    } catch (error) {
      console.error("❌ Errore preview:", error);
      previewContainer.style.display = "none";
    }
  } else {
    fileNameSpan.textContent = "Nessun file";
    previewContainer.style.display = "none";
  }
});

deletePreviewBtn.addEventListener("click", () => {
  fileInput.value = "";
  fileNameSpan.textContent = "Nessun file";
  preview.src = "";
  previewContainer.style.display = "none";
  setStatus("Preview eliminato");
});

uploadBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  
  if (isReadOnlyMode) {
    return setStatus("❌ Non puoi caricare foto in modalità sola lettura");
  }

  if (!currentUser) return setStatus("❌ Devi essere loggato");
  if (!titleInput.value.trim()) {
    return setStatus("❌ Il modello del veicolo è obbligatorio");
  }
  if (!locationInput.value.trim()) {
    return setStatus("❌ La sede di appartenenza è obbligatoria");
  }
  if (serviceTypeInput.value === "none") {
    return setStatus("❌ Seleziona una tipologia di servizio");
  }

  const files = fileInput.files;
  if (files.length === 0) return setStatus("❌ Seleziona almeno una foto");

  setStatus("⏳ Upload foto in corso...");
  progressBar.style.display = "block";
  progressText.style.display = "block";
  progressBar.value = 0;
  progressText.textContent = "0%";

  const activityRef = await addDoc(collection(db, "activities"), {
    userId: currentUser.uid,
    timestamp: serverTimestamp(),
    type: "photo_submission",
  });
  progressBar.value = 20;
  progressText.textContent = "20%";

  let uploadedCount = 0;
  const logoUrl = "/assets/icons/logo.png";

  for (let i = 0; i < files.length; i++) {
    let file = files[i];
    
    try {
      file = await addWatermarkToImage(file, logoUrl);
    } catch (error) {
      console.error("❌ Errore watermark:", error);
      continue;
    }

    progressBar.value = 40;
    progressText.textContent = "40%";
    
    const path = `${currentUser.uid}/${Date.now()}-${file.name}`;

    progressBar.value = 50;
    progressText.textContent = "50%";

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("MyFrEM Photos")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      console.error("❌ Upload fallito:", uploadError);
      continue;
    }

    progressBar.value = 60;
    progressText.textContent = "60%";

    const { data: publicURL } = supabase.storage
      .from("MyFrEM Photos")
      .getPublicUrl(path);

    const fileUrl = publicURL.publicUrl;

    progressBar.value = 80;
    progressText.textContent = "80%";

    const ptDoc = await addDoc(collection(db, "photos"), {
      userId: currentUser.uid,
      activityId: activityRef.id,
      vehicleModel: titleInput.value,
      licensePlate: licensePlateInput.value || "-",
      sponsor: sponsorInput.value || "-",
      location: locationInput.value,
      serviceType: serviceTypeInput.value,
      fileName: file.name,
      url: fileUrl,
      notes: notesInput.value || "-",
      status: "Foto in attesa di approvazione ⌛",
      createdAt: serverTimestamp()
    });

    uploadedCount++;

    progressBar.value = 90;
    progressText.textContent = "90%";

    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    if (!userData) {
      console.error("❌ userData è undefined");
      continue;
    }

    if (userData.emailNotifications === true) {
      const userEmail = userData.email
      const userName = userData.name
  
      const uploadedAt = new Date().toISOString();

      console.log(uploadedAt);

      if (uploadedAt.undefined === true) {
        console.error("❌ uploadedAt undefined");
        continue;
      }
  
      const response = await fetch("/api/sendPhotoNotification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userEmail: userEmail,
          userName: userName,
          photoName: titleInput.value,
          uploadedAt: uploadedAt
        })
      })

      if (!response.ok) {
        console.error("❌ Errore invio notifica email:", response.status);
      }
    }
  }

  setStatus(`✅ Caricate ${uploadedCount}/${files.length} foto!`);
  fileInput.value = "";
  fileNameSpan.textContent = "Nessun file";
  progressText.textContent = "100%";
  progressBar.value = 100;
  setTimeout(() => {
    uploadForm.reset();
  }, 5000);
  preview.style.display = "none";

  progressText.textContent = "0%";
  progressBar.value = 0;

  previewContainer.style.display = "none";
  preview.src = "";
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "/login/";
});

async function addWatermarkToImage(file, logoUrl = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext("2d");
        
        ctx.drawImage(img, 0, 0);
        
        if (logoUrl) {
          const logo = new Image();
          logo.crossOrigin = "anonymous";
          
          logo.onload = () => {
            const logoSize = 240;
            const padding = 20;
            
            ctx.drawImage(
              logo,
              padding,
              padding,
              logoSize,
              logoSize
            );
            
            finalizCanvas(canvas, file, resolve);
          };
          
          logo.onerror = () => {
            console.warn("Logo non caricato, continua senza");
            finalizCanvas(canvas, file, resolve);
          };
          
          logo.src = logoUrl;
        } else {
          finalizCanvas(canvas, file, resolve);
        }
      };
      
      img.onerror = () => reject(new Error("Impossibile caricare l'immagine"));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error("Errore lettura file"));
    reader.readAsDataURL(file);
  });
}

function finalizCanvas(canvas, originalFile, resolve) {
  canvas.toBlob((blob) => {
    const watermarkedFile = new File(
      [blob],
      originalFile.name,
      { type: "image/jpeg", lastModified: Date.now() }
    );
    resolve(watermarkedFile);
  }, "image/jpeg", 0.95);
}