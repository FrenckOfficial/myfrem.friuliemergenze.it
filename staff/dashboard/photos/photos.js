import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "/configFirebase.js"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const photosTableBody = document.getElementById("photosTableBody");
const statusMsg = document.getElementById("statusMsg");
const logoutBtn = document.getElementById("logoutBtn");
const viewAllPhotos = document.getElementById("viewAllPhotos");
const draftBtnCreate = document.getElementById("draft-btn-create");
const draftBtnSkip = document.getElementById("draft-btn-skip");
const draftModalClose = document.getElementById("draft-modal-close");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

let usersMap = {};
let currentPhotoForDraft = null;

draftBtnCreate.addEventListener("click", () => {
  createVehicleDraft();
});
draftBtnSkip.addEventListener("click", () => {
  closeDraftModal();
})
draftModalClose.addEventListener("click", () => {
  closeDraftModal();
})

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

viewAllPhotos.addEventListener("click", () => {
  window.location.href = "/staff/dashboard/photos/all";
});

function setStatus(message, type = "info") {
  const classNameBox = document.querySelector(".statusBox");
  statusMsg.textContent = message;
  classNameBox.className = `${"statusBox" + " " + type}`;
  classNameBox.style.display = "block";
  const closeBtn = document.getElementById("closeSMsg");
  closeBtn.onclick = () => {
    classNameBox.style.display = "none";
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const userDoc = await getDocs(
    query(collection(db, "users"), where("__name__", "==", user.uid))
  );

  const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

  if (userDoc.empty || !allowedRoles.includes(userDoc.docs[0].data().role)) {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    setStatus("Accesso negato: non sei staff!", "error");
    window.location.href = "/dashboard";
    return;
  }

  const timeoutId = setTimeout(() => {
    console.warn("⏱️ Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  await loadUsersMap();
  await loadPendingPhotos();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

async function loadUsersMap() {
  const snap = await getDocs(collection(db, "users"));
  snap.forEach(docSnap => {
    usersMap[docSnap.id] = docSnap.data().username || "Sconosciuto";
  });
}

async function loadPendingPhotos() {
  try {
    setStatus("⏳ Caricamento foto...");

    const q = query(
      collection(db, "photos"),
      where("status", "==", "Foto in attesa di approvazione ⌛")
    );

    const snapshot = await getDocs(q);
    photosTableBody.innerHTML = "";

    if (snapshot.empty) {
      setStatus("✅ Nessuna foto da moderare");
      return;
    }

    snapshot.forEach((docSnap) => {
      const photo = docSnap.data();

      let serviceType = "Non inserito"

      if (photo.serviceType === "ordine-pubblico") {
        serviceType = "Ordine Pubblico";
      } else if (photo.serviceType === "emergenza-sanitaria") {
        serviceType = "Emergenza Sanitaria";
      } else if (photo.serviceType === "trasporti-secondari") {
        serviceType = "Automezzo adibito a trasporti secondari";
      } else if (photo.serviceType === "soccorso-tecnico-urgente") {
        serviceType = "Vigili del Fuoco";
      } else if (photo.serviceType === "guardia-costiera") {
        serviceType = "Guardia Costiera";
      } else if (photo.serviceType === "protezione-civile") {
        serviceType = "Protezione Civile";
      } else serviceType;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${photo.url}" class="preview" loading="lazy" /></td>
        <td>${photo.vehicleModel || "Non inserito"}</td>
        <td>${photo.sponsor || "Non inserito"}</td>
        <td>${photo.licensePlate || "Non inserita"}</td>
        <td>${serviceType}</td>
        <td>${photo.location || "Non inserita"}</td>
        <td>${usersMap[photo.userId] || "Sconosciuto"}</td>
        <td>${photo.createdAt?.toDate().toLocaleString() || "-"}</td>
        <td>${photo.notes || "Non inserite"}</td>
        <td>
          <button class="approve" data-id="${docSnap.id}" data-photo='${JSON.stringify(photo)}'>✅ Approva</button>
          <button class="reject" data-id="${docSnap.id}" data-photo='${JSON.stringify(photo)}'>❌ Rifiuta</button>
        </td>
      `;
      photosTableBody.appendChild(tr);

      document.querySelectorAll(".approve").forEach(btn => {
        btn.addEventListener("click", async () => {
          try {
            const photoSnap = await getDoc(doc(db, "photos", btn.dataset.id));
            const photoData = photoSnap.data();
            const userSnap = await getDoc(doc(db, "users", photoData.userId));
            const userData = userSnap.data();
            const photoPublisher = photoData.userId;
            const photoName = photoData.vehicleModel;
            const userEmail = userData.email;
            const userName = `${userData.name} ${userData.surname}`;

            addDoc(collection(db, "activities"), {
              type: "photo_approval",
              approvalStaffer: auth.currentUser.email || "-",
              timestamp: serverTimestamp()
            });
            
            updatePhotoStatus(btn.dataset.id, "Approvata ✅");

            if (userData.emailNotifications === true) {
              sendNotificationApprovement(userName, userEmail, photoName);
            }

            setTimeout(() => {
              openDraftModal(photoData, btn.dataset.id);
            }, 500);
          } catch (err) {
            console.error("Errore:", err);
          }
        });
      });

      document.querySelectorAll(".reject").forEach(btn => {
        btn.addEventListener("click", async () => {
          try {
            const photoSnap = await getDoc(doc(db, "photos", btn.dataset.id));
            const photoData = photoSnap.data();
            const userSnap = await getDoc(doc(db, "users", photoData.userId));
            const userData = userSnap.data();
            const photoPublisher = photoData.userId;
            const photoName = photoData.vehicleModel;
            const userEmail = userData.email;
            const userName = `${userData.name} ${userData.surname}`;

            addDoc(collection(db, "activities"), {
              type: "photo_rejection",
              rejectionStaffer: auth.currentUser.email || "-",
              timestamp: serverTimestamp()
            });
            
            updatePhotoStatus(btn.dataset.id, "Rifiutata ❌");

            if (userData.emailNotifications === true) {
              sendNotificationRejection(userName, userEmail, photoName);
            }
          } catch (err) {
            console.error("Errore:", err);
          }
        });
      });
    });

    setStatus(`📸 Caricate ${snapshot.size} foto`);
  } catch (err) {
    console.error("Errore caricamento foto:", err);
    setStatus("Errore caricamento foto", "error");
  }
}

async function updatePhotoStatus(photoId, status) {
  try {
    setStatus("⏳ Aggiornamento...");

    await updateDoc(doc(db, "photos", photoId), {
      status: status,
      reviewedAt: serverTimestamp()
    });

    setStatus(`✅ Foto ${status}`);
    loadPendingPhotos();
  } catch (err) {
    console.error("Errore aggiornamento:", err);
    setStatus("Errore aggiornamento", "error");
  }
}

function openDraftModal(photoData, photoId) {
  currentPhotoForDraft = {
    ...photoData,
    photoId: photoId
  };
 
  const photoPreview = document.getElementById('draftPhotoPreview');
  const photoFileName = document.getElementById('draftFileName');
 
  if (photoPreview) {
    photoPreview.src = photoData.url || '';
  }
 
  if (photoFileName) {
    photoFileName.textContent = photoData.vehicleModel || 'Foto veicolo';
  }
 
  const modal = document.getElementById('draftModal');
  if (modal) {
    modal.classList.add('active');
  }
}

function closeDraftModal() {
  const modal = document.getElementById('draftModal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentPhotoForDraft = null;
}

async function createVehicleDraft() {
  if (!currentPhotoForDraft) {
    setStatus('Errore: dati foto non disponibili', 'error');
    return;
  }
 
  try {
    setStatus('⏳ Creazione bozza...');
 
    const fileName = (currentPhotoForDraft.vehicleModel || 'veicolo')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');
 
    const draftRef = await addDoc(collection(db, 'vehiclesDraft'), {
      fileName: extractFileName(currentPhotoForDraft.url),
      photoUrl: currentPhotoForDraft.url,
      status: 'pending',
      data: {
        title: currentPhotoForDraft.vehicleModel || '',
        brand: '',
        model: '',
        plate: currentPhotoForDraft.licensePlate || '',
        builder: currentPhotoForDraft.sponsor || '',
        service: mapServiceType(currentPhotoForDraft.serviceType),
        headquarters: currentPhotoForDraft.location || '',
        notes: currentPhotoForDraft.notes || ''
      },
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.email || auth.currentUser?.displayName || 'Staff',
      sourcePhotoId: currentPhotoForDraft.photoId
    });
 
    await addDoc(collection(db, 'activities'), {
      type: 'vehicle_draft_created',
      staffMember: auth.currentUser?.email || '-',
      photoId: currentPhotoForDraft.photoId,
      draftId: draftRef.id,
      timestamp: serverTimestamp()
    });
 
    setStatus(`✅ Bozza veicolo creata (ID: ${draftRef.id})`);
    closeDraftModal();
 
  } catch (error) {
    console.error('Errore creazione bozza:', error);
    setStatus(`Errore creazione bozza: ${error.message}`, 'error');
  }
}

async function sendNotificationApprovement(userName, userEmail, photoName) {
  try {
    const response = await fetch('/api/sendNotificationApprovement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userName,
        userEmail,
        photoName
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Errore ${response.status}:`, errorText);
      setStatus(`Errore notifica: ${response.status}`, 'error');
      return;
    }

    console.log('✅ Notifica inviata');
  } catch (error) {
    console.error('Errore fetch:', error);
    setStatus('Errore invio notifica', 'error');
  }
}

async function sendNotificationRejection(userName, userEmail, photoName) {
  try {
    const response = await fetch('/api/sendNotificationRejection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userName,
        userEmail,
        photoName
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Errore ${response.status}:`, errorText);
      setStatus(`Errore notifica: ${response.status}`, 'error');
      return;
    }

    console.log('✅ Notifica inviata');
  } catch (error) {
    console.error('Errore fetch:', error);
    setStatus('Errore invio notifica', 'error');
  }
}

function extractFileName(url) {
  if (!url) return 'immagine.jpg';
  const parts = url.split('/');
  return parts[parts.length - 1].split('?')[0] || 'immagine.jpg';
}

function mapServiceType(serviceType) {
  const map = {
    'ordine-pubblico': 'polizia',
    'emergenza-sanitaria': 'ambulanza',
    'trasporti-secondari': 'trasporti',
    'soccorso-tecnico-urgente': 'pompieri',
    'guardia-costiera': 'guardia_costiera',
    'protezione-civile': 'protezione_civile'
  };
  return map[serviceType] || serviceType || 'altro';
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('draftModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeDraftModal();
      }
    });
  }
});