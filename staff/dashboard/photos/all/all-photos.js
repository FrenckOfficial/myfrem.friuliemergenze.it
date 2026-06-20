import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const photosTableBody = document.getElementById("photosTbody");
const statusMsg = document.getElementById("statusMsg");
const logoutBtn = document.getElementById("logoutBtn");
const messageBox = document.getElementById("messageBox");

let usersMap = {};

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

function setStatus(message, type = "info") {
  statusMsg.textContent = message;
  statusMsg.className = `${"statusBox" + " " + type}`;
  statusMsg.style.display = "block";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    const allowedRoles = ["simplestaff", "modstaff", "advstaff", "advstaffplus", "superadmin"];

    if (!allowedRoles.includes(userData.role)) {
      setStatus("Accesso negato: solo staff autorizzato.", "error");
      window.location.href = "/login/";
      return;
    }

    await loadUsersMap();
    loadAllPhotos();
  } catch (err) {
    console.error("Errore verifica staff:", err);
    setStatus("Errore verifica permessi", "error");
  }
});

async function loadUsersMap() {
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(docSnap => {
      usersMap[docSnap.id] = docSnap.data().username || "Sconosciuto";
    });
  } catch (err) {
    console.error("Errore caricamento utenti:", err);
  }
}

async function loadAllPhotos() {
  try {
    setStatus("⏳ Caricamento tutte le foto...");

    const q = query(
      collection(db, "photos"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    photosTableBody.innerHTML = "";

    if (snapshot.empty) {
      setStatus("Nessuna foto trovata");
      return;
    }

    snapshot.forEach((docSnap) => {
      const photo = docSnap.data();
      const id = docSnap.id;

      const statusColor =
        photo.status?.includes("Approvata") ? "green" :
        photo.status?.includes("Rifiutata") ? "red" : "orange";

      let linkBox = "Non disponibile in quanto foto in attesa o rifiutata";
      let serviceType = "Non inserito";

      if (photo.status?.includes("Approvata")) {
        const hasLink = photo.vehicleLink && photo.vehicleLink.trim().length > 0;

        linkBox = `
          <div class="photo-link-box" id="box-${id}">
            <a
              href="${hasLink ? photo.vehicleLink : "#"}"
              target="_blank"
              id="link-view-${id}"
              style="text-decoration: underline; font-size: 1em; word-break: break-all;"
              class="photo-link-static ${hasLink ? "" : "hidden"}"
            >
              ${hasLink ? photo.vehicleLink : ""}
            </a>

            <div id="link-input-wrapper-${id}" class="link-input-wrapper ${hasLink ? "hidden" : ""}">
              <input
                type="url"
                id="link-input-${id}"
                class="photo-link-input"
                placeholder="https://friuliemergenze.it/gallery/scheda/(mezzo)"
                value="${hasLink ? photo.vehicleLink : ""}"
              />
              <div class="link-input-buttons">
                <button class="edit-link-btn save-btn" onclick="saveVehicleLink('${id}')" title="Salva">
                  <img src="/assets/icons/floppy-disk-regular-full.svg" alt="Salva" />
                </button>
              </div>
            </div>

            <button class="edit-link-btn edit-btn ${hasLink ? "" : "hidden"}" onclick="editLink('${id}')" title="Modifica">
              <img src="/assets/icons/pen-solid-full.svg" alt="Modifica" />
            </button>
          </div>
        `;
      }

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
        <td><span class="status-indicator" style="background-color: ${statusColor};"></span> <b>${photo.status || "Sconosciuto"}</b></td>
        <td><img src="${photo.url}" class="preview" alt="Preview della foto caricata tramite i sistemi Friuli Emergenze" /></td>
        <td><b>${photo.vehicleModel || "Non inserito"}</b></td>
        <td><b>${photo.sponsor || "Non inserito"}</b></td>
        <td><b>${photo.licensePlate || "Non inserita"}</b></td>
        <td><b>${serviceType}</b></td>
        <td><b>${photo.location || "Non inserita"}</b></td>
        <td><b>${usersMap[photo.userId] || "Sconosciuto"}</b></td>
        <td><b>${photo.createdAt?.toDate().toLocaleString() || "-"}</b></td>
        <td><b>${photo.notes || "Non inserite"}</b></td>
        <td><b>${linkBox}</b></td>
        <td><button class="delete-btn" onclick="deletePhoto('${id}')">Elimina foto <img src="/assets/icons/trash-solid-full.svg" alt="Elimina"/></button></td>
      `;

      photosTableBody.appendChild(tr);
    });

    setStatus(`📸 Totale foto: ${snapshot.size}`);
  } catch (err) {
    console.error("Errore caricamento:", err);
    setStatus("Errore caricamento foto", "error");
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

window.editLink = (photoId) => {
  const view = document.getElementById(`link-view-${photoId}`);
  const inputWrapper = document.getElementById(`link-input-wrapper-${photoId}`);
  const input = document.getElementById(`link-input-${photoId}`);
  const editBtn = event.target.closest(".edit-btn");

  if (view) view.classList.add("hidden");
  if (inputWrapper) inputWrapper.classList.remove("hidden");
  if (editBtn) editBtn.classList.add("hidden");
  if (input) input.focus();
};

window.saveVehicleLink = async (photoId) => {
  const input = document.getElementById(`link-input-${photoId}`);
  const link = input?.value?.trim();

  if (!link) {
    setStatus("Inserisci un link valido", "error");
    return;
  }

  if (!isValidUrl(link)) {
    setStatus("Formato URL non valido. Usa: https://friuliemergenze.it", "error");
    return;
  }

  try {
    const saveBtn = document.querySelector(`#box-${photoId} .save-btn`);
    if (saveBtn) saveBtn.disabled = true;

    const photoRef = doc(db, "photos", photoId);
    const photoSnap = await getDoc(photoRef);
    const photoData = photoSnap.data() || {};

    await updateDoc(photoRef, {
      vehicleLink: link,
      updatedAt: serverTimestamp()
    });

    await addDoc(collection(db, "activities"), {
      type: "photo_edit",
      editStaffer: auth.currentUser?.email || "-",
      timestamp: serverTimestamp()
    });

    const view = document.getElementById(`link-view-${photoId}`);
    const inputWrapper = document.getElementById(`link-input-wrapper-${photoId}`);
    const editBtn = document.querySelector(`#box-${photoId} .edit-btn`);

    if (view) {
      view.href = link;
      view.textContent = link;
      view.classList.remove("hidden");
    }
    if (inputWrapper) inputWrapper.classList.add("hidden");
    if (editBtn) editBtn.classList.remove("hidden");
    if (input) input.setAttribute("value", link);

    setStatus("✅ Link salvato con successo", "success");

  } catch (err) {
    console.error("Errore salvataggio link:", err);
    setStatus("❌ Errore salvataggio link", "error");
  } finally {
    const saveBtn = document.querySelector(`#box-${photoId} .save-btn`);
    if (saveBtn) saveBtn.disabled = false;
  }
};

window.deletePhoto = async (photoId) => {
  if (!confirm("Sei sicuro di voler eliminare questa foto? Questa azione è irreversibile.")) {
    return;
  } else {
    try {
      await deleteDoc(doc(db, "photos", photoId));

      await addDoc(collection(db, "activities"), {
        type: "photo_delete",
        editStaffer: auth.currentUser?.email || "-",
        timestamp: serverTimestamp()
      });

      setStatus("✅ Foto eliminata con successo", "success");
      loadAllPhotos();
    } catch (err) {
      console.error("Errore eliminazione foto:", err);
      setStatus("❌ Errore eliminazione foto", "error");
    }
  }
}