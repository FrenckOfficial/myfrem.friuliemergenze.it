import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { firebaseConfig } from "/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("userid");

if (!userId) {
    alert("ID utente mancante.");
    window.location.href = "/login";
}

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
    staffSince: document.getElementById("staffSince")
};

const adminRoles = [
    "superadmin",
    "advstaff",
    "modstaff",
    "simplestaff"
];

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "/login";
        return;
    }

    loadUserProfile(userId);
});

async function loadUserProfile(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            alert("Profilo non trovato.");
            return;
        }

        const user = snap.data();

        const fullName = `${user.name || ""} ${user.surname || ""}`.trim() || "Utente";
        const username = user.username || "username";
        const email = user.email || "N/D";
        const role = user.role || "Utente";
        const status = user.status || "Offline";
        const avatar = user.photoURL || "/assets/profile/defpic.png";

        document.title = `Profilo di ${fullName} | MyFrEM`;

        elements.name.textContent = fullName;
        elements.username.textContent = `@${username}`;
        elements.email.textContent = maskEmail(email);
        elements.role.textContent = role;
        elements.status.textContent = status;

        elements.avatar.src = avatar;

        elements.avatar.onerror = () => {
            elements.avatar.src = "/assets/profile/defpic.png";
        };

        renderBadges(role);
        renderStatus(status);

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

            const photos =
                user.photos || 0;

            const events =
                user.events || 0;

            elements.userPhotos.textContent =
                photos;

            elements.userEvents.textContent =
                events;

            elements.userSince.textContent =
                formatDate(user.createdAt) || "2025";

            elements.userBadge.textContent =
                getActivityBadge(photos);
        }
    } catch (err) {
        console.error("Errore caricamento profilo:", err);
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
    const roles = {
        superadmin: {
            class: "admin",
            text: "SUPER AMMINISTRATORE"
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

    return roles[role.toLowerCase()] || {
        class: "user",
        text: "UTENTE"
    };
}

function getPermissions(role) {
    switch (role.toLowerCase()) {
        case "superadmin":
            return "ACCESSO COMPLETO";

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

function getActivityBadge(photos) {
    if (photos >= 500)
        return "LEGGENDA";

    if (photos >= 100)
        return "SUPER ATTIVO";

    if (photos >= 25)
        return "ATTIVO";

    return "NUOVO MEMBRO";
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