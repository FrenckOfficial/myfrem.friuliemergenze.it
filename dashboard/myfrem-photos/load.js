import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "../../configFirebase.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const photosContainer = document.getElementById("photosContainer");
const statusMsg = document.getElementById("statusMsg");

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");

let currentUserId = null;

onAuthStateChanged(auth, async (user) => {
  const timeoutId = setTimeout(() => {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 5000);

  try {
    if (!user) {
      clearTimeout(timeoutId);
      window.location.href = "/login/";
      return;
    }

    currentUserId = user.uid;
    await checkUserRole(user.uid);
    await loadAllPhotos();

    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  } catch (err) {
    console.error("Errore:", err);
    clearTimeout(timeoutId);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";;
  }
});

async function checkUserRole(uid) {
  try {
    const userDocSnap = await getDoc(doc(db, "users", uid));
    if (userDocSnap.exists()) {
      const staffRoles = [
        "simplestaff",
        "modstaff",
        "advstaff",
        "advstaffplus",
        "superadmin",
      ];

      const userData = userDocSnap.data();
      if (userData.role === "testacc") {
        document.body.classList.add("read-only-mode");
        const banner = document.createElement("div");
        banner.style.cssText = "background-color:#fff3cd;color:#856404;padding:10px;margin-bottom:10px;border-radius:4px;text-align:center;";
        banner.textContent = "Modalità sola lettura";
        photosContainer.parentElement.insertBefore(banner, photosContainer);
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
    }
  } catch (err) {
    console.error("Errore verifica ruolo:", err);
  }
}

async function loadAllPhotos() {
  try {
    console.log("Caricamento foto...");
    photosContainer.innerHTML = "";

    const photosQuery = query(
      collection(db, "photos"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(photosQuery);

    if (snapshot.empty) {
      photosContainer.innerHTML = "<p>Nessuna foto caricata.</p>";
      setStatus("", "");
      return;
    }

    snapshot.forEach(async (docs) => {
      const data = docs.data();
      const photoId = docs.id;
      const card = document.createElement("div");
      card.className = "photo-card";

      const service = getServiceLabel(data.serviceType);
      
      let userName = data.userId;

      const userDocSnap = await getDoc(doc(db, "users", userName));
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        userName = userData.name + " " + userData.surname || "Sconosciuto";
      }

      if (data.status === "Approvata ✅"|| "Approvata") {
        const voteCounts = await getVoteCounts(photoId);
        const userVote = await getUserVote(photoId);

        card.innerHTML = `
        <div class="photo-info">
          <img src="${data.url}" alt="Foto utente" class="photo-img" loading="lazy" />
          <h4>${data.vehicleModel || data.fileName || "Foto"}</h4>
          <p><b>Targa:</b> ${data.licensePlate || "–"}</p>
          <p><b>Posizione:</b> ${data.location || "–"}</p>
          <p><b>Servizio:</b> ${service || "–"}</p>
          <p><b>Note:</b> ${data.notes || "–"}</p>
          <p><b>Publisher:</b> <a href="/profile/?userid=${data.userId}" target="_blank" style="font-size: var(--text-sm);color: var(--muted);margin: 0 0 var(--space-md) 0;line-height: 1.5;">${userName || "–"}</a></p>

          <div class="vote-container">
            <button class="vote-btn like-btn" data-photo-id="${photoId}" data-vote-type="like" data-user-vote="${userVote}">
              <i class="fas fa-thumbs-up"></i>
              <span class="vote-count">${voteCounts.likes}</span>
            </button>
            <button class="vote-btn dislike-btn" data-photo-id="${photoId}" data-vote-type="dislike" data-user-vote="${userVote}">
              <i class="fas fa-thumbs-down"></i>
              <span class="vote-count">${voteCounts.dislikes}</span>
            </button>
          </div>

          ${
            data.vehicleLink
              ? `
                <a href="${data.vehicleLink}" target="_blank" class="gallery-link">
                  Vai al mezzo in galleria
                </a>
              `
              : ""
          }
        </div>
      `;

        photosContainer.appendChild(card);

        const likeBtn = card.querySelector(".like-btn");
        const dislikeBtn = card.querySelector(".dislike-btn");

        updateVoteButtonStates(likeBtn, dislikeBtn, userVote);

        likeBtn.addEventListener("click", () => handleVote(photoId, "like", likeBtn, dislikeBtn));
        dislikeBtn.addEventListener("click", () => handleVote(photoId, "dislike", dislikeBtn, likeBtn));
      } else {
        return
      }
    });

    console.log(`Caricate ${snapshot.size} foto`);
  } catch (err) {
    console.error("Errore caricamento foto:", err);
    setStatus("Errore caricamento foto", "error");
  }
}

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

async function getUserVote(photoId) {
  try {
    const voteDoc = await getDoc(
      doc(db, "photos", photoId, "votes", currentUserId)
    );
    if (voteDoc.exists()) {
      return voteDoc.data().voteType;
    }
    return null;
  } catch (err) {
    console.error("Errore caricamento voto utente:", err);
    return null;
  }
}

async function handleVote(photoId, voteType, clickedBtn, otherBtn) {
  try {
    const voteRef = doc(db, "photos", photoId, "votes", currentUserId);
    const currentVote = await getUserVote(photoId);

    if (currentVote === voteType) {
      await deleteDoc(voteRef);
      updateVoteButtonStates(null, null, null);
    } else {
      await setDoc(voteRef, { voteType });
      updateVoteButtonStates(clickedBtn, otherBtn, voteType);
    }

    // Aggiorna i conteggi
    const voteCounts = await getVoteCounts(photoId);
    document.querySelector(`[data-photo-id="${photoId}"].like-btn .vote-count`).textContent = voteCounts.likes;
    document.querySelector(`[data-photo-id="${photoId}"].dislike-btn .vote-count`).textContent = voteCounts.dislikes;

  } catch (err) {
    console.error("Errore durante il voto:", err);
    setStatus("Errore durante il voto", "error");
  }
}

function updateVoteButtonStates(likeBtn, dislikeBtn, userVote) {
  const allLikeBtns = document.querySelectorAll(".like-btn");
  const allDislikeBtns = document.querySelectorAll(".dislike-btn");

  allLikeBtns.forEach(btn => {
    const btnUserVote = btn.dataset.userVote;
    if (btnUserVote === "like") {
      btn.classList.add("voted");
    } else {
      btn.classList.remove("voted");
    }
  });

  allDislikeBtns.forEach(btn => {
    const btnUserVote = btn.dataset.userVote;
    if (btnUserVote === "dislike") {
      btn.classList.add("voted");
    } else {
      btn.classList.remove("voted");
    }
  });

  if (likeBtn && dislikeBtn && userVote) {
    if (userVote === "like") {
      likeBtn.classList.add("voted");
      dislikeBtn.classList.remove("voted");
    } else if (userVote === "dislike") {
      dislikeBtn.classList.add("voted");
      likeBtn.classList.remove("voted");
    }
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  console.log("Logout in corso...");
  await auth.signOut();
  console.log("Logout completato, redirect...");
  window.location.href = "/login/";
});

function getServiceLabel(service) {
  switch (service) {
    case "emergenza-sanitaria":
      return "Emergenza Sanitaria Territoriale";

    case "soccorso-tecnico-urgente":
      return "Soccorso Tecnico Urgente";

    case "pompieri":
      return "Soccorso Tecnico Urgente";

    case "protezione-civile":
      return "Protezione Civile";

    case "soccorso-alpino":
      return "Soccorso Alpino";

    case "guardia-costiera":
      return "Guardia Costiera";

    case "ordine-pubblico":
      return "Ordine Pubblico";

    case "trasporti-secondari":
      return "Trasporti Sanitari Secondari";

    default:
      return service || "N/A";
  }
}

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