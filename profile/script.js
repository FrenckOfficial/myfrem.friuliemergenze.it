import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("userid");

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");
const messageBox = document.getElementById("messageBox");

let currentUser = null;
let currentUserId = null;

if (!userId) {
  messageBox.classList.add("error");
  messageBox.textContent = "ID utente mancante.";
}

onAuthStateChanged(auth, async (user) => {
  const timeoutId = setTimeout(() => {
    console.warn("⏱️ Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  currentUser = user;
  currentUserId = user.uid;

  await loadUserProfile(userId);

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

const elements = {
  title: document.getElementById("profileTitle"),
  name: document.getElementById("profileName"),
  username: document.getElementById("profileUsername"),
  email: document.getElementById("profileEmail"),
  role: document.getElementById("profileRole"),
  status: document.getElementById("profileStatus"),
  avatar: document.getElementById("profileAvatar"),
  badges: document.getElementById("profileBadges"),
  statusDot: document.getElementById("statusDot"),
  statsGrid: document.getElementById("statsGrid"),
  staffGrid: document.getElementById("staffGrid"),
  userPhotos: document.getElementById("userPhotos"),
  userEvents: document.getElementById("userEvents"),
  userSince: document.getElementById("userSince"),
  userBadge: document.getElementById("userBadge"),
  staffRole: document.getElementById("staffRole"),
  staffPerms: document.getElementById("staffPerms"),
  staffSince: document.getElementById("staffSince"),
  messageBox: document.getElementById("messageBox"),
  staffPhotos: document.getElementById("staffPhotos"),
  staffEvents: document.getElementById("staffEvents"),
  badgesContainer: document.getElementById("userBadgesContainer")
};

const adminRoles = [
  "superadmin",
  "advstaffplus",
  "advstaff",
  "modstaff",
  "simplestaff"
];

async function loadUserProfile(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
          messageBox.classList.add("error");
          messageBox.textContent = "Profilo non trovato.";
          return;
        }

        const user = snap.data();

        const fullName = `${user.name || ""} ${user.surname || ""}` || "Utente";
        const username = user.username || "username";
        const email = user.email || "N/D";
        const role = user.role || "Utente";
        const status = user.status || "Offline";
        const avatar = user.photoURL || "/assets/profile/defpic.png";
        const createdAt = user.createdAt;
        const isPublic = user.privateProfile !== true;

        const isOwnProfile = currentUserId === uid;

        if (!isPublic && !isOwnProfile) {
          messageBox.classList.add("error");
          messageBox.textContent = "❌ Questo profilo è privato.";
          elements.statsGrid.classList.add("none");
          elements.staffGrid.classList.add("none");
          document.getElementById("userBadgesSection").style.display = "none";
          return;
        }

        if (!isPublic) {
          document.querySelector(".profileCard").innerHTML = `
            <div style="
              background: rgba(232, 72, 85, 0.12);
              color: #e84855;
              padding: 20px;
              border-radius: 4px;
              text-align: center;
              font-weight: 700;
            ">
              🔒 PROFILO PRIVATO
              <p style="font-size: 0.85rem; margin-top: 8px; color: #999;">
                I dati di questo profilo non sono pubblicamente visibili
              </p>
            </div>
          `;
          return;
        } else if (!isPublic && isOwnProfile) {
          return
        }

        if (adminRoles.includes(role.toLowerCase())) {
          elements.role.textContent = "AMMINISTRATORE";
        } else if (role.toLowerCase() === "user") {
          elements.role.textContent = "UTENTE";
        }

        if (status === "attivo") {
            elements.status.textContent = "ACCOUNT ATTIVO"
        } else if (status === "sospeso") {
            elements.status.textContent = "ACCOUNT SOSPESO"
        } else if (status === "eliminato") {
            elements.status.textContent = "ACCOUNT ELIMINATO"
        }

        document.title = `Profilo di ${fullName} | MyFrEM - Piattaforma ufficiale di Friuli Emergenze`;

        elements.name.textContent = fullName;
        elements.username.textContent = `@${username}`;
        elements.email.textContent = maskEmail(email);

        elements.avatar.src = avatar;

        elements.avatar.onerror = () => {
          elements.avatar.src = "/assets/profile/defpic.png";
        };

        renderBadges(role);
        renderStatus(status);
        await loadUserBadges(uid);

        const isStaff = adminRoles.includes(role.toLowerCase());

        if (isStaff) {
            elements.statsGrid.classList.add("none");
            elements.staffGrid.classList.remove("none");

            elements.staffRole.textContent =
                roleData(role).text;

            elements.staffPerms.textContent =
                getPermissions(role);

            elements.staffSince.textContent =
                formatDate(user.createdAt) || "2025";
        } else {
            elements.statsGrid.classList.remove("none");
            elements.staffGrid.classList.add("none");
            const photosRef = collection(db, "photos");
            const photosQuery = query(photosRef, where("userId", "==", uid));
            const photosSnap = await getDocs(photosQuery);
            const eventsRef = collection(db, "events");
            const eventsQuery = query(eventsRef, where("uid", "==", uid));
            const eventsSnap = await getDocs(eventsQuery)

            const photos = photosSnap.size;
            const events = eventsSnap.size;

            elements.userPhotos.textContent = photos;
            elements.userEvents.textContent = events;
            elements.userSince.textContent = formatDate(user.createdAt) || "2025";
            elements.userBadge.textContent = getActivityBadge(user.createdAt);

            elements.userPhotos.addEventListener("click", async () => {
              loadUserPhotos(userId);
            });

            elements.userEvents.addEventListener("click", async () => {
              loadUserEvents(userId)
            })
        }
    } catch (err) {
        console.error("Errore caricamento profilo:", err);
    }
}

async function loadUserBadges(uid) {
  try {
    const badgesRef = collection(db, "users", uid, "badges");
    const badgesSnap = await getDocs(badgesRef);

    elements.badgesContainer.innerHTML = "";

    if (badgesSnap.empty) {
      elements.badgesContainer.innerHTML = `
        <p style="color: var(--text-secondary); width: 100%; text-align: center; padding: 2rem;">
          Nessun badge guadagnato
        </p>
      `;
      return;
    }

    for (const badgeDocSnap of badgesSnap.docs) {
      const badgeId = badgeDocSnap.id;
      const badgeData = badgeDocSnap.data();

      const badgeDocRef = doc(db, "badges", badgeId);
      const badgeMeta = await getDoc(badgeDocRef);

      if (!badgeMeta.exists()) continue;

      const meta = badgeMeta.data();

      const badgeEl = document.createElement("div");
      badgeEl.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 1.25rem;
        background: var(--bg-surface);
        border: 2px solid #00d4e8;
        border-radius: 8px;
        transition: transform 0.2s, box-shadow 0.2s, filter 0.2s;
        cursor: pointer;
        min-width: 120px;
        text-align: center;
      `;

      const img = document.createElement("img");
      img.src = meta.icon || "/assets/badges/default.svg";
      img.alt = meta.name;
      img.style.cssText = "width: 56px; height: 56px; border: 2px solid #00d4e8; border-radius: 50%; padding: 4px; background: rgba(0, 212, 232, 0.1);";
      img.onerror = () => {
        img.src = "/assets/badges/default.svg";
      };

      const label = document.createElement("span");
      label.textContent = meta.name;
      label.style.cssText = "font-size: 0.75rem; font-weight: 700; text-align: center; max-width: 100px; color: #00d4e8; line-height: 1.3;";
      label.title = meta.description;

      const earnedDate = document.createElement("span");
      earnedDate.style.cssText = "font-size: 0.65rem; color: var(--text-muted);";
      if (badgeData.earnedAt?.toDate) {
        const date = badgeData.earnedAt.toDate();
        earnedDate.textContent = `📅 ${date.toLocaleDateString("it-IT")}`;
      }

      badgeEl.appendChild(img);
      badgeEl.appendChild(label);
      badgeEl.appendChild(earnedDate);

      badgeEl.addEventListener("mouseenter", () => {
        badgeEl.style.transform = "scale(1.1) translateY(-4px)";
        badgeEl.style.boxShadow = "0 8px 20px rgba(0, 212, 232, 0.25)";
        badgeEl.style.filter = "brightness(1.1)";
      });

      badgeEl.addEventListener("mouseleave", () => {
        badgeEl.style.transform = "scale(1)";
        badgeEl.style.boxShadow = "none";
        badgeEl.style.filter = "brightness(1)";
      });

      elements.badgesContainer.appendChild(badgeEl);
    }

  } catch (err) {
    console.error("Errore caricamento badge:", err);
  }
}

function formatDate(timestamp) {
    if (!timestamp?.seconds) return "N/D";

    const date = new Date(timestamp.seconds * 1000);

    return date.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function roleData(role) {
  const safeRole = (typeof role === "string")
    ? role.toLowerCase()
    : "user";

  const roles = {
    superadmin: {
      class: "admin",
      text: "SUPER AMMINISTRATORE"
    },
    advstaffplus: {
      class: "staff",
      text: "AMMINISTRATORE AVANZATO PLUS"
    },
    advstaff: {
      class: "staff",
      text: "AMMINISTRATORE AVANZATO"
    },
    modstaff: {
      class: "staff",
      text: "MODERATORE"
    },
    simplestaff: {
      class: "staff",
      text: "NUOVO AMMINISTRATORE"
    }
  };

  return roles[safeRole] || {
    class: "user",
    text: "UTENTE"
  };
}

function getPermissions(role) {
  const safeRole = typeof role === "string" ? role.toLowerCase() : "user";

  switch (safeRole) {
    case "superadmin":
      return "ACCESSO COMPLETO";
    case "advstaffplus":
      return "GESTIONE AVANZATA";
    case "advstaff":
      return "GESTIONE AVANZATA";
    case "modstaff":
      return "MODERAZIONE";
    case "simplestaff":
      return "GESTIONE BASE";
    default:
      return "STANDARD";
  }
}

function getActivityBadge(createdAt) {
  if (!createdAt) return "NUOVO MEMBRO";
  const now = new Date();
  const createdDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);

  const diffTime = now - createdDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays >= 365) {
    return "VETERANO DI MYFREM";
  }

  if (diffDays >= 180) {
    return "UTENTE ESPERTO";
  }

  if (diffDays >= 30) {
    return "UTENTE ATTIVO";
  }

  return "NUOVO UTENTE";
}

function renderBadges(role) {
    elements.badges.innerHTML = "";

    const data = roleData(role);

    const badge = document.createElement("div");

    badge.classList.add("badge");
    badge.classList.add(data.class);

    badge.textContent = data.text;

    elements.badges.appendChild(badge);
}

function renderStatus(status) {
    const normalized = status.toLowerCase();

    const isOnline = normalized === "online" || normalized === "attivo";

    elements.statusDot.style.background = isOnline ? "#22c55e" : "#9ca3af";
}

function maskEmail(email) {
    if (!email.includes("@")) return email;

    const [name, domain] = email.split("@");

    return `${name.slice(0,3)}***@${domain}`;
}

async function loadUserPhotos(userId) {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  const popup = document.createElement("div");
  popup.className = "popup";

  popup.innerHTML = `
    <div class="popup-header">
      <h2>📸 Foto utente</h2>
      <button class="close-popup">✖</button>
    </div>

    <div class="popup-content" id="userPhotosContainer">
      <p>Caricamento foto...</p>
    </div>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  popup.querySelector(".close-popup").addEventListener("click", () => {
    overlay.remove();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  const container = document.getElementById("userPhotosContainer");

  try {
    const photosRef = collection(db, "photos");

    const q = query(
      photosRef,
      where("userId", "==", userId)
    );

    const querySnapshot = await getDocs(q);

    container.innerHTML = "";

    if (querySnapshot.empty) {
      container.innerHTML = `
        <p>Nessuna foto trovata.</p>
      `;
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const card = document.createElement("div");
      card.className = "photo-card";

      card.innerHTML = `
        <img src="${data.url}" class="popup-photo" loading="lazy">

        <div class="photo-info">
          <p><b>Titolo:</b> ${data.title || data.vehicleModel}</p>
          <p><b>ID:</b> ${docSnap.id}</p>
          <p><b>Data:</b> ${
            data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleString()
              : "Non disponibile"
          }</p>
        </div>
      `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error(err);

    container.innerHTML = `
      <p style="color:red;">
        Errore caricamento foto.
      </p>
    `;
  }
}

async function loadUserEvents(userId) {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  const popup = document.createElement("div");
  popup.className = "popup";

  popup.innerHTML = `
    <div class="popup-header">
      <h2>🗂️ Eventi utente</h2>
      <button class="close-popup">✖</button>
    </div>

    <div class="popup-content" id="userEventsContainer">
      <p>Caricamento eventi...</p>
    </div>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  popup.querySelector(".close-popup").addEventListener("click", () => {
    overlay.remove();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  const container = document.getElementById("userEventsContainer");

  try {
    const userSnap = await getDoc(doc(db, "users", userId));

    if (!userSnap.exists()) {
      container.innerHTML = `
        <p style="color:red;">
          Utente non trovato.
        </p>
      `;
      return;
    }

    const userData = userSnap.data();

    const fullName =
      `${userData.name || ""} ${userData.surname || ""}`.trim();

    const eventsRef = collection(db, "events");

    const q = query(
      eventsRef,
      where("userId", "==", fullName)
    );

    const querySnapshot = await getDocs(q);

    container.innerHTML = "";

    if (querySnapshot.empty) {
      container.innerHTML = `
        <p>Nessun evento trovato.</p>
      `;
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const card = document.createElement("div");
      card.className = "photo-card";

      card.innerHTML = `
        <div class="photo-info">
          <p><b>Titolo:</b> ${data.title || "Senza titolo"}</p>

          <p><b>ID:</b> ${docSnap.id}</p>

          <p><b>Data:</b> ${
            data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleString("it-IT")
              : "Non disponibile"
          }</p>
        </div>
      `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error(err);

    container.innerHTML = `
      <p style="color:red;">
        Errore caricamento eventi.
      </p>
    `;
  }
}