import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { uploadFile } from "/helpers/uploadFile.js"
import { firebaseConfig } from "/helpers/configFirebase.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { initBottomNav } from "/helpers/initBottomNav.js";
import { addStaffLink } from "/helpers/loadNavbar.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("inp-upl");
const uploadBtn = document.getElementById("btn-upl");
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
const rulesCheck = document.getElementById("rulesCheck");
const dropZone = document.getElementById("dropZone");

const NO_FILE_TEXT = "Nessun file selezionato";
let isUploading = false;

let currentUser = null;
let isReadOnlyMode = false;

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  
  if (!user) {
    setStatus("Devi essere loggato");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
    window.location.href = "/login/";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }, 5000);

  await addDoc(collection(db, "viewedPages"), {
    type: "page_view",
    timestamp: serverTimestamp(),
    userId: user.uid,
    page: window.location.pathname
  });

  try {
    const staffRoles = [
      "simplestaff",
      "modstaff",
      "advstaff",
      "advstaffplus",
      "superadmin",
    ];

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

      if (staffRoles.includes(userData.role)) {
        addStaffLink();
      }

      initBottomNav(userData, user, "user");
    }

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;

  } catch (err) {
    console.error("Errore caricamento auth:", err);
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }
});

fileInput.addEventListener("change", async () => {
  if (fileInput.files.length > 0) {
    const count = fileInput.files.length;
    fileNameSpan.textContent = count === 1 ? `1 foto selezionata: ${fileInput.files[0].name}` : `${count} foto selezionate`;
    
    try {
      const firstFile = fileInput.files[0];
      const watermarkedFile = await addWatermarkToImage(firstFile, "/assets/icons/logo.png");
      
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = "block";
        previewContainer.style.display = "flex";
      };
      reader.readAsDataURL(watermarkedFile);
    } catch (error) {
      console.error("Errore preview:", error);
      previewContainer.style.display = "none";
    }
  } else {
    fileNameSpan.textContent = NO_FILE_TEXT;
    previewContainer.style.display = "none";
  }
});

["dragenter", "dragover"].forEach((type) => dropZone.addEventListener(type, () => dropZone.classList.add("is-over")));
["dragleave", "drop"].forEach((type) => dropZone.addEventListener(type, () => dropZone.classList.remove("is-over")));

deletePreviewBtn.addEventListener("click", () => {
  fileInput.value = "";
  fileNameSpan.textContent = NO_FILE_TEXT;
  preview.src = "";
  previewContainer.style.display = "none";
});

uploadBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  if (isUploading) return;

  if (isReadOnlyMode) {
    return setStatus("Non puoi caricare foto in modalità sola lettura");
  }

  if (!currentUser) return setStatus("Devi essere loggato");
  if (!titleInput.value.trim()) {
    return setStatus("Il modello del veicolo è obbligatorio");
  }
  if (!locationInput.value.trim()) {
    return setStatus("La sede di appartenenza è obbligatoria");
  }
  if (serviceTypeInput.value === "none") {
    return setStatus("Seleziona il servizio svolto dal mezzo");
  }

  const files = fileInput.files;
  if (files.length === 0) return setStatus("Seleziona almeno una foto");
  if (!rulesCheck.checked) return setStatus("Conferma di aver letto le regole prima di inviare le foto", "warning");

  isUploading = true;
  uploadBtn.disabled = true;
  uploadBtn.textContent = "Caricamento in corso...";

  try {
    await uploadPhotos(files);
  } catch (error) {
    console.error("Errore caricamento foto:", error);
    setStatus("Caricamento non riuscito::Controlla la connessione e riprova. Le foto già inviate restano salvate.", "error");
    progressBar.style.display = "none";
    progressText.style.display = "none";
  } finally {
    isUploading = false;
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Invia per la revisione";
  }
});

async function uploadPhotos(files) {
  setStatus("Caricamento delle foto in corso...");
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
      console.error("Errore watermark:", error);
      continue;
    }

    progressBar.value = 40;
    progressText.textContent = "40%";

    progressBar.value = 50;
    progressText.textContent = "50%";

    progressBar.value = 60;
    progressText.textContent = "60%";

    const fileUrl = await uploadFile(file, "myfrem-photos", currentUser.uid);

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
      status: "Foto in attesa di approvazione",
      createdAt: serverTimestamp()
    });

    uploadedCount++;

    progressBar.value = 90;
    progressText.textContent = "90%";

    await notifyNewPhoto(ptDoc.id);
  }

  setStatus(uploadedCount === files.length
    ? `${uploadedCount === 1 ? "Foto inviata" : `${uploadedCount} foto inviate`}::Lo staff la revisionerà a breve. Trovi lo stato in I miei contenuti.`
    : `Inviate ${uploadedCount} foto su ${files.length}::Alcune foto non sono state elaborate, riprova con quelle mancanti.`, uploadedCount ? "success" : "error");
  fileInput.value = "";
  fileNameSpan.textContent = NO_FILE_TEXT;
  progressText.textContent = "100%";
  progressBar.value = 100;
  setTimeout(() => {
    uploadForm.reset();
    preview.style.display = "none";
    progressText.textContent = "0%";
    progressBar.value = 0;
    previewContainer.style.display = "none";
    preview.src = "";
    progressBar.style.display = "none";
    progressText.style.display = "none";
  }, 1500);
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "/login/";
});

async function notifyNewPhoto(photoId) {
  let token;
  try {
    token = await currentUser.getIdToken();
  } catch (error) {
    console.error("Token non disponibile, notifiche non inviate:", error);
    return;
  }

  const request = (path) => fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ photoId })
  })
    .then((response) => {
      if (!response.ok) console.error(`Errore ${path}:`, response.status);
    })
    .catch((error) => console.error(`Errore ${path}:`, error));

  await Promise.all([request("/api/sendPhotoNotification"), request("/api/sendStaffNewPhotoEmail")]);
}

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
