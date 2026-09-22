import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, getDocs, getDoc, doc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";
import { showSuccess, showError, showWarning, showInfo, setStatus } from "../../helpers/modals.js";
import "/helpers/loadIcons.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const photosContainer = document.getElementById("photosContainer");
const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");
const logoutBtn = document.getElementById("logoutBtn");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    tabContents.forEach(tc => tc.classList.remove("active"));
    
    btn.classList.add("active");
    const target = btn.getAttribute("data-tab");
    document.getElementById(target).classList.add("active");
  });
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});

onAuthStateChanged(auth, async (user) => {
  const timeoutId = setTimeout(() => {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 5000);

  await addDoc(collection(db, "viewedPages"), {
    type: "page_view",
    timestamp: serverTimestamp(),
    userId: user.uid,
    page: window.location.pathname
  });

  try {
    if (!user) {
      clearTimeout(timeoutId);
      window.location.href = "/login";
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      setStatus("Errore: utente non trovato.", "error");
      clearTimeout(timeoutId);
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
      return;
    }

    const staffRoles = [
      "simplestaff",
      "modstaff",
      "advstaff",
      "advstaffplus",
      "superadmin",
    ];

    const userData = userDoc.data();
    
    if (userData.role === "testacc") {
      document.body.classList.add("read-only-mode");
      const banner = document.createElement("div");
      banner.style.cssText = "background-color: #fff3cd; color: #856404; padding: 10px; margin-bottom: 10px; border-radius: 4px; text-align: center;";
      banner.textContent = "Modalità sola lettura";
      document.querySelector(".content").insertBefore(banner, document.querySelector(".content").firstChild);
    }

    if (staffRoles.includes(userData.role)) {
      const staffLinkEl = document.querySelector('.navbar');
      const br = document.createElement('br');
      const link = document.createElement('a');
      link.href = '/staff/dashboard/';
      link.textContent = 'Passa alla dashboard staff';
      staffLinkEl.appendChild(br);
      staffLinkEl.appendChild(link);
    }

    await loadPhotos(user.uid);

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  } catch (err) {
    console.error("Errore:", err);
    setStatus("Errore nel caricamento.", "error");
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }
});

async function getVoteCounts(photoId) {
  try {
    const votesQuery = query(
      collection(db, "photos", photoId, "votes")
    );
    const snapshot = await getDocs(votesQuery);

    let likes = 0;
    let dislikes = 0;

    snapshot.forEach((doc) => {
      const voteData = doc.data();
      if (voteData.voteType === "like") likes++;
      else if (voteData.voteType === "dislike") dislikes++;
    });

    return { likes, dislikes };
  } catch (err) {
    console.error("Errore caricamento conteggio voti:", err);
    return { likes: 0, dislikes: 0 };
  }
}

async function loadPhotos(userId) {
  try {
    console.log("Caricamento foto...");
    photosContainer.innerHTML = "";

    const photosQuery = query(
      collection(db, "photos"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(photosQuery);

    if (snapshot.empty) {
      photosContainer.innerHTML = "<p>Nessuna foto caricata.</p>";
      return;
    }

    const photoPromises = [];
    snapshot.forEach((docSnap) => {
      photoPromises.push(
        getVoteCounts(docSnap.id).then(votes => ({
          docSnap,
          votes
        }))
      );
    });

    const photosWithVotes = await Promise.all(photoPromises);

    photosWithVotes.forEach(({ docSnap, votes }) => {
      const data = docSnap.data();
      const card = document.createElement("div");
      card.className = "photo-card";

      const status = data.status.includes("Approvata") ? "approved" :
                     data.status.includes("Rifiutata") ? "rejected" :
                     "pending";

      const statusText = data.status.includes("Approvata") ? "Approvata" :
                         data.status.includes("Rifiutata") ? "Rifiutata" :
                         "Non disponibile";

      const service = getServiceLabel(data.serviceType);

      card.innerHTML = `
        <div class="photo-info">
          <img src="${data.url}" alt="Foto utente" class="photo-img" loading="lazy" />
          <h4>${data.vehicleModel || data.fileName || "Foto"}</h4>
          <p><b>Targa:</b> ${data.licensePlate || "–"}</p>
          <p><b>Posizione:</b> ${data.location || "–"}</p>
          <p><b>Servizio:</b> ${service || "–"}</p>
          <p><b>Note:</b> ${data.notes || "–"}</p>
          <p>
            <b>Stato:</b>
            <span class="status ${status}">${statusText || "In attesa"}</span>
          </p>
          <p>
            <b>Caricata:</b>
            ${data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString("it-IT") : "–"}
          </p>
          ${data.updater ? `
            <p><b>Revisionata da</b> ${data.updater} <b>il:</b> ${
              data.updatedAt?.toDate
                ? data.updatedAt.toDate().toLocaleString("it-IT")
                : data.reviewedAt?.toDate
                  ? data.reviewedAt.toDate().toLocaleString("it-IT")
                  : "–"
            }</p>
          ` : ""}
          
          ${status === "approved" ? `
            <div class="vote-stats">
              <span class="vote-count">
                <i class="fas fa-thumbs-up"></i> ${votes.likes}
              </span>
              <span class="vote-count">
                <i class="fas fa-thumbs-down"></i> ${votes.dislikes}
              </span>
            </div>
          ` : ""}

          ${data.vehicleLink ? `<a href="${data.vehicleLink}" target="_blank" class="gallery-link">Vai al mezzo in galleria</a>` : ""}
        </div>
      `;

      photosContainer.appendChild(card);
    });

    console.log(`Caricate ${snapshot.size} foto`);
  } catch (err) {
    console.error("Errore caricamento foto:", err);
    setStatus("Errore caricamento foto", "error");
  }
}

function getServiceLabel(service) {
  const services = {
    "ordine-pubblico": "Ordine Pubblico",
    "carabinieri": "Carabinieri",
    "polizia-locale": "Polizia Locale / Municipale",
    "polizia-di-stato": "Polizia di Stato",
    "soccorso-alpino": "Soccorso Alpino e Speleologico",
    "corpo-forestale-regionale": "Corpo Forestale Regionale",
    "guardia-di-finanza": "Guardia di Finanza",
    "emergenza-sanitaria": "Soccorso Sanitario",
    "ambulanza": "Soccorso Sanitario",
    "pompieri": "Vigili del Fuoco",
    "guardia-costiera": "Guardia Costiera",
    "protezione-civile": "Protezione Civile"
  };

  return services[service] || service || "N/A";
}