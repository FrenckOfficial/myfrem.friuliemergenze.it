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
const licensePlateInput = document.getElementById("licensePlate");
const sponsorInput = document.getElementById("sponsor");
const locationInput = document.getElementById("location");
const serviceTypeInput = document.getElementById("serviceType");
const notesInput = document.getElementById("notes");

const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

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
    fileNameSpan.textContent = `📸 ${fileInput.files.length} foto selezionate`;
  } else {
    fileNameSpan.textContent = "Nessun file";
  }
});

uploadBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  
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
    
    const path = `${currentUser.uid}/${Date.now()}-${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("MyFrEM Photos")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      console.error("❌ Upload fallito:", uploadError);
      continue;
    }

    const { data: publicURL } = supabase.storage
      .from("MyFrEM Photos")
      .getPublicUrl(path);

    const fileUrl = publicURL.publicUrl;

    await addDoc(collection(db, "photos"), {
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

    const percent = Math.round(((i + 1) / files.length) * 100);
    progressBar.value = percent;
    progressText.textContent = `${percent}% (${uploadedCount}/${files.length})`;
  }

  setStatus(`✅ Caricate ${uploadedCount}/${files.length} foto con watermark!`);
  fileInput.value = "";
  fileNameSpan.textContent = "Nessun file";
  uploadForm.reset();

  progressText.textContent = "Completato ✅";
  progressBar.value = 100;
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