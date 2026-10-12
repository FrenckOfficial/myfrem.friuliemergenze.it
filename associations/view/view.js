import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { setStatus } from "/helpers/modals.js";
import { createNotification } from "/helpers/notify.js";
import { firebaseConfig } from "/helpers/configFirebase.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const urlParams = new URLSearchParams(window.location.search);
const associationId = urlParams.get("id");

const loadingEl = document.querySelector(".loading");
const contentEl = document.querySelector(".content");
const messageBox = document.getElementById("messageBox");
const assocCard = document.getElementById("assocCard");
const joinBox = document.getElementById("joinBox");
const joinText = document.getElementById("joinText");
const joinBtn = document.getElementById("joinBtn");

const typeLabels = {
  protezione_civile: "Protezione civile",
  soccorso_sanitario: "Soccorso sanitario (ambulanze)",
  vvf_volontari: "Vigili del fuoco volontari",
  soccorso_alpino: "Soccorso alpino e speleologico",
  croce_rossa: "Croce Rossa",
  altro: "Altro"
};

const memberRoleLabels = {
  referente: "referente",
  membro: "volontario"
};

let currentUser = null;
let association = null;
let isJoining = false;
let currentUserData = null;

function showMessage(text) {
  messageBox.classList.add("error");
  messageBox.textContent = text;
}

function typeText(a) {
  if (a.tipo === "altro" && a.tipoAltro) return `Altro: ${a.tipoAltro}`;
  return typeLabels[a.tipo] || a.tipo || "Dato non disponibile";
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || "");
}

function formatDate(timestamp) {
  if (!timestamp?.seconds) return "Dato non disponibile";

  return new Date(timestamp.seconds * 1000).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function addInfoCard(label, content) {
  const card = document.createElement("div");
  card.className = "infoCard";

  const span = document.createElement("span");
  span.textContent = label;

  const h3 = document.createElement("h3");

  if (typeof content === "string") h3.textContent = content;
  else h3.appendChild(content);

  card.appendChild(span);
  card.appendChild(h3);
  document.getElementById("infoGrid").appendChild(card);
}

function makeLink(href, text, external) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = text;

  if (external) {
    a.target = "_blank";
    a.rel = "noopener noreferrer nofollow";
  }

  return a;
}

function renderAssociation() {
  const name = association.nome || "Associazione";

  document.title = `${name} | MyFrEM - Piattaforma ufficiale di Friuli Emergenze`;
  document.getElementById("assocName").textContent = name;
  document.getElementById("assocSubtitle").textContent = [typeText(association), association.zona].filter(Boolean).join(" · ");
  document.getElementById("assocDescription").textContent = association.descrizione || "Nessuna descrizione disponibile.";

  if (isHttpUrl(association.logoUrl)) {
    const logo = document.getElementById("assocLogo");
    logo.src = association.logoUrl;
    logo.onerror = () => { logo.src = "/assets/icons/logo.png"; };
  }

  if (isHttpUrl(association.copertinaUrl)) {
    const cover = document.getElementById("coverImg");
    cover.src = association.copertinaUrl;
    cover.hidden = false;
    cover.onerror = () => { cover.hidden = true; };
  }

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = typeText(association);
  document.getElementById("assocBadges").appendChild(badge);

  const contacts = association.contatti || {};

  addInfoCard("Comune", association.zona || "Dato non disponibile");

  if (contacts.email) addInfoCard("Email", makeLink(`mailto:${encodeURIComponent(contacts.email).replace("%40", "@")}`, contacts.email, false));
  if (contacts.telefono) addInfoCard("Telefono", makeLink(`tel:${contacts.telefono.replace(/[^\d+]/g, "")}`, contacts.telefono, false));
  if (isHttpUrl(contacts.sito)) addInfoCard("Sito", makeLink(contacts.sito, contacts.sito, true));

  assocCard.classList.remove("none");
}

async function loadAssociation() {
  if (!associationId) {
    showMessage("ID associazione mancante.");
    return false;
  }

  try {
    const snap = await getDoc(doc(db, "associations", associationId));

    if (!snap.exists() || snap.data().stato !== "approvata") {
      showMessage("Associazione non trovata.");
      return false;
    }

    association = snap.data();
    renderAssociation();
    return true;
  } catch (error) {
    console.error("Errore caricamento associazione:", error);

    showMessage(error.code === "permission-denied" ? "Associazione non trovata." : "Errore nel caricamento dell'associazione.");
    return false;
  }
}

function setJoinState(text, buttonLabel, onClick) {
  joinBox.classList.remove("none");
  joinText.textContent = text;

  if (buttonLabel) {
    joinBtn.hidden = false;
    joinBtn.textContent = buttonLabel;
    joinBtn.disabled = false;
    joinBtn.onclick = onClick;
  } else {
    joinBtn.hidden = true;
    joinBtn.onclick = null;
  }
}

async function renderJoin() {
  if (!currentUser) {
    setJoinState("Accedi per chiedere di unirti a questa associazione.", "Accedi", () => {
      window.location.href = "/login/";
    });
    return;
  }

  try {
    const [userSnap, memberSnap] = await Promise.all([
      getDoc(doc(db, "users", currentUser.uid)),
      getDoc(doc(db, "associations", associationId, "members", currentUser.uid))
    ]);

    const userData = userSnap.exists() ? userSnap.data() : null;
    currentUserData = userData;

    if (userData?.accountType === "association") {
      joinBox.classList.add("none");
      return;
    }

    if (!userData || userData.status === "sospeso" || userData.status === "eliminato" || userData.role === "testacc") {
      setJoinState("Il tuo account non può inviare richieste di appartenenza.", null);
      return;
    }

    if (memberSnap.exists()) {
      const member = memberSnap.data();

      if (member.stato === "confermata") {
        setJoinState(`Fai parte di questa associazione come ${memberRoleLabels[member.role] || "membro"}.`, null);
      } else if (member.stato === "rifiutata") {
        setJoinState("La tua richiesta di appartenenza non è stata accettata.", null);
      } else {
        setJoinState("Richiesta inviata: l'associazione deve ancora confermarla.", null);
      }

      return;
    }

    setJoinState("Fai parte di questa associazione?", "Chiedi di unirti", joinAssociation);
  } catch (error) {
    console.error("Errore controllo appartenenza:", error);
    joinBox.classList.add("none");
  }
}

async function notifyAssociation() {
  if (!association.ownerUid) return;

  try {
    const name = `${currentUserData?.name || ""} ${currentUserData?.surname || ""}`.trim() || "Un volontario";

    await createNotification(db, {
      userId: association.ownerUid,
      type: "association_join_request",
      associationId,
      title: "Nuova richiesta di appartenenza",
      message: `${name} vuole unirsi a ${association.nome || "la tua associazione"}.`,
      icon: "👥",
      actionUrl: "/association/dashboard/members/",
      actionLabel: "Gestisci"
    });
  } catch (error) {
    console.error("Errore invio notifica all'associazione:", error);
  }
}

async function joinAssociation() {
  if (isJoining || !currentUser) return;

  isJoining = true;
  joinBtn.disabled = true;
  joinBtn.textContent = "Invio in corso...";

  try {
    await setDoc(doc(db, "associations", associationId, "members", currentUser.uid), {
      role: "membro",
      stato: "richiesta",
      createdAt: serverTimestamp(),
      aggiornatoAt: serverTimestamp()
    });

    await notifyAssociation();

    setStatus("Richiesta inviata con successo!", "success");
    setJoinState("Richiesta inviata: l'associazione deve ancora confermarla.", null);
  } catch (error) {
    console.error("Errore invio richiesta di appartenenza:", error);

    switch (error.code) {
      case "permission-denied":
        setStatus("Non è stato possibile inviare la richiesta (permessi insufficienti).", "error");
        break;
      default:
        setStatus("C'è stato un errore durante l'invio della richiesta.", "error");
    }

    joinBtn.disabled = false;
    joinBtn.textContent = "Chiedi di unirti";
  } finally {
    isJoining = false;
  }
}

onAuthStateChanged(auth, async (user) => {
  const timeoutId = setTimeout(() => {
    console.warn("Timeout caricamento, forzo visualizzazione");
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  }, 7000);

  currentUser = user;

  if (!association) await loadAssociation();
  if (association) await renderJoin();

  clearTimeout(timeoutId);
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});