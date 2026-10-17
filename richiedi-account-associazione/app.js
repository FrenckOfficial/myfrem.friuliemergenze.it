import { firebaseConfig } from "/helpers/configFirebase.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { setStatus } from "/helpers/modals.js";
import "/helpers/loadIcons.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, query, where, limit, getDocs, getDoc, addDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

let isSubmitting = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const requestForm = document.getElementById("request-form");
const submitBtn = document.getElementById("submit-btn");
const btnText = document.getElementById("btn-text");
const btnLoader = document.getElementById("btn-loader");

const guestFields = document.getElementById("guest-fields");
const whoLine = document.getElementById("who");
const loginHint = document.getElementById("login-hint");

const stateIds = ["state-loading", "state-existing", "state-done", "request-form"];

const statusText = {
  in_attesa: "La stiamo verificando: ti contatteremo noi. Non serve inviarne un'altra.",
  approvata: "La richiesta è stata approvata."
};

function showState(id) {
  stateIds.forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.hidden = s !== id;
  });
}

function setGuestMode(isGuest) {
  if (guestFields) guestFields.hidden = !isGuest;
  if (loginHint) loginHint.hidden = !isGuest;
  if (whoLine) whoLine.hidden = isGuest;
}

function setButtonLabel(text) {
  if (btnText) btnText.textContent = text;
  else if (submitBtn) submitBtn.textContent = text;
}

function setLoader(visible) {
  if (btnLoader) btnLoader.style.display = visible ? "inline-block" : "none";
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function val(id) {
  const el = document.getElementById(id);
  return el ? clean(el.value) : "";
}

async function getUserDoc(uid) {
  return await getDoc(doc(db, "users", uid));
}

async function findOpenRequest(uid) {
  const q = query(collection(db, "associationRequests"), where("requesterUid", "==", uid), limit(10));

  const snap = await getDocs(q);
  const all = snap.docs.map((d) => d.data());

  return all.find((r) => r.status === "in_attesa") || all.find((r) => r.status === "approvata") || null;
}

async function sendConfirmEmail(requestId, user) {
  const headers = { "Content-Type": "application/json" };

  if (user) {
    headers["Authorization"] = `Bearer ${await user.getIdToken()}`;
  }

  const response = await fetch("/api/sendAssociationConfirmEmail", {
    method: "POST",
    headers,
    body: JSON.stringify({ requestId })
  });

  return response.ok;
}

if (requestForm) {
  const assocType = document.getElementById("tipo");
  const assocTypeOther = document.getElementById("tipoAltro");
  const assocTypeOtherWrap = document.getElementById("tipo-altro-wrap");

  assocType.addEventListener("change", () => {
    assocTypeOtherWrap.hidden = assocType.value !== "altro";
  });

  function validateForm() {
    if (!val("nome")) {
      setStatus("Devi inserire il nome dell'associazione o dell'ente.", "error");
      return false;
    }

    if (!assocType.value) {
      setStatus("Devi scegliere il servizio svolto.", "error");
      return false;
    }

    if (assocType.value === "altro" && !clean(assocTypeOther.value)) {
      setStatus("Specifica quale servizio svolge l'ente.", "error");
      return false;
    }

    if (!val("comune")) {
      setStatus("Devi inserire il comune della sede.", "error");
      return false;
    }

    const email = val("emailEnte");

    if (!email) {
      setStatus("Devi inserire l'email dell'ente.", "error");
      return false;
    }

    if (!EMAIL_RE.test(email)) {
      setStatus("L'email dell'ente non è valida.", "error");
      return false;
    }

    const website = val("sito");

    if (website && !/^https?:\/\//i.test(website)) {
      setStatus("Il sito deve iniziare con http:// o https://.", "error");
      return false;
    }

    if (!auth.currentUser) {
      if (!val("guestName")) {
        setStatus("Devi inserire il tuo nome e cognome.", "error");
        return false;
      }

      const guestEmail = val("guestEmail");

      if (!guestEmail) {
        setStatus("Devi inserire la tua email.", "error");
        return false;
      }

      if (!EMAIL_RE.test(guestEmail)) {
        setStatus("La tua email non è valida.", "error");
        return false;
      }
    }

    if (!val("ruolo")) {
      setStatus("Devi indicare il tuo ruolo nell'ente.", "error");
      return false;
    }

    if (!document.getElementById("consenso").checked) {
      setStatus("Per inviare la richiesta devi confermare la dichiarazione.", "error");
      return false;
    }

    return true;
  }

  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    if (!validateForm()) return;

    const user = auth.currentUser;

    isSubmitting = true;
    submitBtn.disabled = true;
    setButtonLabel("Invio in corso...");
    setLoader(true);

    try {
      let userData = null;

      if (user) {
        const userSnap = await getUserDoc(user.uid);

        if (!userSnap.exists()) {
          setStatus("Profilo non trovato.", "error");
          return;
        }

        userData = userSnap.data();

        if (userData.status === "sospeso" || userData.status === "eliminato") {
          setStatus("Il tuo account non può inviare richieste.", "error");
          return;
        }
      }

      const LAMail = val("emailEnte").toLowerCase();
      const type = assocType.value;

      const requesterNome = user
        ? `${userData.name || ""} ${userData.surname || ""}`.trim()
        : val("guestName");

      const requesterEmail = user ? user.email : val("guestEmail").toLowerCase();

      const ref = await addDoc(collection(db, "associationRequests"), {
        name: val("nome"),
        type,
        otherType: type === "altro" ? clean(assocTypeOther.value) : "",
        municipality: val("comune"),
        LAMail,
        LAPhone: val("telefonoEnte"),
        site: val("sito"),
        referenceRole: val("ruolo"),
        note: val("note"),
        requesterUid: user ? user.uid : null,
        requesterNome,
        requesterEmail,
        requesterGuest: !user,
        origin: "richiesta",
        status: "in_attesa",
        verifyStatus: "da_verificare",
        confirmedMail: false,
        createdAt: serverTimestamp()
      });

      let sent = false;

      try {
        sent = await sendConfirmEmail(ref.id, user);
      } catch (error) {
        console.error("Errore invio email di conferma:", error);
      }

      document.getElementById("done-text").textContent = sent
        ? `Abbiamo mandato un link di conferma a ${LAMail}: aprilo per confermare l'indirizzo. Poi verificheremo la richiesta contattando direttamente l'ente.`
        : `Non siamo riusciti a spedire il link di conferma a ${LAMail}. La richiesta è registrata e lo staff ti scriverà.`;

      showState("state-done");
      setStatus("Richiesta inviata con successo!", "success");

    } catch (err) {
      console.error(err);

      switch (err.code) {
        case "permission-denied":
          setStatus(
            user
              ? "Non è stato possibile inviare la richiesta (permessi insufficienti). Esci, accedi di nuovo e riprova."
              : "Non è stato possibile inviare la richiesta (permessi insufficienti). Riprova più tardi.",
            "error"
          );
          break;
        default:
          setStatus("C'è stato un errore durante l'invio della richiesta.", "error");
      }
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      setButtonLabel("Invia richiesta");
      setLoader(false);
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (isSubmitting) return;

  if (!user) {
    setGuestMode(true);
    showState("request-form");
    return;
  }

  setGuestMode(false);

  const who = document.getElementById("who-email");
  if (who) who.textContent = user.email;

  try {
    const open = await findOpenRequest(user.uid);

    if (open) {
      document.getElementById("existing-title").textContent = open.status === "approvata" ? "La tua richiesta è già stata approvata" : "Hai già una richiesta in corso";
      document.getElementById("existing-text").textContent = `${open.name}: ${statusText[open.status]}`;
      showState("state-existing");
      return;
    }
  } catch (err) {
    console.error("Errore controllo richieste esistenti:", err);
  }

  showState("request-form");
});